import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRefinanceFeeWorksheet,
  calculateRefinanceVaFundingFee,
} from "./refinance-fee-worksheet";

const base = {
  currentPayoff: 300_000,
  baseNewLoanAmount: 300_000,
  finalNewLoanAmount: 305_865,
  ratePct: 6.5,
  monthlyPI: 1_933,
  monthlyEscrow: 500,
  escrowReserve: 0,
  financeFees: true,
  entryMethod: "statement" as const,
  currentEscrowBalance: 2_840.25,
  homeValue: 400_000,
  annualPropertyTax: 4_800,
  loanType: "conventional" as const,
  creditScore: 740,
};

test("refinance itemization matches the calculator's 0.60% + $4,065 closing-cost estimate", () => {
  const worksheet = buildRefinanceFeeWorksheet(base);
  assert.equal(worksheet.totalClosingCosts, 5_865);
});

test("financed rate-and-term costs leave only prepaid interest due when escrows are off", () => {
  const worksheet = buildRefinanceFeeWorksheet(base);
  assert.equal(worksheet.estimatedCashDueAtClosing, worksheet.prepaids.subtotal);
  assert.equal(worksheet.estimatedCashToBorrower, 0);
  assert.equal(worksheet.financedClosingCosts, worksheet.totalClosingCosts);
  assert.equal(
    base.finalNewLoanAmount,
    base.baseNewLoanAmount + worksheet.financedClosingCosts,
  );
});

test("non-financed rate-and-term keeps the base loan unchanged and sends costs to cash due", () => {
  const worksheet = buildRefinanceFeeWorksheet({
    ...base,
    finalNewLoanAmount: base.baseNewLoanAmount,
    financeFees: false,
  });
  assert.equal(worksheet.financedClosingCosts, 0);
  assert.equal(
    worksheet.estimatedCashDueAtClosing,
    worksheet.totalClosingCosts + worksheet.totalPrepaidsAndEscrows,
  );
});

test("cash-out worksheet nets closing charges and prepaids against proceeds", () => {
  const worksheet = buildRefinanceFeeWorksheet({
    ...base,
    baseNewLoanAmount: 350_000,
    finalNewLoanAmount: 356_165,
  });
  assert.equal(worksheet.grossCashOut, 50_000);
  assert.ok(worksheet.estimatedCashToBorrower > 40_000);
  assert.equal(worksheet.estimatedCashDueAtClosing, 0);
});

test("non-financed cash-out subtracts closing costs and prepaid interest from borrower proceeds", () => {
  const worksheet = buildRefinanceFeeWorksheet({
    ...base,
    baseNewLoanAmount: 350_000,
    finalNewLoanAmount: 350_000,
    financeFees: false,
  });
  assert.equal(worksheet.grossCashOut, 50_000);
  assert.equal(
    worksheet.estimatedCashToBorrower,
    worksheet.grossCashOut - worksheet.totalClosingCosts - worksheet.totalPrepaidsAndEscrows,
  );
  assert.equal(worksheet.estimatedCashDueAtClosing, 0);
});

test("financed cash-out with escrow reconciles gross proceeds, charges, net cash, and cash due", () => {
  const baseNewLoanAmount = 350_000;
  const closingCosts = baseNewLoanAmount * 0.006 + 4_065;
  const escrowReserve = 1_500;
  const worksheet = buildRefinanceFeeWorksheet({
    ...base,
    baseNewLoanAmount,
    finalNewLoanAmount: baseNewLoanAmount + closingCosts + escrowReserve,
    escrowReserve,
  });
  assert.equal(worksheet.totalClosingCosts, closingCosts);
  assert.equal(worksheet.grossCashOut, baseNewLoanAmount - base.currentPayoff);
  assert.equal(
    worksheet.estimatedCashToBorrower,
    worksheet.grossCashOut - worksheet.prepaids.lines[0].amount,
  );
  assert.equal(worksheet.estimatedCashDueAtClosing, 0);
});

