import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeFromCache,
  isCacheRowValid,
  type PropertyTaxCacheRow,
} from "./property-tax-cache";
import { computePinellasAdValorem } from "./property-tax-service";

const NOW = new Date("2026-08-21T12:00:00.000Z");
const BILL_MILLS = [
  { authority: "PINELLAS COUNTY SCHOOL", mills: 6.293 },
  { authority: "PINELLAS COUNTY GENERAL", mills: 10.25 },
];

test("Pinellas live estimate keeps the assessor just-value floor", () => {
  const purchasePrice = 400_000;
  const purchaseOnly = computePinellasAdValorem({
    purchasePrice,
    justValue: 0,
    isPrimaryResidence: true,
    billMillage: 16.543,
    billMills: BILL_MILLS,
  });
  const assessorFloor = computePinellasAdValorem({
    purchasePrice,
    justValue: 500_000,
    isPrimaryResidence: true,
    billMillage: 16.543,
    billMills: BILL_MILLS,
  });

  const expected =
    Math.round(((500_000 - 25_000) * 6.293) / 1000) +
    Math.round(((500_000 - 51_411) * 10.25) / 1000);
  assert.equal(assessorFloor, expected);
  assert.ok(assessorFloor > purchaseOnly);
});

test("Pinellas effective-rate cache is equivalent only at its sample price", () => {
  const purchasePrice = 400_000;
  const homesteadAdValorem = computePinellasAdValorem({
    purchasePrice,
    justValue: 500_000,
    isPrimaryResidence: true,
    billMillage: 16.543,
    billMills: BILL_MILLS,
  });
  const nonHomesteadAdValorem = computePinellasAdValorem({
    purchasePrice,
    justValue: 500_000,
    isPrimaryResidence: false,
    billMillage: 16.543,
    billMills: BILL_MILLS,
  });
  const row: PropertyTaxCacheRow = {
    county: "pinellas",
    addressNormalized: "1678 LAGO VISTA BLVD, PALM HARBOR, FL 34685",
    addressDisplay: "1678 Lago Vista Blvd, Palm Harbor, FL 34685",
    parcelId: "042816103290001510",
    folio: "042816103290001510",
    taxDistrict: "pinellas",
    homesteadAdValoremPct: homesteadAdValorem / purchasePrice,
    nonHomesteadAdValoremPct: nonHomesteadAdValorem / purchasePrice,
    samplePrice: purchasePrice,
    totalMillage: 16.543,
    nonAdValoremAmtCents: 35_336,
    nonAdValoremLines: [{ authority: "Fire Assessment", amount: 353.36 }],
    source: "pinellas-bill-live",
    expiresAt: new Date("2026-11-01T00:00:00.000Z"),
  };

  assert.equal(
    isCacheRowValid(row, purchasePrice, NOW, {
      requireExactSamplePrice: true,
    }),
    true,
  );
  assert.equal(
    computeFromCache(row, purchasePrice, true).adValoremTax,
    homesteadAdValorem,
  );
  assert.equal(
    isCacheRowValid(row, 420_000, NOW, {
      requireExactSamplePrice: true,
    }),
    false,
  );
  // The shared ±20% guardrail remains available for truly linear counties.
  assert.equal(isCacheRowValid(row, 420_000, NOW), true);
});