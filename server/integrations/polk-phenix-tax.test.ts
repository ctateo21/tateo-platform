import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parsePolkPhenixBill,
  parsePolkPhenixSearchResults,
  polkPhenixSearchResultMatches,
} from "./polk-phenix-tax";

const expected = {
  county: "Polk",
  situsAddress: "45098 HWY 54",
  situsCity: "LAKELAND",
};

const searchFixture = `
<div id="MainContent_ListView1_PropertyTaxResults_0">
  <a href="PropertyDetail?p=222602-000000-011010&amp;y=2025&amp;b=1000058.0000">
    222602-000000-011010 - ANTENNA LLC
  </a>
  <table><tr><td><i><b>Property Address</b></i><br>45098 HWY 54<br>LAKELAND 33809</td></tr></table>
</div>`;

const billFixture = `
<span id="MainContent_lblAccountBanner">Property Tax Account: <font>222602-000000-011010</font></span>
<span id="MainContent_lblGITaxYearBanner"><b>Year:</b> 2025</span>
<span id="MainContent_lblGIPhysicalAddress"><b>PROPERTY ADDRESS:</b><br>45098 HWY 54<br>LAKELAND 33809</span>
<table id="MainContent_PropertyContainer_tpTaxes_TaxesGrid">
<tr><th>Authority/Fund</th><th>Tax Rate</th><th>Charged</th></tr>
<tr><td>POLK COUNTY</td><td>6.0000</td><td>$1,200.00</td></tr>
<tr><td>SCHOOL GENERAL FUND</td><td>6.9291</td><td>$1,385.82</td></tr>
<tr><td>TOTAL</td><td>12.9291</td><td>$2,585.82</td></tr>
</table>
<table id="MainContent_PropertyContainer_tpTaxes_TaxesNonAdValoremGrid">
<tr><th>Authority/Fund</th><th>Charged</th></tr>
<tr><td>FIRE ASSESSMENT</td><td>$350.00</td></tr>
<tr><td>TOTAL</td><td>$350.00</td></tr>
</table>`;

test("Phenix search associates the exact parcel, street, unit, and city", () => {
  const results = parsePolkPhenixSearchResults(searchFixture);
  assert.equal(results.length, 1);
  assert.equal(
    polkPhenixSearchResultMatches(
      results[0],
      "222602000000011010",
      expected,
    ),
    true,
  );
  assert.equal(
    polkPhenixSearchResultMatches(
      results[0],
      "999999999999999999",
      expected,
    ),
    false,
  );
  assert.equal(
    polkPhenixSearchResultMatches(
      results[0],
      "222602000000011010",
      { ...expected, situsAddress: "45098 HWY 54 UNIT 2" },
    ),
    false,
  );
});

test("Phenix bill parses millage, fixed assessments, and annual total", () => {
  const bill = parsePolkPhenixBill(
    billFixture,
    "222602000000011010",
    expected,
  );
  assert.ok(bill);
  assert.equal(bill.billYear, 2025);
  assert.equal(bill.totalMillage, 12.9291);
  assert.equal(bill.totalAdValorem, 2585.82);
  assert.equal(bill.total, 350);
  assert.deepEqual(bill.lines, [
    { authority: "FIRE ASSESSMENT", amount: 350 },
  ]);
  assert.equal(
    bill.adValoremMills?.find((line) => /SCHOOL/.test(line.authority))?.mills,
    6.9291,
  );
});

test("Phenix bill rejects a different parcel or situs", () => {
  assert.equal(
    parsePolkPhenixBill(billFixture, "999999999999999999", expected),
    null,
  );
  assert.equal(
    parsePolkPhenixBill(
      billFixture,
      "222602000000011010",
      { ...expected, situsCity: "WINTER HAVEN" },
    ),
    null,
  );
  assert.equal(
    parsePolkPhenixBill(
      billFixture.replace(
        "45098 HWY 54<br>LAKELAND 33809",
        "45098 HWY 54 UNIT 2<br>LAKELAND 33809",
      ),
      "222602000000011010",
      expected,
    ),
    null,
  );
});

test("Phenix bill accepts only an explicit non-ad-valorem total, including zero", () => {
  const missingGrid = billFixture.replace(
    /<table id="MainContent_PropertyContainer_tpTaxes_TaxesNonAdValoremGrid">[\s\S]*?<\/table>/,
    "",
  );
  assert.equal(
    parsePolkPhenixBill(
      missingGrid,
      "222602000000011010",
      expected,
    ),
    null,
  );

  const missingTotal = billFixture.replace(
    "<tr><td>TOTAL</td><td>$350.00</td></tr>",
    "",
  );
  assert.equal(
    parsePolkPhenixBill(
      missingTotal,
      "222602000000011010",
      expected,
    ),
    null,
  );

  const explicitZero = billFixture
    .replace("<tr><td>FIRE ASSESSMENT</td><td>$350.00</td></tr>", "")
    .replace("<tr><td>TOTAL</td><td>$350.00</td></tr>", "<tr><td>TOTAL</td><td>$0.00</td></tr>");
  const parsed = parsePolkPhenixBill(
    explicitZero,
    "222602000000011010",
    expected,
  );
  assert.ok(parsed);
  assert.equal(parsed.total, 0);
  assert.deepEqual(parsed.lines, []);
});