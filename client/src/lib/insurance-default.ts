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