test("optional escrow reserve appears in prepaids and cash-to-close math", () => {
  const withoutEscrow = buildRefinanceFeeWorksheet(base);
  const withEscrow = buildRefinanceFeeWorksheet({
    ...base,
    finalNewLoanAmount: base.finalNewLoanAmount + 1_500,
    escrowReserve: 1_500,
  });
  assert.deepEqual(withEscrow.prepaids.lines.at(-1), {
    label: "Initial escrow reserve",
    amount: 1_500,
    note: "3 months of current escrow estimate",
  });
  assert.ok(withEscrow.totalPrepaidsAndEscrows > withoutEscrow.totalPrepaidsAndEscrows + 1_500);
  assert.ok(withEscrow.estimatedCashDueAtClosing > withoutEscrow.estimatedCashDueAtClosing);
  assert.ok(withEscrow.estimatedCashDueAtClosing - withoutEscrow.estimatedCashDueAtClosing < 10);
});

test("statement escrow refund uses the explicit current escrow-account balance", () => {
  const worksheet = buildRefinanceFeeWorksheet(base);
  assert.equal(worksheet.possibleEscrowRefund, 2_840.25);
  assert.equal(worksheet.possibleEscrowRefundBasis, "statement_balance");
});

test("Closing Disclosure and manual entries estimate possible refund at two monthly escrow payments", () => {
  for (const entryMethod of ["closing_disclosure", "manual"] as const) {
    const worksheet = buildRefinanceFeeWorksheet({
      ...base,
      entryMethod,
      currentEscrowBalance: undefined,
    });
    assert.equal(worksheet.possibleEscrowRefund, 1_000);
    assert.equal(worksheet.possibleEscrowRefundBasis, "two_month_estimate");
  }
});

test("proposed PITI is built on the funded loan amount and includes tax, insurance, and MI lines", () => {
  const financed = buildRefinanceFeeWorksheet(base);
  const paidAtClose = buildRefinanceFeeWorksheet({
    ...base,
    finalNewLoanAmount: base.baseNewLoanAmount,
    financeFees: false,
  });
  assert.ok(
    financed.monthlyHousingExpense.principalAndInterest
      > paidAtClose.monthlyHousingExpense.principalAndInterest,
  );
  assert.equal(financed.monthlyHousingExpense.propertyTaxes, 400);
  assert.equal(financed.monthlyHousingExpense.mortgageInsurance, 0);
  assert.equal(
    financed.monthlyHousingExpense.totalPiti,
    financed.monthlyHousingExpense.principalAndInterest
      + financed.monthlyHousingExpense.homeownersInsurance
      + financed.monthlyHousingExpense.supplementalInsurance
      + financed.monthlyHousingExpense.propertyTaxes
      + financed.monthlyHousingExpense.mortgageInsurance,
  );
});

test("high-LTV conventional PMI is added to current tax and insurance rather than netted from them", () => {
  const worksheet = buildRefinanceFeeWorksheet({
    ...base,
    homeValue: 350_000,
  });
  assert.ok((worksheet.monthlyHousingExpense.mortgageInsurance ?? 0) > 0);
  assert.equal(worksheet.monthlyHousingExpense.propertyTaxes, 400);
  assert.equal(worksheet.monthlyHousingExpense.homeownersInsurance, 100);
  assert.equal(
    worksheet.monthlyHousingExpense.totalPiti,
    worksheet.monthlyHousingExpense.knownPaymentSubtotal
      + (worksheet.monthlyHousingExpense.mortgageInsurance ?? 0),
  );
});

test("exactly 80% funded LTV has no PMI and no required 80% cash contribution", () => {
  const worksheet = buildRefinanceFeeWorksheet({
    ...base,
    baseNewLoanAmount: 669_200,
    finalNewLoanAmount: 669_200,
    currentPayoff: 669_200,
    homeValue: 836_500,
    financeFees: false,
  });
  assert.equal(worksheet.fundedLtvPct, 80);
  assert.equal(worksheet.monthlyHousingExpense.mortgageInsurance, 0);
  assert.equal(worksheet.cashNeededFor80Ltv, 0);
});

