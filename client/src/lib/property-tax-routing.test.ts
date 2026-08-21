import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPropertyTaxRoutePlan } from "./property-tax-routing";

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