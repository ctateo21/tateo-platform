import type { FeeLine, FeeSection } from "./fee-worksheet";

export const REFI_PREPAID_INTEREST_DAYS = 15;
export const VA_SUBSEQUENT_USE_FUNDING_FEE_RATE = 0.033;

export function calculateRefinanceVaFundingFee(
  baseLoanAmount: number,
  loanType?: RefinanceFeeWorksheetInputs["loanType"],
  vaDisability?: boolean,
): number {
  return loanType === "va" && vaDisability === false
    ? Math.round(Math.max(0, baseLoanAmount) * VA_SUBSEQUENT_USE_FUNDING_FEE_RATE * 100) / 100
    : 0;
}

export interface RefinanceFeeWorksheetInputs {
  currentPayoff: number;
  baseNewLoanAmount: number;
  finalNewLoanAmount: number;
  ratePct: number;
  monthlyPI: number;
  monthlyEscrow: number;
  escrowReserve: number;
  financeFees: boolean;
  entryMethod?: "statement" | "closing_disclosure" | "manual" | "free_and_clear";
  currentEscrowBalance?: number;
  homeValue?: number;
  annualPropertyTax?: number;
  loanType?: "va" | "fha" | "conventional" | "dscr" | "bank_statement";
  vaDisability?: boolean;
  vaFundingFee?: number;
  creditScore?: number;
  termYears?: number;
}

export interface RefinanceMonthlyHousingExpense {
  principalAndInterest: number;
  homeownersInsurance: number;
  supplementalInsurance: number;
  propertyTaxes: number;
  mortgageInsurance: number | null;
  totalPiti: number | null;
  knownPaymentSubtotal: number;
  requiresProgramConfirmation: boolean;
}