test("financed costs above an 80% CD loan trigger PMI and equal the cash needed to stay at 80%", () => {
  const baseLoan = 669_200;
  const financedCosts = baseLoan * 0.006 + 4_065 + 3_000;
  const worksheet = buildRefinanceFeeWorksheet({
    ...base,
    currentPayoff: baseLoan,
    baseNewLoanAmount: baseLoan,
    finalNewLoanAmount: baseLoan + financedCosts,
    homeValue: 836_500,
    escrowReserve: 3_000,
  });
  assert.ok((worksheet.fundedLtvPct ?? 0) > 80);
  assert.ok((worksheet.monthlyHousingExpense.mortgageInsurance ?? 0) > 0);
  assert.equal(worksheet.cashNeededFor80Ltv, financedCosts);
});

test("FHA charges and unanswered VA disability require loan-officer confirmation", () => {
  const fha = buildRefinanceFeeWorksheet({ ...base, loanType: "fha" });
  assert.equal(fha.monthlyHousingExpense.mortgageInsurance, null);
  assert.equal(fha.monthlyHousingExpense.totalPiti, null);
  assert.equal(fha.monthlyHousingExpense.requiresProgramConfirmation, true);

  const unansweredVa = buildRefinanceFeeWorksheet({ ...base, loanType: "va" });
  assert.equal(unansweredVa.monthlyHousingExpense.mortgageInsurance, 0);
  assert.equal(unansweredVa.monthlyHousingExpense.totalPiti, null);
  assert.equal(unansweredVa.monthlyHousingExpense.requiresProgramConfirmation, true);
});

test("VA disability exemption makes the refinance funding fee zero", () => {
  const worksheet = buildRefinanceFeeWorksheet({
    ...base,
    loanType: "va",
    vaDisability: true,
  });
  assert.equal(worksheet.vaFundingFee, 0);
  assert.equal(
    worksheet.governmentFees.lines.find(line => line.label === "VA funding fee")?.amount,
    0,
  );
  assert.equal(worksheet.monthlyHousingExpense.requiresProgramConfirmation, false);
  assert.ok(worksheet.monthlyHousingExpense.totalPiti !== null);
});

test("non-exempt VA refinance finances the 3.3% subsequent-use fee into the note", () => {
  const vaFundingFee = calculateRefinanceVaFundingFee(300_000, "va", false);
  const worksheet = buildRefinanceFeeWorksheet({
    ...base,
    loanType: "va",
    vaDisability: false,
    vaFundingFee,
    finalNewLoanAmount: base.finalNewLoanAmount + vaFundingFee,
  });
  assert.equal(vaFundingFee, 9_900);
  assert.equal(worksheet.vaFundingFee, 9_900);
  assert.equal(worksheet.totalClosingCosts, 15_765);
  assert.equal(worksheet.financedClosingCosts, worksheet.totalClosingCosts);
  assert.equal(worksheet.estimatedCashDueAtClosing, worksheet.prepaids.subtotal);
  assert.ok(
    worksheet.monthlyHousingExpense.principalAndInterest
      > buildRefinanceFeeWorksheet({
          ...base,
          loanType: "va",
          vaDisability: true,
        }).monthlyHousingExpense.principalAndInterest,
  );
});

test("financed initial escrow increases funded principal and is reflected in P&I", () => {
  const withoutReserve = buildRefinanceFeeWorksheet(base);
  const withReserve = buildRefinanceFeeWorksheet({
    ...base,
    finalNewLoanAmount: base.finalNewLoanAmount + 1_500,
    escrowReserve: 1_500,
  });
  assert.equal(withReserve.financedPrepaidsAndEscrows, 1_500);
  assert.ok(
    withReserve.monthlyHousingExpense.principalAndInterest
      > withoutReserve.monthlyHousingExpense.principalAndInterest,
  );
});