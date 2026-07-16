// Shared mortgage rate / pricing engine.
//
// Single source of truth for both the Purchase tab (mortgage-new.tsx)
// credit-score tier adjustments and the Refinance tab (refi/loan-tracker.tsx)
// detail view. Refactored out of the Purchase rate code so Refinance no
// longer hand-rolls its own pricing.
//
// Inputs intentionally minimal: loan type, credit score, occupancy,
// and the live-rate snapshot. The caller layers extra adjustments
// (e.g. LTV, term) on top if/when those rules exist.
//
// Pricing model (mirrors mortgage-new.tsx handleCalculate):
//   final % = baseRate(loanType, liveRates)
//           + 0.1% per credit-score tier below 780
//           + occupancy LLPA (primary 0, secondary 0.25, investment 0.75)
//
// DSCR / Bank Statement: no real pricing wired up yet — we derive a
// placeholder from the live conventional rate + a flat add-on and
// surface `pricingConnected: false` so the UI can warn the user.

import type { LiveRate, LoanType, PropertyType } from "@/components/refi/loan-tracker";

export const CREDIT_SCORE_TIERS = [780, 760, 740, 720, 700, 680, 660, 640, 620, 600] as const;

// Fallback base rates (%) — kept in sync with the Purchase tab's
// mortgageRates fallback in client/src/pages/mortgage-new.tsx.
const FALLBACK_BASE_RATES_PCT: Record<LoanType, number> = {
  conventional: 6.90,
  fha: 6.60,
  va: 6.68,
  dscr: 7.75,
  bank_statement: 7.75,
};

const PROPERTY_TYPE_LLPA_PCT: Record<PropertyType, number> = {
  primary: 0.00,
  secondary: 0.25,
  investment: 0.75,
};

// How a given loan type looks for a matching row in the live-rate feed.
// Names mirror Mortgage News Daily labels used by the scraper.
const LOAN_TYPE_RATE_LOOKUP: Record<LoanType, { names: string[]; types: string[] }> = {
  conventional:   { names: ["30 Yr. Fixed"], types: ["Conventional"] },
  fha:            { names: ["30 Yr. FHA"],   types: ["FHA"] },
  va:             { names: ["30 Yr. VA"],    types: ["VA"] },
  dscr:           { names: [],               types: [] },
  bank_statement: { names: [],               types: [] },
};

const NON_QM_ADDON_OVER_CONV_PCT = 0.85;

/** Credit score adjustment for
 *  Conventional, DSCR, Bank Statement. */
function convCreditAdj(
  score: number
): number {
  if (score >= 780) return -0.10;
  if (score >= 760) return  0;
  if (score >= 740) return  0.05;
  if (score >= 720) return  0.20;
  if (score >= 700) return  0.30;
  if (score >= 680) return  0.55;
  if (score >= 660) return  0.75;
  if (score >= 640) return  1.00;
  return 1.50;
}

/** Credit score adjustment for
 *  FHA, VA, USDA. */
function govtCreditAdj(
  score: number
): number {
  if (score >= 740) return -0.350;
  if (score >= 720) return -0.150;
  if (score >= 700) return  0;
  if (score >= 680) return  0.05;
  if (score >= 660) return  0.50;
  if (score >= 640) return  0.900;
  return 1.250;
}

export function creditScoreAdjustmentPct(
  score?: number | null,
  loanType?: string | null,
): number {
  if (!score || score <= 0) return 0;
  if (
    loanType === "fha" ||
    loanType === "va"
  ) {
    return govtCreditAdj(score);
  }
  return convCreditAdj(score);
}

/** Resolves the base rate (%) for a loan type from the live-rate
 *  snapshot, falling back to the hardcoded table when no live row
 *  matches. */
export function getBaseRatePctForLoanType(rates: LiveRate[], loanType: LoanType): number {
  const lookup = LOAN_TYPE_RATE_LOOKUP[loanType];
  for (const name of lookup.names) {
    const m = rates.find(r => r.name === name);
    if (m) return m.rate;
  }
  for (const type of lookup.types) {
    const m = rates.find(r => r.type === type);
    if (m) return m.rate;
  }
  if (loanType === "dscr" || loanType === "bank_statement") {
    const conv = rates.find(r => r.name === "30 Yr. Fixed")
      ?? rates.find(r => r.type === "Conventional");
    if (conv) return conv.rate + NON_QM_ADDON_OVER_CONV_PCT;
  }
  return FALLBACK_BASE_RATES_PCT[loanType];
}

export interface PricingInputs {
  loanType: LoanType;
  creditScore?: number | null;
  propertyType: PropertyType;
  liveRates: LiveRate[];
  loanAmount?: number | null;
}

export interface PricingResult {
  /** Final blended rate in % (e.g. 6.95 means 6.95%). */
  rate: number;
  baseRate: number;
  creditAdj: number;
  occupancyAdj: number;
  /** False for loan types where dedicated pricing is not yet wired
   *  (DSCR, Bank Statement). UI should surface a warning. */
  pricingConnected: boolean;
  loanAmountAdj: number;
}

/** Round a percentage rate to the nearest 3 decimal places. Used by
 *  the rate engine so both payment math and the displayed rate share
 *  the same value (prevents 6.774999%-style float artifacts). */
export function roundRateToThreeDecimals(rate: number): number {
  return Math.round(Number(rate) * 1000) / 1000;
}

/** Canonical display formatter — always 3 decimal places + `%`. */
export function formatRate(rate: number): string {
  return `${roundRateToThreeDecimals(rate).toFixed(3)}%`;
}

/** Canonical pricing call used by both Purchase and Refinance flows. */
export function priceLoan(inputs: PricingInputs): PricingResult {
  const { loanType, creditScore, propertyType, liveRates } = inputs;
  const baseRate    = getBaseRatePctForLoanType(liveRates, loanType);
  const creditAdj   = creditScoreAdjustmentPct(creditScore, loanType);
  const occupancyAdj = PROPERTY_TYPE_LLPA_PCT[propertyType];
  // Conventional-only pricing concession: drop the final Conventional
  // rate by 10 bps (0.100%). Applied once here in the shared engine
  // so it can never be double-applied. FHA / VA / USDA / DSCR /
  // Bank Statement are untouched.
  const conventionalAdj = loanType === "conventional" ? -0.1 : 0;
  const { loanAmount } = inputs;
  const loanAmountAdj =
    (loanAmount && loanAmount > 0 && loanAmount < 250_000)
      ? 0.25
      : 0;
  const rate = roundRateToThreeDecimals(baseRate + creditAdj + occupancyAdj + conventionalAdj + loanAmountAdj);

  // Temporary debug logs — see spec request.
  // Property value / loan amount / LTV are not pricing inputs in the
  // current engine (LTV LLPAs are not implemented yet) — see spec
  // "Do not invent new pricing rules". The downstream caller
  // (calculateRefinance) logs those values when computing payment.

  return {
    rate,
    baseRate,
    creditAdj,
    occupancyAdj,
    pricingConnected: loanType !== "dscr" && loanType !== "bank_statement",
    loanAmountAdj,
  };
}
