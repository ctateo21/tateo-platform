import assert from "node:assert/strict";
import { test } from "node:test";
import { currentTaxBillRequestSchema } from "./current-tax-contract";

test("current-tax contract accepts only an address", () => {
  assert.deepEqual(
    currentTaxBillRequestSchema.parse({
      address: "8111 High Oaks Trl, Myakka City, FL 34251",
    }),
    { address: "8111 High Oaks Trl, Myakka City, FL 34251" },
  );
});

test("current-tax contract rejects purchase-price inputs", () => {
  const result = currentTaxBillRequestSchema.safeParse({
    address: "8111 High Oaks Trl, Myakka City, FL 34251",
    purchasePrice: 500_000,
  });
  assert.equal(result.success, false);
});

test("current-tax contract rejects home-value inputs", () => {
  const result = currentTaxBillRequestSchema.safeParse({
    address: "8111 High Oaks Trl, Myakka City, FL 34251",
    estimatedHomeValue: 650_000,
  });
  assert.equal(result.success, false);
});