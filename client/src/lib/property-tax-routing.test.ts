import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPropertyTaxRoutePlan,
  type OtherSupportedCounty,
} from "./property-tax-routing";

function countyRoute(county: OtherSupportedCounty) {
  return [{
    kind: "county" as const,
    url: "/api/property-tax/county" as const,
    county,
  }];
}

test("shared Hillsborough/Pasco ZIP falls through to Pasco after HCPA rejection", () => {
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "100 Main St, Zephyrhills, FL 33540",
    ),
    [
      {
        kind: "hillsborough",
        url: "/api/property-tax/hillsborough",
      },
      {
        kind: "county",
        url: "/api/property-tax/county",
        county: "pasco",
      },
    ],
  );
});

test("unambiguous Hillsborough address uses only HCPA", () => {
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "100 Main St, Tampa, FL 33602",
    ),
    [
      {
        kind: "hillsborough",
        url: "/api/property-tax/hillsborough",
      },
    ],
  );
});

test("non-Hillsborough supported county skips HCPA", () => {
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "100 Main St, Clearwater, FL 33755",
    ),
    [
      {
        kind: "county",
        url: "/api/property-tax/county",
        county: "pinellas",
      },
    ],
  );
});

const zipFirstCases: Array<{
  county: OtherSupportedCounty;
  zip: string;
}> = [
  { county: "manatee", zip: "34205" },
  { county: "pinellas", zip: "33755" },
  { county: "pasco", zip: "34652" },
  { county: "sarasota", zip: "34236" },
  { county: "hernando", zip: "34601" },
  { county: "lee", zip: "33901" },
  { county: "collier", zip: "34102" },
  { county: "polk", zip: "33801" },
];

for (const { county, zip } of zipFirstCases) {
  test(`${county} routing uses its authoritative situs ZIP`, () => {
    assert.deepEqual(
      buildPropertyTaxRoutePlan(
        `100 Main St, Orlando, FL ${zip}`,
      ),
      countyRoute(county),
    );
  });
}

test("ZIP routing wins when the city name belongs to another county", () => {
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "100 Main St, Clearwater, FL 34205",
    ),
    countyRoute("manatee"),
  );
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "100 Main St, Bradenton, FL 33755",
    ),
    countyRoute("pinellas"),
  );
});

test("ZIP+4 routes by its five-digit ZIP", () => {
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "100 Main St, Fort Myers, FL 33901-1234",
    ),
    countyRoute("lee"),
  );
});

test("a present but unsupported ZIP does not fall back to city matching", () => {
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "100 Main St, Clearwater, FL 99999",
    ),
    [],
  );
});

test("a supported five-digit street number is not mistaken for a ZIP", () => {
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "34205 Main St, Clearwater, FL",
    ),
    countyRoute("pinellas"),
  );
});

test("an unsupported five-digit street number still allows city fallback", () => {
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "99999 Main St, Clearwater, FL",
    ),
    countyRoute("pinellas"),
  );
});

test("shared ZIPs use city to select a strict parcel-backed county route", () => {
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "100 Main St, Sarasota, FL 34240",
    ),
    countyRoute("sarasota"),
  );
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "100 Main St, Naples, FL 34110",
    ),
    countyRoute("collier"),
  );
  assert.deepEqual(
    buildPropertyTaxRoutePlan(
      "100 Main St, Holiday, FL 34690",
    ),
    countyRoute("pasco"),
  );
});

test("shared ZIP without unique city evidence remains conservative", () => {
  assert.deepEqual(
    buildPropertyTaxRoutePlan("100 Main St, Unknown, FL 34110"),
    [],
  );
});

const ziplessFallbackCases: Array<{
  county: OtherSupportedCounty;
  address: string;
}> = [
  { county: "manatee", address: "100 Main St, Bradenton, FL" },
  { county: "pinellas", address: "100 Main St, Clearwater, FL" },
  { county: "pasco", address: "100 Main St, New Port Richey, FL" },
  { county: "sarasota", address: "100 Main St, Sarasota, FL" },
  { county: "hernando", address: "100 Main St, Brooksville, FL" },
  { county: "lee", address: "100 Main St, Fort Myers, FL" },
  { county: "collier", address: "100 Main St, Naples, FL" },
  { county: "polk", address: "100 Main St, Lakeland, FL" },
];

for (const { county, address } of ziplessFallbackCases) {
  test(`${county} keeps city fallback when no ZIP is present`, () => {
    assert.deepEqual(
      buildPropertyTaxRoutePlan(address),
      countyRoute(county),
    );
  });
}