/**
 * Auto-create / find a matching Insurance scenario whenever a property
 * address is saved in Purchase-with-Loan, Purchase-with-Cash, or
 * Refinance. Pure, side-effect-free helper — persistence is owned by
 * `auth.ts` (saveInsuranceScenarios).
 *
 * What this helper now seeds in addition to address:
 *   - `policyType` — defaulted from occupancy + propertyType via
 *     `getDefaultInsurancePolicyType()` (HO3 / HO6 / DP3 rules).
 *   - `policyTypeSource` — "default_rule" when this helper sets it;
 *     existing rows with "manual" are never overwritten.
 *   - `occupancyType` + `propertyType` snapshots — carried through so the
 *     Insurance tab UI can re-render the default badge and so a later
 *     change in property type re-evaluates the default automatically.
 *
 * The underlying Supabase columns (`policy_type`,
 * `policy_type_source`) were added in the user's most recent
 * insurance migration; this code intentionally does not run any DDL.
 *
 * Behavior contract:
 *   - On CREATE: always compute the default policy type from the
 *     incoming occupancy/propertyType and stamp `policyTypeSource =
 *     "default_rule"` when a value is returned.
 *   - On FOUND existing row:
 *       - If `policyTypeSource === "manual"`, do not touch policyType.
 *       - Otherwise re-evaluate the default rule against the latest
 *         occupancy/propertyType and update the row in place if it
 *         differs (also refreshes the carried-over snapshots).
 */

import type { InsuranceScenario } from "./auth";
import { normalizePropertyKey } from "./property-key";
import { calculateDefaultHomeownersInsurance } from "./insurance-default";
import { getDefaultInsurancePolicyType } from "./insurance-policy-type";

export type InsuranceSourceType = "purchase" | "cash_buy" | "refinance";

export interface EnsureInsuranceInput {
  sourceType: InsuranceSourceType;
  sourceScenarioId: string;
  address: string;
  insuranceScenarios: InsuranceScenario[];
  /** Property value used to seed `annualPremium = 0.75% × value` on
   *  newly-created insurance rows (spec: insurance-default-075-percent).
   *  Purchase price for Purchase-with-Loan / Cash, estimated home value
   *  for Refinance. Omit/leave undefined when no value is available —
   *  the row will be created with a blank premium and the Insurance
   *  tab will fall back to the 0.75% default at render. */
  propertyValue?: number;
  /** Occupancy / property-use from the source scenario. Drives the
   *  default policy-type rule (primary/secondary → HO3, investment →
   *  DP3, condo/townhouse → HO6 regardless). Optional — if absent and
   *  no condo/townhouse propertyType is provided, policy type is left
   *  untouched on the row. */
  occupancyType?: string;
  /** Physical property type ("Single Family Residence",
   *  "Condominium", "Townhouse", ...) from the source scenario.
   *  Optional — same semantics as `occupancyType`. */
  propertyType?: string;
}

export interface EnsureInsuranceResult {
  scenarios: InsuranceScenario[];
  changed: boolean;
  insuranceId: string | null;
  action: "created" | "found" | "updated" | "skipped_no_address";
}

function makeInsuranceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ins_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Find or create an InsuranceScenario for the given source property.
 * Matches by (a) exact lowercased address, then (b) shared
 * normalizedPropertyKey — the same rule `buildInsuranceRows` and the
 * "Add Insurance Property" manual flow already use, so manual and
 * auto-created rows never collide.
 *
 * Premium / coverage / occupancy the user typed manually are
 * preserved — we only touch the policy-type fields, and only when
 * `policyTypeSource !== "manual"`.
 */
