import assert from "node:assert/strict";
import test from "node:test";
import { isCdPurchasePriceLocked } from "./cd-property-value";

test("Closing Disclosure purchase price is locked against automatic value sync", () => {
  assert.equal(isCdPurchasePriceLocked({
    entryMethod: "closing_disclosure",
    originalPurchasePrice: 836_500,
  }), true);
  assert.equal(isCdPurchasePriceLocked({
    entryMethod: "statement",
    originalPurchasePrice: 836_500,
  }), false);
});