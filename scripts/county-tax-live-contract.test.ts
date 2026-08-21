/**
 * Opt-in live contract checks for county property-tax providers.
 *
 * Deliberately lives outside the normal unit-test globs. Run explicitly with:
 *   npm run test:live:county-tax
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lookupManateeParcel,
  lookupPinellasParcel,
} from "../server/integrations/county-parcel-lookup";
import {
  filterTaxSysAnnualBillPagesForSitus,
  fetchTaxSysContractSnapshot,
  type TaxSysContractAnnualBill,
  type TaxSysContractPage,
} from "../server/integrations/tax-bill-scraper";

const PINELLAS_FIXTURE = {
  query: "501 5th Ave NE, St Petersburg, FL 33701",
  situsAddress: "501 5TH AVE NE",
  situsCity: "ST PETERSBURG",
} as const;

const MANATEE_FIXTURE = {
  query: "1305 17th St W, Palmetto, FL 34221",
  situsAddress: "1305 17TH ST W",
  situsCity: "PALMETTO",
} as const;

function assertPositiveParcelId(value: string): void {
  assert.match(value, /^\d+$/, "parcel ID must contain only digits");
  assert.ok(BigInt(value) > 0n, "parcel ID must be positive");
}

function hasCompleteAnnualBill(
  bill: TaxSysContractAnnualBill
): boolean {
  return (
    Number.isInteger(bill.year) &&
    (bill.year ?? 0) > 2000 &&
    bill.isAnnual &&
    Number.isFinite(bill.total) &&
    bill.total >= 0 &&
    Number.isFinite(bill.totalMillage) &&
    (bill.totalMillage ?? 0) > 0 &&
    Number.isFinite(bill.totalAdValorem) &&
    (bill.totalAdValorem ?? 0) > 0 &&
    Array.isArray(bill.adValoremMills) &&
    bill.adValoremMills.length > 0
  );
}

test("Pinellas ArcGIS fixture preserves strict parcel identity and shape", async () => {
  const parcel = await lookupPinellasParcel(PINELLAS_FIXTURE.query);
  assert.ok(parcel, "Pinellas fixture did not resolve");
  assert.deepEqual(Object.keys(parcel).sort(), [
    "account",
    "justValue",
    "situsAddress",
    "situsCity",
  ]);
  assert.equal(parcel.situsAddress, PINELLAS_FIXTURE.situsAddress);
  assert.equal(parcel.situsCity, PINELLAS_FIXTURE.situsCity);
  assertPositiveParcelId(parcel.account);
  assert.ok(
    parcel.justValue === null ||
      (Number.isFinite(parcel.justValue) && parcel.justValue > 0),
    "Pinellas just value must be null or a positive number",
  );
});

test(
  "Pinellas TaxSys fixture preserves situs identity and annual bill shape",
  { timeout: 28 * 60_000 },
  async () => {
    assert.ok(
      process.env.APIFY_TOKEN,
      "APIFY_TOKEN is required for the browser-backed TaxSys contract check",
    );

    const expectedIdentity = {
      county: "Pinellas",
      situsAddress: PINELLAS_FIXTURE.situsAddress,
      situsCity: PINELLAS_FIXTURE.situsCity,
    };
    const pages: TaxSysContractPage[] = [];

    // TaxSys renders bill content in an iframe and occasionally captures a
    // transient Loading shell. Match the production scraper's retry budget
    // before treating that as contract drift.
    for (let attempt = 0; attempt < 4; attempt++) {
      const parcel = await lookupPinellasParcel(PINELLAS_FIXTURE.query);
      assert.ok(parcel, "Pinellas fixture did not resolve before TaxSys crawl");
      assertPositiveParcelId(parcel.account);

      const snapshot = await fetchTaxSysContractSnapshot(
        parcel.account,
        "pinellas",
      );
      pages.push(...snapshot.pages);

      const matchingBillPages = filterTaxSysAnnualBillPagesForSitus(
        pages,
        expectedIdentity,
      );
      if (matchingBillPages.some(page =>
        page.annualBill !== null &&
        hasCompleteAnnualBill(page.annualBill)
      )) {
        break;
      }
    }

    assert.ok(
      pages.some(page => page.isBillPage),
      "TaxSys crawl did not reach a bill page",
    );

    const completeMatchingPage =
      filterTaxSysAnnualBillPagesForSitus(
        pages,
        expectedIdentity,
      ).find(page =>
        page.annualBill !== null &&
        hasCompleteAnnualBill(page.annualBill)
      );
    assert.ok(
      completeMatchingPage,
      "TaxSys did not return a complete annual bill with the fixture's own situs after four attempts",
    );
    assert.match(completeMatchingPage.url, /\/bills\//i);
    assert.equal(completeMatchingPage.isBillPage, true);
    assert.deepEqual(
      completeMatchingPage.situsIdentity,
      expectedIdentity,
    );
    assert.deepEqual(Object.keys(completeMatchingPage).sort(), [
      "annualBill",
      "isBillPage",
      "situsIdentity",
      "url",
    ]);
    assert.ok(completeMatchingPage.annualBill);
    assert.deepEqual(
      Object.keys(completeMatchingPage.annualBill).sort(),
      [
        "adValoremMills",
        "isAnnual",
        "lineCount",
        "noAssessments",
        "total",
        "totalAdValorem",
        "totalMillage",
        "year",
      ],
    );
  },
);

test("Manatee ArcGIS fixture preserves strict parcel identity and shape", async () => {
  const parcel = await lookupManateeParcel(MANATEE_FIXTURE.query);
  assert.ok(parcel, "Manatee fixture did not resolve");
  assert.deepEqual(Object.keys(parcel).sort(), [
    "actualBillTotal",
    "actualBillYear",
    "justValue",
    "navCddName",
    "navLines",
    "parid",
    "situsAddress",
    "situsCity",
    "totalNonAdValorem",
  ]);
  assert.equal(parcel.situsAddress, MANATEE_FIXTURE.situsAddress);
  assert.equal(parcel.situsCity, MANATEE_FIXTURE.situsCity);
  assertPositiveParcelId(parcel.parid);
  assert.ok(Number.isFinite(parcel.justValue) && parcel.justValue >= 0);
  assert.ok(
    parcel.navCddName === null || typeof parcel.navCddName === "string",
  );
  assert.ok(Array.isArray(parcel.navLines));
  for (const line of parcel.navLines) {
    assert.deepEqual(Object.keys(line).sort(), ["amount", "authority"]);
    assert.equal(typeof line.authority, "string");
    assert.ok(Number.isFinite(line.amount) && line.amount > 0);
  }
  assert.ok(
    Number.isFinite(parcel.totalNonAdValorem) &&
      parcel.totalNonAdValorem >= 0,
  );
  assert.ok(
    parcel.actualBillYear === null ||
      (Number.isInteger(parcel.actualBillYear) &&
        parcel.actualBillYear > 2000),
  );
  assert.ok(
    parcel.actualBillTotal === null ||
      (Number.isFinite(parcel.actualBillTotal) &&
        parcel.actualBillTotal > 0),
  );
});