export function ensureInsuranceForAddress(
  input: EnsureInsuranceInput,
): EnsureInsuranceResult {
  const {
    sourceType, sourceScenarioId, address, insuranceScenarios, propertyValue,
    occupancyType, propertyType,
  } = input;
  const trimmed = (address ?? "").trim();

  console.log("[insurance-auto-create] source type", { sourceType });
  console.log("[insurance-auto-create] source scenario id", { id: sourceScenarioId });
  console.log("[insurance-auto-create] address", { address: trimmed });

  if (!trimmed) {
    console.log("[insurance-auto-create] skipped reason", { reason: "no_address" });
    return {
      scenarios: insuranceScenarios,
      changed: false,
      insuranceId: null,
      action: "skipped_no_address",
    };
  }

  const incomingKey = normalizePropertyKey(trimmed).key;
  console.log("[insurance-auto-create] normalized property key", { key: incomingKey });

  const existingIdx = insuranceScenarios.findIndex((s) => {
    const addr = (s.address ?? "").trim();
    if (!addr) return false;
    if (addr.toLowerCase() === trimmed.toLowerCase()) return true;
    if (!incomingKey) return false;
    return normalizePropertyKey(addr).key === incomingKey;
  });

  const defaultPolicyType = getDefaultInsurancePolicyType({
    occupancyType,
    propertyType,
  });

  // Policy-type sync trace (Phase 2). Mirrors the [property-value-sync]
  // log surface so the acceptance test can grep one prefix per concern.
  console.log("[policy-type-sync] source tab", { sourceType });
  console.log("[policy-type-sync] normalized property key", { key: incomingKey });
  console.log("[policy-type-sync] occupancy/property use", { occupancyType });
  console.log("[policy-type-sync] property type", { propertyType });
  console.log("[policy-type-sync] computed policy type", { computed: defaultPolicyType });

  if (existingIdx >= 0) {
    const existing = insuranceScenarios[existingIdx];
    console.log("[insurance-auto-create] existing insurance found true/false", { found: true });

    console.log("[policy-type-sync] existing policy type", { existing: existing.policyType ?? null });
    console.log("[policy-type-sync] existing policy_type_source", { source: existing.policyTypeSource ?? null });

    // Respect manual policy-type overrides — only refresh the carried
    // snapshots if those differ, never touch the policyType itself.
    const manualLocked = existing.policyTypeSource === "manual";
    if (manualLocked) {
      console.log("[policy-type-sync] skipped manual override", { id: existing.id });
    }

    const nextOccupancy = occupancyType ?? existing.occupancyType;
    const nextPropertyType = propertyType ?? existing.propertyType;

    const policyTypeChange =
      !manualLocked && defaultPolicyType && defaultPolicyType !== existing.policyType;
    const snapshotChange =
      nextOccupancy !== existing.occupancyType ||
      nextPropertyType !== existing.propertyType;

    if (!policyTypeChange && !snapshotChange) {
      console.log("[insurance-auto-create] preserving manual insurance fields", {
        id: existing.id,
        address: existing.address,
      });
      return {
        scenarios: insuranceScenarios,
        changed: false,
        insuranceId: existing.id,
        action: "found",
      };
    }

    const updated: InsuranceScenario = {
      ...existing,
      ...(nextOccupancy ? { occupancyType: nextOccupancy as any } : {}),
      ...(nextPropertyType ? { propertyType: nextPropertyType } : {}),
      ...(policyTypeChange
        ? { policyType: defaultPolicyType!, policyTypeSource: "default_rule" }
        : {}),
    };
    console.log("[insurance-auto-create] updating defaults on existing row", {
      id: existing.id,
      policyTypeChange,
      next: updated.policyType,
      manualLocked,
    });
    if (policyTypeChange) {
      console.log("[policy-type-sync] saved policy type", {
        id: existing.id, policyType: updated.policyType, source: "default_rule",
      });
    }
    const nextScenarios = insuranceScenarios.slice();
    nextScenarios[existingIdx] = updated;
    return {
      scenarios: nextScenarios,
      changed: true,
      insuranceId: existing.id,
      action: "updated",
    };
  }

  console.log("[insurance-auto-create] existing insurance found true/false", { found: false });
  console.log("[insurance-auto-create] creating new insurance scenario", {
    sourceType,
    address: trimmed,
    occupancyType,
    propertyType,
    defaultPolicyType,
  });

  // Seed annualPremium with the global 0.75%-of-value default
  // (spec: insurance-default-075-percent).
  const seededPremium = propertyValue && propertyValue > 0
    ? calculateDefaultHomeownersInsurance(propertyValue).annualInsurance
    : undefined;
  const created: InsuranceScenario = {
    id: makeInsuranceId(),
    address: trimmed,
    savedAt: new Date().toISOString(),
    annualPremium: seededPremium,
    ...(occupancyType ? { occupancyType: occupancyType as any } : {}),
    ...(propertyType ? { propertyType } : {}),
    ...(defaultPolicyType
      ? { policyType: defaultPolicyType, policyTypeSource: "default_rule" as const }
      : {}),
  };

  if (defaultPolicyType) {
    console.log("[policy-type-sync] saved policy type", {
      id: created.id, policyType: defaultPolicyType, source: "default_rule",
    });
  }

  return {
    scenarios: [...insuranceScenarios, created],
    changed: true,
    insuranceId: created.id,
    action: "created",
  };
}

export interface BulkAddress {
  sourceType: InsuranceSourceType;
  sourceScenarioId: string;
  address: string;
  /** Optional property value — passed through to seed `annualPremium`
   *  on newly-created insurance rows. See EnsureInsuranceInput. */
  propertyValue?: number;
  /** Optional occupancy + property type used by the default
   *  policy-type rule (HO3 / HO6 / DP3). */
  occupancyType?: string;
  propertyType?: string;
}

/**
 * Apply `ensureInsuranceForAddress` for a batch of source-scenario
 * addresses (e.g. the whole purchase / cash-buy / tracked-loan list
 * being persisted). Returns the updated insurance scenarios array and
 * a `changed` flag so the caller can skip the Supabase write when
 * nothing actually changed.
 */
export function ensureInsuranceForAddresses(
  addresses: BulkAddress[],
  insuranceScenarios: InsuranceScenario[],
): { scenarios: InsuranceScenario[]; changed: boolean } {
  let scenarios = insuranceScenarios;
  let changed = false;
  for (const a of addresses) {
    const result = ensureInsuranceForAddress({
      sourceType: a.sourceType,
      sourceScenarioId: a.sourceScenarioId,
      address: a.address,
      propertyValue: a.propertyValue,
      occupancyType: a.occupancyType,
      propertyType: a.propertyType,
      insuranceScenarios: scenarios,
    });
    if (result.changed) {
      scenarios = result.scenarios;
      changed = true;
    }
  }
  return { scenarios, changed };
}
