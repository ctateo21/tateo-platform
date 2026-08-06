// ─── 2026 loan limits ────────────────────────────────────────────────
// Sources (published Nov/Dec 2025, effective Jan 1 2026):
// - FHFA baseline conforming loan limit (one-unit): $832,750
//   https://www.fhfa.gov/news/news-release/fhfa-announces-conforming-loan-limit-values-for-2026
// - FHA "floor" limit (one-unit, low-cost areas — applies to most FL
//   counties): $541,287 (65% of the conforming baseline)
//   https://www.hud.gov/news/hud-no-25-145 (Mortgagee Letter 2025-23)
//
// Limits apply to the BASE loan amount (before financed FHA UFMIP /
// VA funding fee), which is how the programs measure them.

export const CONFORMING_LOAN_LIMIT_2026 = 832_750;
export const FHA_FLOOR_LIMIT_2026 = 541_287;

export type LimitCheckResult =
  | { exceeded: false }
  | {
      exceeded: true;
      /** loan type whose limit was exceeded */
      from: string;
      /** the loan type to auto-switch to */
      to: "conventional" | "jumbo";
      limit: number;
      /** user-facing program label for the exceeded limit */
      limitLabel: string;
    };

/**
 * Check the base loan amount against the program limit for the current
 * loan type and say what to flip to.
 *  - FHA over the FHA floor → Conventional
 *  - Conventional (and DSCR / Bank Statement, which follow conventional
 *    pricing) over the conforming limit → Jumbo
 *  - VA: no loan limit with full entitlement — never flagged
 *  - USDA: income-based, no set loan limit — never flagged
 *  - Jumbo: no upper limit
 */
export function checkLoanLimit(
  loanType: string,
  baseLoanAmount: number,
): LimitCheckResult {
  if (loanType === "fha" && baseLoanAmount > FHA_FLOOR_LIMIT_2026) {
    return {
      exceeded: true,
      from: "fha",
      to: "conventional",
      limit: FHA_FLOOR_LIMIT_2026,
      limitLabel: "2026 FHA loan limit (Florida)",
    };
  }
  if (loanType === "conventional" && baseLoanAmount > CONFORMING_LOAN_LIMIT_2026) {
    return {
      exceeded: true,
      from: "conventional",
      to: "jumbo",
      limit: CONFORMING_LOAN_LIMIT_2026,
      limitLabel: "2026 conforming loan limit",
    };
  }
  return { exceeded: false };
}

/** Jumbo → Conventional when the loan shrinks back under the
 *  conforming limit (silent downgrade — no popup needed). */
export function canDowngradeFromJumbo(loanType: string, baseLoanAmount: number): boolean {
  return loanType === "jumbo" && baseLoanAmount <= CONFORMING_LOAN_LIMIT_2026;
}
