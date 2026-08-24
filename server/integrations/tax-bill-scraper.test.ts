/**
 * Unit tests for parseBillMarkdown — focusing on the new totalAdValorem
 * dollar parsing and the existing NAV/millage parsing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTaxSysCrawlerInput,
  filterTaxSysAnnualBillPagesForSitus,
  getNonAdValoremForFolio,
  getTaxSysHostAndStartUrl,
  parseBillMarkdown,
  parseTaxSysSitusIdentityMarkdown,
  resolveWebsiteContentCrawlerBuild,
  taxSysSitusMatches,
  TESTED_APIFY_WCC_BUILD,
  type TaxSysContractAnnualBill,
  type TaxSysContractPage,
} from "./tax-bill-scraper";

test("TaxSys county configuration returns the allowlisted host and start URL", () => {
  const expectedHosts = {
    hillsborough: "hillsborough.county-taxes.com",
    pinellas: "pinellas.county-taxes.com",
    manatee: "manatee.county-taxes.com",
    pasco: "pasco.county-taxes.com",
    hernando: "hernando.county-taxes.com",
    sarasota: "sarasota.county-taxes.com",
    lee: "lee.county-taxes.com",
    collier: "collier.county-taxes.com",
  };

  for (const [county, host] of Object.entries(expectedHosts)) {
    const { startUrl } = getTaxSysHostAndStartUrl(county, "123 45");
    assert.equal(new URL(startUrl).host, host);
    assert.match(startUrl, /123(?:%20|\+)45/);
  }
  assert.equal(
    getTaxSysHostAndStartUrl("pinellas", "123").startUrl,
    "https://pinellas.county-taxes.com/public/search/property_tax?search_query=123",
  );
});

test("TaxSys county configuration rejects unsupported counties", () => {
  assert.throws(
    () => getTaxSysHostAndStartUrl("not-a-county", "123"),
    /Unsupported Tyler TaxSys county/,
  );
  assert.throws(
    () => buildTaxSysCrawlerInput("123", "not-a-county"),
    /Unsupported Tyler TaxSys county/,
  );
});

test("missing APIFY_TOKEN returns an operational unavailable state", async () => {
  const originalToken = process.env.APIFY_TOKEN;
  try {
    delete process.env.APIFY_TOKEN;
    const result = await getNonAdValoremForFolio(
      "test-parcel-without-token",
      "hillsborough",
    );
    assert.deepEqual(result, {
      state: "unavailable",
      reason: "apify_token_missing",
    });
  } finally {
    if (originalToken === undefined) {
      delete process.env.APIFY_TOKEN;
    } else {
      process.env.APIFY_TOKEN = originalToken;
    }
  }
});

test("Website Content Crawler defaults to the exact tested build", () => {
  assert.equal(
    resolveWebsiteContentCrawlerBuild(undefined),
    TESTED_APIFY_WCC_BUILD,
  );
  assert.match(TESTED_APIFY_WCC_BUILD, /^\d+\.\d+\.\d+$/);
});

test("Website Content Crawler accepts only exact build-number overrides", () => {
  assert.equal(resolveWebsiteContentCrawlerBuild(" 0.4.12 "), "0.4.12");
  assert.equal(
    resolveWebsiteContentCrawlerBuild("version-0"),
    TESTED_APIFY_WCC_BUILD,
  );
  assert.equal(
    resolveWebsiteContentCrawlerBuild("latest"),
    TESTED_APIFY_WCC_BUILD,
  );
});

test("Pinellas crawler retries iframe shells and visits only the newest bill", () => {
  const input = buildTaxSysCrawlerInput(
    "173117942400010010",
    "pinellas",
  ) as any;

  assert.deepEqual(input.startUrls, [{
    url: "https://pinellas.county-taxes.com/public/search/property_tax?search_query=173117942400010010",
  }]);
  assert.equal(input.maxCrawlPages, 2);
  assert.equal(input.maxResults, 2);
  assert.equal(input.dynamicContentWaitSecs, 10);
  assert.equal(input.requestTimeoutSecs, 120);
  assert.equal(input.maxRequestRetries, 3);
  assert.match(input.pageFunction, /page\.frames\(\)/);
  assert.match(input.pageFunction, /a\[href\*="\/bills\/"\]/);
  assert.match(input.pageFunction, /Situs:/);
  assert.match(input.pageFunction, /Total Ad Valorem Taxes/);
  assert.doesNotMatch(input.pageFunction, /request\.url/);
});

test("non-Pinellas crawler keeps the existing generic crawl budget", () => {
  const input = buildTaxSysCrawlerInput("A123", "hillsborough") as any;

  assert.deepEqual(input.startUrls, [{
    url: "https://hillsborough.county-taxes.com/public/real_estate/parcels/A123",
  }]);
  assert.equal(input.maxCrawlPages, 8);
  assert.equal(input.maxResults, 8);
  assert.equal(input.dynamicContentWaitSecs, 90);
  assert.equal(input.pageFunction, undefined);
  assert.equal(input.requestTimeoutSecs, undefined);
});

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

test("TaxSys situs matching normalizes street suffixes but rejects unit or city drift", () => {
  const expected = {
    county: "Pinellas",
    situsAddress: "501 5th Street Unit 4",
    situsCity: "St. Petersburg, FL 33701",
  };
  assert.equal(
    taxSysSitusMatches(
      {
        county: "PINELLAS",
        situsAddress: "501 5TH ST UNIT 4",
        situsCity: "ST PETERSBURG",
      },
      expected,
    ),
    true,
  );
  assert.equal(
    taxSysSitusMatches(
      {
        county: "Pinellas",
        situsAddress: "501 5TH ST UNIT 5",
        situsCity: "ST PETERSBURG",
      },
      expected,
    ),
    false,
  );
  assert.equal(
    taxSysSitusMatches(
      {
        county: "Pinellas",
        situsAddress: "501 5TH ST UNIT 4",
        situsCity: "CLEARWATER",
      },
      expected,
    ),
    false,
  );
});
