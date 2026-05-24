// AMI-based Conventional rate discount for Purchase with Loan.
//
// Spec (only applies when Property Use = Primary AND Loan Type = Conventional):
//   - annual income <  80% of county AMI         → -0.500%
//   - annual income >= 80% AND <= 100% of AMI    → -0.250%
//   - annual income >  100% of AMI               → 0
//   - county AMI missing                         → 0 (reason returned)
//
// The discount is applied AFTER the existing Conventional -0.100%
// concession in `fullRate()` (see estimate.tsx). Because all rate
// recomputes flow through that single engine, the discount is
// applied exactly once — Page 3 and Page 4 stay in sync
// automatically.
//
// NOT applied to: FHA, VA, USDA, DSCR, Bank Statement,
// Investment, Secondary, Refinance, Cash Buy, Insurance, Sell.
// Those flows either don't call `fullRate` or pass non-Conventional
// loan types, so guarding here is sufficient.

export type AmiDiscountResult = {
  eligible: boolean;
  /** 0, 0.25, or 0.5 — in **percentage points** to subtract from the rate. */
  discountPercent: 0 | 0.25 | 0.5;
  incomePercentOfAmi: number | null;
  reason: string;
};

export function getConventionalAmiRateDiscount(params: {
  monthlyIncome: number | null | undefined;
  /** Annual AMI for the property's county, from /api/ami. */
  annualAMI: number | null | undefined;
  loanType: string | null | undefined;
  occupancy: "primary" | "secondary" | "investment" | null | undefined;
}): AmiDiscountResult {
  const { monthlyIncome, annualAMI, loanType, occupancy } = params;

  if (loanType !== "conventional") {
    return { eligible: false, discountPercent: 0, incomePercentOfAmi: null, reason: "Loan type is not Conventional" };
  }
  if (occupancy !== "primary") {
    return { eligible: false, discountPercent: 0, incomePercentOfAmi: null, reason: "Occupancy is not Primary Residence" };
  }
  if (!annualAMI || annualAMI <= 0) {
    return { eligible: false, discountPercent: 0, incomePercentOfAmi: null, reason: "AMI discount unavailable because county AMI could not be determined." };
  }
  if (!monthlyIncome || monthlyIncome <= 0) {
    return { eligible: false, discountPercent: 0, incomePercentOfAmi: null, reason: "Monthly income not entered" };
  }

  const annualIncome = monthlyIncome * 12;
  const pct = (annualIncome / annualAMI) * 100;

  if (pct < 80) {
    return { eligible: true, discountPercent: 0.5, incomePercentOfAmi: pct, reason: "Income is below 80% of county AMI" };
  }
  if (pct <= 100) {
    return { eligible: true, discountPercent: 0.25, incomePercentOfAmi: pct, reason: "Income is between 80% and 100% of county AMI" };
  }
  return { eligible: false, discountPercent: 0, incomePercentOfAmi: pct, reason: "Income is above 100% of county AMI" };
}
