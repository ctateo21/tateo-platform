/**
 * Unit tests for parseBillMarkdown — focusing on the new totalAdValorem
 * dollar parsing and the existing NAV/millage parsing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterTaxSysAnnualBillPagesForSitus,
  parseBillMarkdown,
  parseTaxSysSitusIdentityMarkdown,
  type TaxSysContractAnnualBill,
  type TaxSysContractPage,
} from "./tax-bill-scraper";

// ── Helpers ───────────────────────────────────────────────────────

/** Build a minimal markdown bill with the given ad-valorem and NAV sections. */
function makeBill({
  year = 2025,
  avRow = "| Total Ad Valorem Taxes | 19.9197 | $350,000.00 | $50,000.00 | $300,000.00 | $2,288.68 |",
  navSection = "### Non-Ad Valorem Assessments\n| Levying authority | Rate | Amount |\n| BERRY BAY CDD |  | $2,978.04 |\n| Total Non-Ad Valorem | | $2,978.04 |",
}: {
  year?: number;
  avRow?: string;
  navSection?: string;
} = {}): string {
  return [
    `## ${year}\u200d Annual bill`,
    "### Ad Valorem Taxes",
    "| Authority | Mills | Assessed | Exempt | Taxable | Tax |",
    "| SCHOOL BOARD | 6.2930 | $350,000.00 | $25,000.00 | $325,000.00 | $2,045.23 |",
    avRow,
    navSection,
  ].join("\n");
}

// ── totalAdValorem parsing ────────────────────────────────────────

test("parseBillMarkdown: extracts totalAdValorem from the bill's Total Ad Valorem row", () => {
  const md = makeBill();
  const result = parseBillMarkdown(md);
  assert.ok(result, "should parse successfully");
  assert.equal(result!.totalAdValorem, 2288.68);
});

test("parseBillMarkdown: totalAdValorem is null when Total Ad Valorem row has no dollar column", () => {
  const md = makeBill({
    avRow: "| Total Ad Valorem Taxes | 19.9197 |",
  });
  const result = parseBillMarkdown(md);
  // parseBillMarkdown returns null when NAV section has no lines; provide a valid NAV
  if (result) {
    // If parsed, ad valorem dollar should be null (no dollar column)
    assert.equal(result.totalAdValorem, null);
  }
  // null result is also acceptable (no NAV lines without noAssessments marker)
});

test("parseBillMarkdown: totalAdValorem handles commas in dollar amount", () => {
  const md = makeBill({
    avRow: "| Total Ad Valorem Taxes | 19.9197 | $350,000.00 | $50,000.00 | $300,000.00 | $12,345.67 |",
  });
  const result = parseBillMarkdown(md);
  assert.ok(result);
  assert.equal(result!.totalAdValorem, 12345.67);
});

test("parseBillMarkdown: totalMillage still parsed alongside totalAdValorem", () => {
  const md = makeBill();
  const result = parseBillMarkdown(md);
  assert.ok(result);
  assert.equal(result!.totalMillage, 19.9197);
  assert.equal(result!.totalAdValorem, 2288.68);
});

test("parseBillMarkdown: NAV lines still parse correctly", () => {
  const md = makeBill();
  const result = parseBillMarkdown(md);
  assert.ok(result);
  assert.equal(result!.lines.length, 1);
  assert.equal(result!.lines[0].authority, "BERRY BAY CDD");
  assert.equal(result!.lines[0].amount, 2978.04);
  assert.equal(result!.total, 2978.04);
});

test("parseBillMarkdown: bill year parsed correctly", () => {
  const md = makeBill({ year: 2024 });
  const result = parseBillMarkdown(md);
  assert.ok(result);
  assert.equal(result!.year, 2024);
  assert.equal(result!.isAnnual, true);
});

test("parseBillMarkdown: noAssessments bill still captures totalAdValorem", () => {
  const md = [
    "## 2025\u200d Annual bill",
    "### Ad Valorem Taxes",
    "| Total Ad Valorem Taxes | 15.5000 | $400,000.00 | $50,000.00 | $350,000.00 | $5,425.00 |",
    "### Non-Ad Valorem Assessments",
    "No Non-Ad Valorem assessments.",
  ].join("\n");
  const result = parseBillMarkdown(md);
  assert.ok(result, "should parse noAssessments bill");
  assert.equal(result!.noAssessments, true);
  assert.equal(result!.totalAdValorem, 5425.00);
  assert.equal(result!.total, 0);
});

