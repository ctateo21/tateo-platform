/**
 * Shared helper for defaulting an insurance policy type based on
 * occupancy + property type. Used by every flow that creates or
 * updates an Insurance scenario (manual add in the Insurance tab,
 * and auto-create from Purchase-with-Loan / Purchase-with-Cash /
 * Refinance).
 *
 * Rules (per spec):
 *   - Condominium / Townhouse / Townhome / Condo Unit  → HO6 (any occupancy)
 *   - Primary or Secondary residence (non-condo)       → HO3
 *   - Investment property (non-condo)                  → DP3
 *   - Anything else / unknown                          → null (caller skips)
 *
 * Persisted values are the stable codes: "HO3" | "HO6" | "DP3".
 * Display labels live in `INSURANCE_POLICY_TYPE_LABELS`.
 */

export type InsurancePolicyType = "HO3" | "HO6" | "DP3";

export type InsurancePolicyTypeSource = "default_rule" | "manual";

export const INSURANCE_POLICY_TYPE_LABELS: Record<InsurancePolicyType, string> = {
  HO3: "HO3 – Homeowners",
  HO6: "HO6 – Condo/Townhome",
  DP3: "DP3 – Rental / Investment",
};

export type OccupancyInput = string | null | undefined;
export type PropertyTypeInput = string | null | undefined;

export type NormalizedOccupancy = "primary" | "secondary" | "investment" | null;

/** Normalize occupancy / property-use strings from any flow into the
 *  three canonical values (or null if unknown). Recognizes the variants
 *  used across Purchase / Cash Buy / Refinance scenarios. */
export function normalizeOccupancy(input: OccupancyInput): NormalizedOccupancy {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  if (s === "primary" || s.startsWith("primary")) return "primary";
  if (s === "secondary" || s.startsWith("secondary") || s.includes("second home") || s === "vacation") {
    return "secondary";
  }
  if (
    s === "investment" || s.startsWith("investment") ||
    s === "rental" || s.startsWith("rental") || s.includes("non-owner")
  ) {
    return "investment";
  }
  return null;
}

/** Returns true when the property type string represents a condo,
 *  townhouse, townhome, or attached unit — all of which require HO6
 *  regardless of occupancy. */
export function isCondoOrTownhomePropertyType(input: PropertyTypeInput): boolean {
  if (!input) return false;
  const s = String(input).trim().toLowerCase();
  if (!s) return false;
  return (
    s.includes("condo") ||          // "condo", "condominium", "attached condo", "condo unit"
    s.includes("townhouse") ||
    s.includes("townhome") ||
    s.includes("town house") ||
    s.includes("town home")
  );
}

export interface GetDefaultPolicyTypeInput {
  occupancyType?: OccupancyInput;
  /** Some flows call the field `propertyUse` — accepted as a fallback. */
  propertyUse?: OccupancyInput;
  propertyType?: PropertyTypeInput;
}

/**
 * Resolve the default insurance policy type for a property. Returns
 * null when neither a condo/townhouse type nor an occupancy is known
 * — caller should leave the existing `policy_type` untouched in that
 * case rather than guessing.
 */
export function getDefaultInsurancePolicyType(
  input: GetDefaultPolicyTypeInput,
): InsurancePolicyType | null {
  const occupancy = normalizeOccupancy(input.occupancyType ?? input.propertyUse);

  if (isCondoOrTownhomePropertyType(input.propertyType)) return "HO6";

  if (occupancy === "investment") return "DP3";
  if (occupancy === "primary" || occupancy === "secondary") return "HO3";

  return null;
}

// ── Property-type resolution for an address ─────────────────────────
/**
 * Resolve the single best physical property type to use when computing
 * an insurance policy type for a given address, following the spec
 * priority order:
 *
 *   1. User-selected property type on the Insurance row, when
 *      `propertyTypeSource === "manual"`.
 *   2. Zillow / property_cache property type for the exact address.
 *   3. Property type copied from a Purchase-with-Loan / Purchase-with-Cash
 *      / Refinance scenario for the same normalized property key.
 *   4. The existing (non-manual) Insurance row snapshot.
 *   5. Fallback to "Single Family Residence" only if nothing else exists.
 *
 * IMPORTANT: a condo / townhome signal from ANY non-manual source wins
 * over a stale / default "Single Family Residence", so we never miss the
 * HO6 case just because one source defaulted (spec:
 * "Do not rely on stale/default Single Family if Zillow says Condo/Townhome").
 *
 * Client note: the Zillow / property_cache property type reaches the
 * client as the Purchase / Cash-Buy scenario `propertyType` (the
 * normalized `homeType` from `/api/zillow-property-lookup`, mapped via
 * `zillowToPhysicalPropertyType` when the lookup is applied). Callers
 * that have a direct property_cache value may pass it as
 * `propertyCachePropertyType`; otherwise the source-scenario values
 * carry the same Zillow-derived type.
 */
export type InsurancePropertyTypeSource =
  | "manual"
  | "property_cache"
  | "source_scenario"
  | "insurance_scenario"
  | "fallback";

export const FALLBACK_INSURANCE_PROPERTY_TYPE = "Single Family Residence";

export interface ResolveInsurancePropertyTypeInput {
  /** Property type stored on the Insurance row (any source). */
  insurancePropertyType?: PropertyTypeInput;
  /** Provenance of `insurancePropertyType` — "manual" locks it in. */
  insurancePropertyTypeSource?: string | null;
  /** Zillow / property_cache property type for the exact address, when
   *  the caller has it directly. */
  propertyCachePropertyType?: PropertyTypeInput;
  /** Property types from matching Purchase / Cash / Refinance scenarios
   *  for the same normalized property key, in priority order. */
  sourcePropertyTypes?: PropertyTypeInput[];
  /** Override the "Single Family Residence" fallback if needed. */
  fallback?: string;
}

export interface ResolveInsurancePropertyTypeResult {
  propertyType: string;
  source: InsurancePropertyTypeSource;
}

export function resolveInsurancePropertyTypeForAddress(
  input: ResolveInsurancePropertyTypeInput,
): ResolveInsurancePropertyTypeResult {
  const fallback = input.fallback ?? FALLBACK_INSURANCE_PROPERTY_TYPE;
  const clean = (v: PropertyTypeInput): string => (v ?? "").toString().trim();

  // 1. Manual property-type pick always wins.
  const manual = clean(input.insurancePropertyType);
  if (input.insurancePropertyTypeSource === "manual" && manual) {
    return { propertyType: manual, source: "manual" };
  }

  // Ordered, non-manual candidates with provenance.
  const candidates: Array<{ value: string; source: InsurancePropertyTypeSource }> = [];
  const cache = clean(input.propertyCachePropertyType);
  if (cache) candidates.push({ value: cache, source: "property_cache" });
  for (const sp of input.sourcePropertyTypes ?? []) {
    const v = clean(sp);
    if (v) candidates.push({ value: v, source: "source_scenario" });
  }
  const insVal = clean(input.insurancePropertyType);
  if (insVal) candidates.push({ value: insVal, source: "insurance_scenario" });

  // 2. A condo/townhome signal from ANY non-manual source overrides a
  //    stale / default Single Family.
  const condo = candidates.find((c) => isCondoOrTownhomePropertyType(c.value));
  if (condo) return { propertyType: condo.value, source: condo.source };

  // 3-5. Otherwise first available in priority order.
  if (candidates.length > 0) {
    return { propertyType: candidates[0].value, source: candidates[0].source };
  }

  // 6. Nothing known — Single Family fallback.
  return { propertyType: fallback, source: "fallback" };
}
