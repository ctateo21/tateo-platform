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