export interface RefinanceFeeWorksheet {
  lenderFees: FeeSection;
  thirdPartyFees: FeeSection;
  governmentFees: FeeSection;
  prepaids: FeeSection;
  totalClosingCosts: number;
  totalPrepaidsAndEscrows: number;
  grossCashOut: number;
  estimatedCashToBorrower: number;
  estimatedCashDueAtClosing: number;
  financedClosingCosts: number;
  financedPrepaidsAndEscrows: number;
  possibleEscrowRefund: number;
  possibleEscrowRefundBasis: "statement_balance" | "two_month_estimate" | "unavailable";
  monthlyHousingExpense: RefinanceMonthlyHousingExpense;
  vaFundingFee: number;
  fundedLtvPct: number | null;
  cashNeededFor80Ltv: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (lines: FeeLine[]) => r2(lines.reduce((total, line) => total + line.amount, 0));

function monthlyPrincipalAndInterest(
  principal: number,
  annualRatePct: number,
  termYears: number,
): number {
  const months = Math.max(1, Math.round(termYears * 12));
  const monthlyRate = Math.max(0, annualRatePct) / 100 / 12;
  if (monthlyRate === 0) return r2(principal / months);
  return r2(principal * monthlyRate * Math.pow(1 + monthlyRate, months)
    / (Math.pow(1 + monthlyRate, months) - 1));
}

export function buildRefinanceFeeWorksheet(
  input: RefinanceFeeWorksheetInputs,
): RefinanceFeeWorksheet {
  const payoff = Math.max(0, input.currentPayoff);
  const baseLoan = Math.max(0, input.baseNewLoanAmount);
  const finalLoan = Math.max(baseLoan, input.finalNewLoanAmount);
  const vaFundingFee = r2(Math.max(
    0,
    input.vaFundingFee
      ?? calculateRefinanceVaFundingFee(baseLoan, input.loanType, input.vaDisability),
  ));

  const lenderLines: FeeLine[] = [
    { label: "Underwriting fee", amount: 1_250 },
    { label: "Processing / administration fee", amount: 795 },
  ];
  const lenderFees: FeeSection = {
    title: "Lender Fees",
    lines: lenderLines,
    subtotal: sum(lenderLines),
  };

  const titlePremium = r2(baseLoan * 0.006);
  const thirdPartyLines: FeeLine[] = [
    { label: "Appraisal", amount: 650 },
    { label: "Credit report", amount: 75 },
    { label: "Flood certification", amount: 20 },
    { label: "Tax service", amount: 85 },
    { label: "Title search", amount: 200 },
    { label: "Settlement / closing fee", amount: 750 },
    {
      label: "Lender's title insurance & endorsements",
      amount: titlePremium,
      note: "estimated at 0.60% of base new loan",
    },
  ];
  const thirdPartyFees: FeeSection = {
    title: "Title & Third-Party Fees",
    lines: thirdPartyLines,
    subtotal: sum(thirdPartyLines),
  };

  const governmentLines: FeeLine[] = [
    {
      label: "Recording and release fees",
      amount: 240,
      note: "estimated; varies by county and documents recorded",
    },
  ];
  if (input.loanType === "va") {
    governmentLines.push({
      label: "VA funding fee",
      amount: vaFundingFee,
      note: input.vaDisability === true
        ? "exempt due to VA disability"
        : input.vaDisability === false
          ? "3.30% subsequent use; financed into new loan"
          : "VA disability answer required",
    });
  }
  const governmentFees: FeeSection = {
    title: "Government Fees",
    lines: governmentLines,
    subtotal: sum(governmentLines),
  };

  const prepaidInterest = r2(
    finalLoan * Math.max(0, input.ratePct) / 100 / 365 * REFI_PREPAID_INTEREST_DAYS,
  );
  const prepaidLines: FeeLine[] = [
    {
      label: "Prepaid interest",
      amount: prepaidInterest,
      note: `${REFI_PREPAID_INTEREST_DAYS} estimated days`,
    },
  ];
  if (input.escrowReserve > 0) {
    prepaidLines.push({
      label: "Initial escrow reserve",
      amount: r2(input.escrowReserve),
      note: input.monthlyEscrow > 0
        ? `${(input.escrowReserve / input.monthlyEscrow).toFixed(0)} months of current escrow estimate`
        : undefined,
    });
  }
  const prepaids: FeeSection = {
    title: "Prepaids & Initial Escrow",
    lines: prepaidLines,
    subtotal: sum(prepaidLines),
  };

  const totalClosingCosts = r2(
    lenderFees.subtotal + thirdPartyFees.subtotal + governmentFees.subtotal,
  );
  const totalPrepaidsAndEscrows = prepaids.subtotal;
  const grossCashOut = r2(Math.max(0, baseLoan - payoff));
  const financedAmountAboveBase = r2(Math.max(0, finalLoan - baseLoan));
  const nonVaClosingCosts = r2(Math.max(0, totalClosingCosts - vaFundingFee));
  const financedClosingCosts = r2(
    vaFundingFee + (input.financeFees
      ? Math.min(nonVaClosingCosts, Math.max(0, financedAmountAboveBase - vaFundingFee))
      : 0),
  );
  const financedPrepaidsAndEscrows = input.financeFees
    ? r2(Math.min(
        totalPrepaidsAndEscrows,
        Math.max(0, financedAmountAboveBase - financedClosingCosts),
      ))
    : 0;
  const borrowerCharges = r2(totalClosingCosts + totalPrepaidsAndEscrows);
  const netBeforeCashOut = r2(financedAmountAboveBase - borrowerCharges);
  const estimatedCashToBorrower = r2(Math.max(0, grossCashOut + netBeforeCashOut));
  const estimatedCashDueAtClosing = r2(Math.max(0, -(grossCashOut + netBeforeCashOut)));
  const explicitEscrowBalance = Number.isFinite(input.currentEscrowBalance)
    && (input.currentEscrowBalance ?? -1) >= 0
    ? r2(input.currentEscrowBalance ?? 0)
    : null;
  const canUseStatementBalance =
    (input.entryMethod === "statement" || input.entryMethod === undefined)
    && explicitEscrowBalance !== null;
  const twoMonthEstimate = r2(Math.max(0, input.monthlyEscrow) * 2);
  const possibleEscrowRefund = canUseStatementBalance
    ? explicitEscrowBalance
    : twoMonthEstimate;
  const possibleEscrowRefundBasis = canUseStatementBalance
    ? "statement_balance" as const
    : twoMonthEstimate > 0
      ? "two_month_estimate" as const
      : "unavailable" as const;

  // Build the proposed PITI on the actual funded note amount. When costs
  // are financed, finalLoan includes closing costs and any selected initial
  // escrow reserve; otherwise finalLoan equals the base loan.
  const principalAndInterest = monthlyPrincipalAndInterest(
    finalLoan,
    input.ratePct,
    input.termYears ?? 30,
  );
  const homeValue = Math.max(0, input.homeValue ?? 0);
  const ltv = homeValue > 0 ? finalLoan / homeValue : 0;
  const fundedLtvPct = homeValue > 0 ? r2(ltv * 100) : null;
  const cashNeededFor80Ltv = homeValue > 0
    ? r2(Math.max(0, finalLoan - homeValue * 0.80))
    : 0;
  const loanType = input.loanType ?? "conventional";
  const creditScore = Math.round(input.creditScore ?? 740);
  let mortgageInsurance: number | null = 0;
  let requiresProgramConfirmation = false;
  if (loanType === "conventional" && ltv > 0.80) {
    let annualFactor: number | null;
    if      (creditScore >= 760) annualFactor = 0.0019;
    else if (creditScore >= 740) annualFactor = 0.0029;
    else if (creditScore >= 720) annualFactor = 0.0036;
    else if (creditScore >= 700) annualFactor = 0.0045;
    else if (creditScore >= 680) annualFactor = 0.0061;
    else if (creditScore >= 660) annualFactor = 0.0098;
    else if (creditScore >= 640) annualFactor = 0.0104;
    else if (creditScore >= 620) annualFactor = 0.0117;
    else annualFactor = null;
    mortgageInsurance = annualFactor === null
      ? null
      : r2(finalLoan * annualFactor / 12);
    requiresProgramConfirmation = annualFactor === null;
  } else if (loanType === "va") {
    mortgageInsurance = 0;
    requiresProgramConfirmation = input.vaDisability === undefined;
  } else if (loanType === "fha"
    || loanType === "dscr" || loanType === "bank_statement") {
    // These programs can have financed upfront/funding charges or
    // product-specific insurance that the refi tracker does not collect
    // enough inputs to price reliably.
    mortgageInsurance = null;
    requiresProgramConfirmation = true;
  }
  const knownMonthlyTax = (input.annualPropertyTax ?? 0) > 0
    ? r2((input.annualPropertyTax ?? 0) / 12)
    : null;
  const currentEscrowPayment = r2(Math.max(0, input.monthlyEscrow));
  const defaultHomeownersInsurance = homeValue > 0
    ? r2(homeValue * 0.0075 / 12)
    : 0;
  let propertyTaxes: number;
  let homeownersInsurance: number;
  if (currentEscrowPayment > 0 && knownMonthlyTax !== null) {
    propertyTaxes = knownMonthlyTax;
    homeownersInsurance = r2(Math.max(
      0,
      currentEscrowPayment - propertyTaxes,
    ));
  } else if (currentEscrowPayment > 0) {
    homeownersInsurance = r2(Math.min(
      defaultHomeownersInsurance,
      currentEscrowPayment,
    ));
    propertyTaxes = r2(Math.max(
      0,
      currentEscrowPayment - homeownersInsurance,
    ));
  } else {
    propertyTaxes = knownMonthlyTax ?? 0;
    homeownersInsurance = defaultHomeownersInsurance;
  }
  const supplementalInsurance = 0;
  const knownPaymentSubtotal = r2(
    principalAndInterest
    + homeownersInsurance
    + supplementalInsurance
    + propertyTaxes
  );
  const totalPiti = mortgageInsurance === null || requiresProgramConfirmation
    ? null
    : r2(knownPaymentSubtotal + mortgageInsurance);
  const monthlyHousingExpense: RefinanceMonthlyHousingExpense = {
    principalAndInterest,
    homeownersInsurance,
    supplementalInsurance,
    propertyTaxes,
    mortgageInsurance,
    totalPiti,
    knownPaymentSubtotal,
    requiresProgramConfirmation,
  };

  return {
    lenderFees,
    thirdPartyFees,
    governmentFees,
    prepaids,
    totalClosingCosts,
    totalPrepaidsAndEscrows,
    grossCashOut,
    estimatedCashToBorrower,
    estimatedCashDueAtClosing,
    financedClosingCosts,
    financedPrepaidsAndEscrows,
    possibleEscrowRefund,
    possibleEscrowRefundBasis,
    monthlyHousingExpense,
    vaFundingFee,
    fundedLtvPct,
    cashNeededFor80Ltv,
  };
}