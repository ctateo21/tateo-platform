import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrackedLoanBalance } from "./tracked-loan-balance";

const cdLoan = {
  entryMethod: "closing_disclosure",
  firstPaymentDate: "2026-10-01",
  originalLoanAmount: 669_200,
  originalRate: 6.124,
  originalTermMonths: 360,
  balanceAsOf: undefined,
  addedAt: "2026-08-24",
  loanBalance: 669_200,
  currentRate: 6.124,
  currentPI: 4_065.70,
};

test("shared CD balance resolver holds original balance until first payment", () => {
  const result = resolveTrackedLoanBalance(cdLoan, new Date("2026-09-30T12:00:00"));
  assert.equal(result.elapsedPayments, 0);
  assert.equal(result.currentBalance, 669_200);
});

test("shared CD balance resolver amortizes from first due date, not upload date", () => {
  const result = resolveTrackedLoanBalance(cdLoan, new Date("2026-10-01T12:00:00"));
  assert.equal(result.elapsedPayments, 1);
  assert.ok(result.currentBalance < 669_200);
});