/**
 * Shared default-homeowners-insurance helper.
 *
 * One canonical formula used everywhere we need a *default* estimate
 * for annual / monthly homeowners insurance: 0.75% of the property
 * value (purchase price for Purchase-with-Loan / Cash, estimated
 * home value for Refinance, Zillow value for property-cache flows).
 *
 * This intentionally lives outside the regional FL insurance
 * simulator's pricing engine. The simulator's user-tunable factors
 * (region/roof/wind/etc) still adjust the displayed premium *band*,
 * but the baseline midpoint is now anchored to 0.75% so every flow
 * starts from the same number.
 *
 * Manual overrides and real carrier quotes always win — callers are
 * expected to check for `homeownersInsurance` / `annualPremium` /
 * `insurance_source === "manual" | "quote"` BEFORE falling back to
 * this default.
 */

export const DEFAULT_HOMEOWNERS_INSURANCE_PERCENT = 0.0075;

/**
 * Coverage A multiplier per policy type (spec: insurance-ho6-half-coverage-and-premium).
 *
 * HO6 (condo/townhome) policies insure only the interior of the unit
 * — the master condo association policy covers the structure shell —
 * so both Coverage A AND the resulting annual premium are cut in half
 * versus an HO3 / DP3 single-family policy of the same property value.
 *
 * The premium reduction is *implicit*: premium = coverageA × 0.75%,
 * so halving coverageA halves the premium for free. Callers that
 * derive premium from `propertyValue` directly (without going through
 * `coverageA`) must still apply this multiplier — use the
 * `calculateInsuranceDefaults` helper below to stay consistent.
 *
 * Unknown / null policy types default to 1.0 (HO3 behavior) so legacy
 * rows and unauthenticated quick-quote flows keep working unchanged.
 */
export const INSURANCE_POLICY_COVERAGE_MULTIPLIER = {
  HO3: 1.0,
  DP3: 1.0,
  HO6: 0.5,
} as const;

export type InsurancePolicyTypeForCoverage =
  keyof typeof INSURANCE_POLICY_COVERAGE_MULTIPLIER;

export function getInsuranceCoverageMultiplier(
  policyType: string | null | undefined,
): number {
  if (!policyType) return 1.0;
  const key = policyType as InsurancePolicyTypeForCoverage;
  return INSURANCE_POLICY_COVERAGE_MULTIPLIER[key] ?? 1.0;
}

export type DefaultHomeownersInsuranceSource = "default_0_75_percent";

export interface DefaultHomeownersInsuranceResult {
  /** Annual premium in dollars (rounded to nearest $1). */
  annualInsurance: number;
  /** Monthly premium in dollars (rounded to nearest $1). */
  monthlyInsurance: number;
  /** Provenance tag so consumers can distinguish from manual/quote values. */
  source: DefaultHomeownersInsuranceSource;
}

/**
 * Compute the default annual + monthly homeowners insurance estimate
 * from a property value. Returns zeros when `propertyValue` is missing,
 * non-positive, or non-finite — callers can treat that as "no estimate
 * available" and fall back to blank.
 */
export function calculateDefaultHomeownersInsurance(
  propertyValue: number | null | undefined,
): DefaultHomeownersInsuranceResult {
  const value = typeof propertyValue === "number" && Number.isFinite(propertyValue) && propertyValue > 0
    ? propertyValue
    : 0;
  const annual = Math.round(value * DEFAULT_HOMEOWNERS_INSURANCE_PERCENT);
  const monthly = Math.round(annual / 12);
  return { annualInsurance: annual, monthlyInsurance: monthly, source: "default_0_75_percent" };
}

export interface InsuranceDefaultsInput {
  propertyValue: number | null | undefined;
  policyType?: string | null | undefined;
}

export interface InsuranceDefaultsResult {
  /** Coverage A in dollars (propertyValue × coverageMultiplier, rounded). */
  coverageA: number;
  /** Annual premium in dollars (coverageA × 0.75%, rounded). */
  annualPremium: number;
  /** Monthly premium (annualPremium / 12, rounded to nearest cent). */
  monthlyPremium: number;
  /** 1.0 for HO3/DP3/unknown, 0.5 for HO6. */
  coverageMultiplier: number;
  /** Provenance tag for premium so callers can stamp `premium_source`. */
  source: DefaultHomeownersInsuranceSource;
}

/**
 * Spec: insurance-ho6-half-coverage-and-premium.
 *
 * Single canonical formula for default Coverage A + premium across
 * Insurance overview, detail, simulator, and auto-create flows.
 * HO6 → coverageA = propertyValue × 0.5 → premium also halves.
 * HO3 / DP3 / unknown → coverageA = propertyValue × 1.0.
 */
export function calculateInsuranceDefaults(
  input: InsuranceDefaultsInput,
): InsuranceDefaultsResult {
  const raw = input.propertyValue;
  const value = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 0;
  const multiplier = getInsuranceCoverageMultiplier(input.policyType);
  const coverageA = Math.round(value * multiplier);
  const annualPremium = Math.round(coverageA * DEFAULT_HOMEOWNERS_INSURANCE_PERCENT);
  const monthlyPremium = Math.round((annualPremium / 12) * 100) / 100;
  return {
    coverageA,
    annualPremium,
    monthlyPremium,
    coverageMultiplier: multiplier,
    source: "default_0_75_percent",
  };
}
