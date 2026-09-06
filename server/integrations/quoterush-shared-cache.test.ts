import test from "node:test";
import assert from "node:assert/strict";
import {
  isReusableSharedQuoteCandidate,
  selectReusableSharedQuoteCandidate,
} from "./quoterush-shared-cache";

test("legacy expiration-derived rows are never promoted into the shared cache", () => {
  const privateRow = {
    id: 1,
    agencyDefaultSnapshot: {
      policyEffectiveDate: {
        source: "current-policy-expiration",
        isAssumption: false,
      },
    },
  };
  const sharedRow = {
    id: 2,
    agencyDefaultSnapshot: {
      policyEffectiveDate: {
        source: "user-requested",
        isAssumption: false,
      },
    },
  };

  assert.equal(isReusableSharedQuoteCandidate(privateRow), false);
  assert.equal(
    selectReusableSharedQuoteCandidate([privateRow, sharedRow])?.id,
    2,
  );
});

test("legacy private-scope disclosure also blocks rows with incomplete snapshots", () => {
  const privateRow = {
    id: 1,
    assumptions: [
      "This renewal quote is private to your account because it uses your current policy expiration date.",
    ],
  };

  assert.equal(selectReusableSharedQuoteCandidate([privateRow]), undefined);
});