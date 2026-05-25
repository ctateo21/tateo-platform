/**
 * Auto-create / find a matching Insurance scenario whenever a property
 * address is saved in Purchase-with-Loan, Purchase-with-Cash, or
 * Refinance. Pure, side-effect-free helper — persistence is owned by
 * `auth.ts` (saveInsuranceScenarios).
 *
 * Smallest-safe approach
 * ----------------------
 * The current `insurance_scenarios` Supabase table only has
 * `{id, address, saved_at, annual_premium, coverage_type}`. The richer
 * spec fields — `normalized_property_key`, `linked_purchase_scenario_id`,
 * `linked_cash_buy_scenario_id`, `linked_refinance_scenario_id`,
 * `occupancy_type`, `occupancy_source`, `correlation_source`,
 * `insurance_data_source`, `coverage_a`, deductibles, carrier,
 * `policy_type`, `status` — do NOT exist as columns yet.
 *
 * Writing those keys today would crash the persistence layer (Supabase
 * rejects unknown columns). The existing dashboard already correlates
 * Purchase / Cash Buy / Refi → Insurance at render time using
 * `normalizePropertyKey(address)` (see `buildInsuranceRows`), and
 * manual occupancy overrides are stored in `localStorage` via
 * `setOccupancyOverride`. So creating a stub `{id, address, savedAt}`
 * row is enough to make the property show up in the Insurance tab
 * with carry-over occupancy and a working View/Edit link — without a
 * migration.
 *
 * If you later want to persist the richer fields (link ids, occupancy
 * provenance, carrier/coverage defaults), apply the SQL migration that
 * ships in `supabase/migrations/2026_05_24_insurance_correlation.sql`
 * (see the task summary) and then extend `InsuranceScenario`,
 * `insuranceToRow`, and `rowToInsurance` together. This helper already
 * carries `sourceType` and `sourceScenarioId` through its API so the
 * extension is additive.
 */

import type { InsuranceScenario } from "./auth";
import { normalizePropertyKey } from "./property-key";
import { calculateDefaultHomeownersInsurance } from "./insurance-default";

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
}

export interface EnsureInsuranceResult {
  scenarios: InsuranceScenario[];
  changed: boolean;
  insuranceId: string | null;
  action: "created" | "found" | "skipped_no_address";
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
 * Never overwrites an existing row. Premium / coverage / occupancy
 * the user typed manually are preserved because we don't touch the
 * existing record at all.
 */
export function ensureInsuranceForAddress(
  input: EnsureInsuranceInput,
): EnsureInsuranceResult {
  const { sourceType, sourceScenarioId, address, insuranceScenarios, propertyValue } = input;
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

  const existing = insuranceScenarios.find((s) => {
    const addr = (s.address ?? "").trim();
    if (!addr) return false;
    if (addr.toLowerCase() === trimmed.toLowerCase()) return true;
    if (!incomingKey) return false;
    return normalizePropertyKey(addr).key === incomingKey;
  });

  if (existing) {
    console.log("[insurance-auto-create] existing insurance found true/false", { found: true });
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

  console.log("[insurance-auto-create] existing insurance found true/false", { found: false });
  console.log("[insurance-auto-create] creating new insurance scenario", {
    sourceType,
    address: trimmed,
  });

  // Seed annualPremium with the global 0.75%-of-value default
  // (spec: insurance-default-075-percent). Manual or carrier-quoted
  // premiums entered later overwrite this via the standard
  // InsuranceScenario edit flow; this branch only runs on FIRST
  // creation so it never clobbers a real number.
  const seededPremium = propertyValue && propertyValue > 0
    ? calculateDefaultHomeownersInsurance(propertyValue).annualInsurance
    : undefined;
  const created: InsuranceScenario = {
    id: makeInsuranceId(),
    address: trimmed,
    savedAt: new Date().toISOString(),
    annualPremium: seededPremium,
  };

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
      insuranceScenarios: scenarios,
    });
    if (result.changed) {
      scenarios = result.scenarios;
      changed = true;
    }
  }
  return { scenarios, changed };
}
