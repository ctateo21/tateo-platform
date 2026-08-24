import assert from "node:assert/strict";
import test from "node:test";
import { mergeStatementRefresh } from "./refinance-statement-refresh";

test("statement re-upload persists a newly extracted current escrow balance", () => {
  const existing = { id: "loan-1", loanNumber: "OLD-1" };
  const refreshed = mergeStatementRefresh(existing, {
    loanNumber: "NEW-2",
    currentEscrowBalance: 3_425.17,
  });
  assert.deepEqual(refreshed, {
    id: "loan-1",
    loanNumber: "NEW-2",
    currentEscrowBalance: 3_425.17,
  });
});

test("statement re-upload never erases a known escrow balance with a missing extraction", () => {
  const existing = {
    id: "loan-1",
    loanNumber: "KNOWN-1",
    currentEscrowBalance: 2_100,
  };
  assert.deepEqual(
    mergeStatementRefresh(existing, {
      loanNumber: null,
      currentEscrowBalance: null,
    }),
    existing,
  );
});