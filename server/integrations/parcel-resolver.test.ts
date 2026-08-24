import assert from "node:assert/strict";
import { test } from "node:test";
import {
  identifyCountyCandidatesFromAddress,
  identifyCountyFromAddress,
  isStrictParcelAddressMatch,
  resolveParcel,
} from "./parcel-resolver";

test("strict parcel matching requires both exact street/unit and city", () => {
  assert.equal(
    isStrictParcelAddressMatch(
      "7762 Ashton Rd, Naples, FL 34113",
      "7762 Ashton RD, Naples",
      "Naples",
    ),
    true,
  );
  assert.equal(
    isStrictParcelAddressMatch(
      "7762 Ashton Rd, Naples, FL 34113",
      "7764 Ashton RD, Naples",
      "Naples",
    ),
    false,
  );
  assert.equal(
    isStrictParcelAddressMatch(
      "7762 Ashton Rd, Naples, FL 34113",
      "7762 Ashton RD, Naples",
      "Marco Island",
    ),
    false,
  );
});

test("county identification remains conservative for shared ZIPs", () => {
  assert.equal(
    identifyCountyFromAddress("100 Main St, Fort Myers, FL 33901"),
    "lee",
  );
  assert.equal(
    identifyCountyFromAddress("100 Main St, Dade City, FL 33523"),
    null,
  );
  assert.deepEqual(
    identifyCountyCandidatesFromAddress("100 Main St, Dade City, FL 33523"),
    ["hillsborough", "pasco", "hernando"],
  );
});

test("SWFWMD Hernando uses ALTKEY as the TaxSys parcel key", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    assert.match(String(input), /MapServer\/5\/query/);
    const where = new URL(String(input)).searchParams.get("where");
    assert.equal(
      where,
      "SITEADD LIKE '3301 %' AND SCITY='BROOKSVILLE'",
    );
    return new Response(
      JSON.stringify({
        features: [{
          attributes: {
            PARNO: "R-Z APN 19 0000 0310 0030",
            ALTKEY: "1738622",
            SITEADD: "3301  NORTHEAST PKWY",
            SCITY: "BROOKSVILLE",
            PARVAL: 300000,
            ASSD_TOT: 250000,
          },
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const result = await resolveParcel(
    "hernando",
    "3301 Northeast Pkwy, Brooksville, FL 34604",
    { fetchImpl, skipCache: true },
  );
  assert.equal(result.status, "found");
  assert.equal(result.parcelId, "1738622");
  assert.equal(result.folio, "R-Z APN 19 0000 0310 0030");
});

test("Polk parcel identity is resolved through SWFWMD layer 14", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    assert.match(String(input), /MapServer\/14\/query/);
    return new Response(
      JSON.stringify({
        features: [{
          attributes: {
            PARNO: "222602000000011010",
            SITEADD: "100 MAIN ST",
            SCITY: "LAKELAND",
          },
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const result = await resolveParcel(
    "polk",
    "100 Main St, Lakeland, FL 33809",
    { fetchImpl, skipCache: true },
  );
  assert.equal(result.status, "found");
  assert.equal(result.parcelId, "222602000000011010");
});

test("candidate with wrong city is never accepted", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        features: [{
          attributes: {
            PARNO: "0000007033",
            SITEADD: "1630 MAIN ST",
            SCITY: "VENICE",
          },
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  const result = await resolveParcel(
    "sarasota",
    "1630 Main St, Sarasota, FL 34236",
    { fetchImpl, skipCache: true },
  );
  assert.equal(result.status, "not-found");
});