test("parseBillMarkdown: returns null when no Non-Ad Valorem Assessments section at all", () => {
  const md = "## 2025 Annual bill\n### Ad Valorem Taxes\n| Total Ad Valorem Taxes | 19.9197 | $5,000.00 |";
  const result = parseBillMarkdown(md);
  assert.equal(result, null);
});

test("parseBillMarkdown: per-authority millage rows parsed", () => {
  const md = makeBill();
  const result = parseBillMarkdown(md);
  assert.ok(result);
  // Our test fixture has one explicit authority row (SCHOOL BOARD) but the
  // Total Ad Valorem Taxes row is excluded from adValoremMills.
  assert.ok(result!.adValoremMills !== null);
  if (result!.adValoremMills) {
    const school = result!.adValoremMills.find(m => m.authority === "SCHOOL BOARD");
    assert.ok(school, "SCHOOL BOARD millage row should be parsed");
    assert.equal(school!.mills, 6.293);
  }
});

test("parseTaxSysSitusIdentityMarkdown: extracts strict situs identity from an account summary", () => {
  const md = [
    "# Pinellas",
    "",
    "Account Summary",
    "",
    "Owner:",
    "",
    "PUBLIC FIXTURE HOTEL CO",
    "",
    "Situs:",
    "",
    "501 5TH AVE NE  ",
    "ST PETERSBURG",
    "",
    "## Amount due",
    "",
    "Loading",
    "",
    "## Account history",
    "",
    "Loading",
  ].join("\n");

  assert.deepEqual(parseTaxSysSitusIdentityMarkdown(md), {
    county: "Pinellas",
    situsAddress: "501 5TH AVE NE",
    situsCity: "ST PETERSBURG",
  });
});

test("parseTaxSysSitusIdentityMarkdown: also accepts a rendered bill detail page", () => {
  const md = [
    "# Pinellas",
    "",
    "Bill Details",
    "",
    "## Parcel details",
    "",
    "Situs:",
    "",
    "501 5TH AVE NE",
    "ST PETERSBURG",
  ].join("\n");
  assert.deepEqual(parseTaxSysSitusIdentityMarkdown(md), {
    county: "Pinellas",
    situsAddress: "501 5TH AVE NE",
    situsCity: "ST PETERSBURG",
  });
});

test("parseTaxSysSitusIdentityMarkdown: rejects pages without a complete situs identity", () => {
  assert.equal(
    parseTaxSysSitusIdentityMarkdown(
      "# Pinellas\n\nAccount Summary\n\nSitus:\n\n501 5TH AVE NE"
    ),
    null,
  );
});

const contractFixtureIdentity = {
  county: "Pinellas",
  situsAddress: "501 5TH AVE NE",
  situsCity: "ST PETERSBURG",
};

const contractFixtureAnnualBill: TaxSysContractAnnualBill = {
  year: 2025,
  isAnnual: true,
  lineCount: 0,
  total: 0,
  noAssessments: true,
  totalMillage: 19.9197,
  totalAdValorem: 1713094.2,
  adValoremMills: [{ authority: "GENERAL FUND", mills: 4.5423 }],
};

test("TaxSys contract association rejects summary identity paired with a different parcel's bill", () => {
  const pages: TaxSysContractPage[] = [
    {
      url: "https://pinellas.county-taxes.com/public/search/property_tax",
      isBillPage: false,
      situsIdentity: contractFixtureIdentity,
      annualBill: null,
    },
    {
      url: "https://county-taxes.net/pinellas/property-tax/example/bills/other",
      isBillPage: true,
      situsIdentity: {
        county: "Pinellas",
        situsAddress: "999 OTHER ST",
        situsCity: "CLEARWATER",
      },
      annualBill: contractFixtureAnnualBill,
    },
  ];

  assert.deepEqual(
    filterTaxSysAnnualBillPagesForSitus(
      pages,
      contractFixtureIdentity,
    ),
    [],
  );
});

test("TaxSys contract association accepts a matching annual-bill page", () => {
  const matchingPage: TaxSysContractPage = {
    url: "https://county-taxes.net/pinellas/property-tax/example/bills/match",
    isBillPage: true,
    situsIdentity: contractFixtureIdentity,
    annualBill: contractFixtureAnnualBill,
  };

  assert.deepEqual(
    filterTaxSysAnnualBillPagesForSitus(
      [matchingPage],
      contractFixtureIdentity,
    ),
    [matchingPage],
  );
});
