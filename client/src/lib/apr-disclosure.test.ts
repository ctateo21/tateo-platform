import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatAprParenthetical,
  formatInterestRateLabel,
} from "./apr-disclosure";

test("purchase APR disclosure uses the required wording and three decimals", () => {
  assert.equal(
    formatAprParenthetical(7.47),
    "(APR 7.470% - includes applicable fees)",
  );
  assert.equal(
    formatInterestRateLabel(7.47),
    "Interest Rate (APR 7.470% - includes applicable fees)",
  );
});