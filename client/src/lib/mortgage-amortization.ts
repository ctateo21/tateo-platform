// Shared mortgage amortization helper.
//
// Used by the Sell-Your-Home flow to ESTIMATE a current mortgage
// balance when we have no statement upload and no matching Refinance
// scenario — only the property's last recorded sale price + date.
//
// We deliberately know nothing about the real loan terms, so the
// caller supplies conservative defaults (see the Sell-Your-Home page):
//   originalLoanAmount = last sold price
//   annualInterestRate = 0.065 (6.50%)
//   termYears          = 30
//   loanStartDate      = last sold date
//   asOfDate           = today
//
// This is an ESTIMATE only — it assumes a single fixed-rate loan for
// the full purchase price, no down payment, no extra principal, no
// refinances, no escrow. The UI shows a disclaimer to that effect.

export interface EstimateMortgageBalanceInput {
  /** Principal at origination. The seller flow passes last sold price. */
  originalLoanAmount: number;
  /** Annual fixed rate as a FRACTION (0.065 == 6.50%). */
  annualInterestRate: number;
  /** Loan term in years (e.g. 30). */
  termYears: number;
  /** When the loan started — ISO string or Date (last sold date). */
  loanStartDate: string | Date;
  /** "Now" — ISO string or Date. Defaults to current time. */
  asOfDate?: string | Date;
}

export interface EstimateMortgageBalanceResult {
  /** Estimated remaining principal, clamped to >= 0 and rounded. */
  remainingBalance: number;
  /** Whole months elapsed, clamped to 0..totalPayments. */
  paymentsMade: number;
  /** Fully-amortizing monthly payment for the assumed terms. */
  monthlyPayment: number;
  /** termYears * 12. */
  totalPayments: number;
}

/** Whole calendar months between two dates, floored at 0. Returns NaN
 *  when either date can't be parsed. */
function fullMonthsBetween(start: Date, end: Date): number {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return NaN;
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  // Subtract a month if we haven't reached the same day-of-month yet.
  if (end.getDate() < start.getDate()) months -= 1;
  return months;
}

/**
 * Estimate the remaining balance of a fully-amortizing fixed-rate loan.
 *
 * Standard closed-form remaining-balance formula:
 *   balance = P * [ (1+r)^n − (1+r)^p ] / [ (1+r)^n − 1 ]
 * where P=principal, r=monthly rate, n=total payments, p=payments made.
 * For r == 0 it degrades to straight-line: P * (1 − p/n).
 *
 * Returns remainingBalance == 0 when inputs are unusable (non-positive
 * principal/term, unparseable start date) so the caller can fall back.
 */
export function estimateMortgageBalanceFromSale(
  input: EstimateMortgageBalanceInput,
): EstimateMortgageBalanceResult {
  const {
    originalLoanAmount: P,
    annualInterestRate,
    termYears,
    loanStartDate,
    asOfDate,
  } = input;

  const totalPayments = Math.round(termYears * 12);
  const start = loanStartDate instanceof Date ? loanStartDate : new Date(loanStartDate);
  const end = asOfDate
    ? (asOfDate instanceof Date ? asOfDate : new Date(asOfDate))
    : new Date();

  if (!Number.isFinite(P) || P <= 0 || totalPayments <= 0) {
    return { remainingBalance: 0, paymentsMade: 0, monthlyPayment: 0, totalPayments: Math.max(0, totalPayments) };
  }

  const rawMonths = fullMonthsBetween(start, end);
  // Unparseable date → treat as a brand-new loan (no payments made).
  const monthsElapsed = Number.isNaN(rawMonths) ? 0 : rawMonths;
  const paymentsMade = Math.min(Math.max(monthsElapsed, 0), totalPayments);

  const r = annualInterestRate / 12;
  let monthlyPayment: number;
  let remainingBalance: number;

  if (r === 0) {
    monthlyPayment = P / totalPayments;
    remainingBalance = P * (1 - paymentsMade / totalPayments);
  } else {
    const pow = (x: number) => Math.pow(1 + r, x);
    const n = totalPayments;
    const p = paymentsMade;
    monthlyPayment = (P * (r * pow(n))) / (pow(n) - 1);
    remainingBalance = (P * (pow(n) - pow(p))) / (pow(n) - 1);
  }

  return {
    remainingBalance: Math.max(0, Math.round(remainingBalance)),
    paymentsMade,
    monthlyPayment: Math.round(monthlyPayment),
    totalPayments,
  };
}

/** Default amortization assumptions for the Sell-Your-Home estimate.
 *  Centralized so the resolver, the page, and any test agree. */
export const SELLER_AMORTIZATION_DEFAULTS = {
  annualInterestRate: 0.065,
  termYears: 30,
} as const;
