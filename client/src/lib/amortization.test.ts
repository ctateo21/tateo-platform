import assert from "node:assert/strict";
import test from "node:test";
import {
  paymentsMadeFromFirstPaymentDate,
  remainingBalance,
} from "./amortization";

test("CD loan has no amortization before its first payment date", () => {
  const payments = paymentsMadeFromFirstPaymentDate(
    "2026-10-01",
    new Date("2026-08-24T12:00:00"),
  );
  assert.equal(payments, 0);
  assert.equal(remainingBalance(669_200, 6.124, 360, payments), 669_200);
});

test("CD payment count starts on the first due date", () => {
  assert.equal(
    paymentsMadeFromFirstPaymentDate("2026-10-01", new Date("2026-10-01T12:00:00")),
    1,
  );
  assert.equal(
    paymentsMadeFromFirstPaymentDate("2026-10-01", new Date("2026-11-01T12:00:00")),
    2,
  );
});