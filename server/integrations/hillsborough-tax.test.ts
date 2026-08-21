import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HCPA_CACHE_TTL_MS,
  getHillsboroughTax,
  lookupPIN,
  streetAddressMatches,
  streetQueriesForSearch,
  type HCPATaxCacheRecord,
  type HCPATaxCacheStore,
} from "./hillsborough-tax";
import {
  isHillsboroughCountyAddress,
  normalizeHillsboroughAddressKey,
} from "@shared/hillsborough-county";

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function memoryCache(
  initial: HCPATaxCacheRecord | null = null,
): HCPATaxCacheStore & {
  written: HCPATaxCacheRecord | null;
} {
  return {
    written: null,
    async get(key) {
      return initial?.addressNormalized === key ? initial : null;
    },
    async set(record) {
      this.written = record;
    },
  };
}

test("shared Hillsborough gate uses the official ZIP set instead of community names", () => {
  assert.equal(
    isHillsboroughCountyAddress(
      "123 Unlisted Neighborhood Rd, Tampa, FL 33647-1234",
    ),
    true,
  );
  assert.equal(
    isHillsboroughCountyAddress(
      "123 Main St, Clearwater, FL 33755",
    ),
    false,
  );
  assert.equal(
    isHillsboroughCountyAddress("Tampa, FL"),
    false,
  );
});

test("street search keeps the complete multi-word name and only drops a suffix", () => {
  assert.deepEqual(
    streetQueriesForSearch(
      "2814 W Bay to Bay Blvd, Tampa, FL 33629",
    ),
    ["2814 W Bay to Bay Blvd", "2814 W Bay to Bay"],
  );
  assert.deepEqual(
    streetQueriesForSearch(
      "5401 N Dale Mabry Hwy, Tampa, FL 33614",
    ),
    ["5401 N Dale Mabry Hwy", "5401 N Dale Mabry"],
  );
});

test("strict street identity rejects Bay Haven for Bay to Bay", () => {
  assert.equal(
    streetAddressMatches(
      "2814 W Bay to Bay Blvd, Tampa, FL 33629",
      "2814 W BAY HAVEN DR, TAMPA",
    ),
    false,
  );
  assert.equal(
    streetAddressMatches(
      "2814 W Bay to Bay Boulevard, Tampa, FL 33629",
      "2814 W BAY TO BAY BLVD, TAMPA",
    ),
    true,
  );
});

test("strict parcel identity never collapses distinct condo units", () => {
  assert.equal(
    streetAddressMatches(
      "777 Harbor Dr Unit 201, Tampa, FL 33602",
      "777 HARBOR DR UNIT 202, TAMPA",
    ),
    false,
  );
  assert.equal(
    streetAddressMatches(
      "777 Harbor Dr #201, Tampa, FL 33602",
      "777 HARBOR DRIVE APT 201, TAMPA",
    ),
    true,
  );
  assert.equal(
    streetAddressMatches(
      "777 Harbor Dr, Tampa, FL 33602",
      "777 HARBOR DR UNIT 201, TAMPA",
    ),
    false,
  );
});

test("parcel lookup never accepts a city-only wrong-street result", async () => {
  let calls = 0;
  const result = await lookupPIN(
    "2814 W Bay to Bay Blvd, Tampa, FL 33629",
    async () => {
      calls += 1;
      return jsonResponse([
        {
          address: "2814 W BAY HAVEN DR, TAMPA",
          pin: "wrong-pin",
          folio: "wrong-folio",
        },
      ]);
    },
  );
  assert.equal(result, null);
  assert.equal(calls, 1);
});

test("parcel lookup uses the suffix-only retry after an empty full search", async () => {
  const queries: string[] = [];
  const result = await lookupPIN(
    "2814 W Bay to Bay Blvd, Tampa, FL 33629",
    async input => {
      const url = new URL(String(input));
      queries.push(url.searchParams.get("address") ?? "");
      return queries.length === 1
        ? jsonResponse([])
        : jsonResponse([
            {
              address: "2814 W BAY TO BAY BLVD, TAMPA",
              pin: "correct-pin",
              folio: "correct-folio",
            },
          ]);
    },
  );
  assert.deepEqual(queries, [
    "2814 W Bay to Bay Blvd",
    "2814 W Bay to Bay",
  ]);
  assert.deepEqual(result, {
    pin: "correct-pin",
    folio: "correct-folio",
  });
});

test("parcel lookup rejects an exact street in a different postal city", async () => {
  const result = await lookupPIN(
    "100 Main St, Zephyrhills, FL 33540",
    async () =>
      jsonResponse([
        {
          address: "100 MAIN STREET, PLANT CITY",
          pin: "different-city-pin",
          folio: "different-city-folio",
        },
      ]),
  );
  assert.equal(result, null);
});

test("fresh cache rates recalculate for the current price without HCPA fetches", async () => {
  const now = Date.UTC(2026, 7, 20);
  const address =
    "123 New Community Way, Tampa, FL 33647";
  const record: HCPATaxCacheRecord = {
    addressNormalized: normalizeHillsboroughAddressKey(address),
    addressDisplay: address,
    pin: "cached-pin",
    folio: "cached-folio",
    schoolTaxRate: 6,
    nonschoolTaxRate: 12,
    totalTaxRate: 18,
    nonAdValoremTaxes: 0,
    taxDistrict: "TA",
    queriedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 1_000).toISOString(),
  };
  const cache = memoryCache(record);
  const fetchImpl = async (): Promise<Response> => {
    throw new Error("fresh cache should not call HCPA");
  };

  const lower = await getHillsboroughTax(
    {
      address,
      purchasePrice: 400_000,
      isPrimaryResidence: false,
    },
    { cacheStore: cache, fetchImpl, now },
  );
  const higher = await getHillsboroughTax(
    {
      address,
      purchasePrice: 500_000,
      isPrimaryResidence: false,
    },
    { cacheStore: cache, fetchImpl, now },
  );

  assert.equal(lower?.source, "hcpa-cache");
  assert.equal(higher?.source, "hcpa-cache");
  assert.ok((higher?.annualTax ?? 0) > (lower?.annualTax ?? 0));
});

test("fresh cache rates recalculate for current homestead status", async () => {
  const now = Date.UTC(2026, 7, 20);
  const address = "123 Main St, Tampa, FL 33602";
  const cache = memoryCache({
    addressNormalized: normalizeHillsboroughAddressKey(address),
    addressDisplay: address,
    pin: "cached-pin",
    folio: "cached-folio",
    schoolTaxRate: 6,
    nonschoolTaxRate: 12,
    totalTaxRate: 18,
    nonAdValoremTaxes: 0,
    taxDistrict: "TA",
    queriedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 1_000).toISOString(),
  });
  const fetchImpl = async (): Promise<Response> => {
    throw new Error("fresh cache should not call HCPA");
  };

  const homestead = await getHillsboroughTax(
    {
      address,
      purchasePrice: 400_000,
      isPrimaryResidence: true,
    },
    { cacheStore: cache, fetchImpl, now },
  );
  const nonHomestead = await getHillsboroughTax(
    {
      address,
      purchasePrice: 400_000,
      isPrimaryResidence: false,
    },
    { cacheStore: cache, fetchImpl, now },
  );
  assert.ok(
    (nonHomestead?.annualTax ?? 0) >
      (homestead?.annualTax ?? 0),
  );
});

test("expired cache performs live lookup and writes a 60-day rate record", async () => {
  const now = Date.UTC(2026, 7, 20);
  const address = "100 Main St, Tampa, FL 33602";
  const expired: HCPATaxCacheRecord = {
    addressNormalized: normalizeHillsboroughAddressKey(address),
    addressDisplay: address,
    pin: "old-pin",
    folio: "old-folio",
    schoolTaxRate: 1,
    nonschoolTaxRate: 1,
    totalTaxRate: 2,
    nonAdValoremTaxes: 0,
    taxDistrict: "OLD",
    queriedAt: new Date(now - HCPA_CACHE_TTL_MS * 2).toISOString(),
    expiresAt: new Date(now - 1).toISOString(),
  };
  const cache = memoryCache(expired);
  let calls = 0;
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    calls += 1;
    const url = String(input);
    if (url.includes("/BasicSearch?")) {
      return jsonResponse([
        {
          address: "100 MAIN STREET, TAMPA",
          pin: "new-pin",
          folio: "new-folio",
        },
      ]);
    }
    return jsonResponse({
      parcelID: "new-pin",
      schoolTaxRate: 6,
      nonschoolTaxRate: 12,
      totalTaxRate: 18,
      nonAdValoremTaxes: 0,
      taxDistrict: "TA",
      justValue: 300_000,
      assessedValue: 280_000,
    });
  };

  const result = await getHillsboroughTax(
    {
      address,
      purchasePrice: 400_000,
      isPrimaryResidence: true,
    },
    { cacheStore: cache, fetchImpl, now },
  );

  assert.equal(calls, 2);
  assert.equal(result?.source, "hcpa-api");
  assert.equal(cache.written?.folio, "new-folio");
  assert.equal(
    cache.written?.expiresAt,
    new Date(now + HCPA_CACHE_TTL_MS).toISOString(),
  );
});

test("live refresh preserves a verified cached folio and assessment for the same PIN", async () => {
  const now = Date.UTC(2026, 7, 20);
  const address = "100 Main St, Tampa, FL 33602";
  const cache = memoryCache({
    addressNormalized: normalizeHillsboroughAddressKey(address),
    addressDisplay: address,
    pin: "same-pin",
    folio: "verified-folio",
    schoolTaxRate: 1,
    nonschoolTaxRate: 1,
    totalTaxRate: 2,
    nonAdValoremTaxes: 725,
    taxDistrict: "OLD",
    queriedAt: new Date(now - HCPA_CACHE_TTL_MS * 2).toISOString(),
    expiresAt: new Date(now - 1).toISOString(),
  });
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes("/BasicSearch?")) {
      return jsonResponse([
        {
          address: "100 MAIN ST, TAMPA",
          pin: "same-pin",
          folio: null,
        },
      ]);
    }
    return jsonResponse({
      parcelID: "same-pin",
      schoolTaxRate: 6,
      nonschoolTaxRate: 12,
      totalTaxRate: 18,
      nonAdValoremTaxes: 0,
      taxDistrict: "TA",
    });
  };

  const result = await getHillsboroughTax(
    {
      address,
      purchasePrice: 400_000,
      isPrimaryResidence: false,
    },
    { cacheStore: cache, fetchImpl, now },
  );

  assert.equal(result?.folio, "verified-folio");
  assert.equal(cache.written?.folio, "verified-folio");
  assert.equal(cache.written?.nonAdValoremTaxes, 725);
});

test("live refresh never carries assessment metadata to a different PIN", async () => {
  const now = Date.UTC(2026, 7, 20);
  const address = "100 Main St, Tampa, FL 33602";
  const cache = memoryCache({
    addressNormalized: normalizeHillsboroughAddressKey(address),
    addressDisplay: address,
    pin: "old-pin",
    folio: "old-folio",
    schoolTaxRate: 1,
    nonschoolTaxRate: 1,
    totalTaxRate: 2,
    nonAdValoremTaxes: 725,
    taxDistrict: "OLD",
    queriedAt: new Date(now - HCPA_CACHE_TTL_MS * 2).toISOString(),
    expiresAt: new Date(now - 1).toISOString(),
  });
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes("/BasicSearch?")) {
      return jsonResponse([
        {
          address: "100 MAIN ST, TAMPA",
          pin: "new-pin",
          folio: "new-folio",
        },
      ]);
    }
    return jsonResponse({
      parcelID: "new-pin",
      schoolTaxRate: 6,
      nonschoolTaxRate: 12,
      totalTaxRate: 18,
      nonAdValoremTaxes: 0,
      taxDistrict: "TA",
    });
  };

  await getHillsboroughTax(
    {
      address,
      purchasePrice: 400_000,
      isPrimaryResidence: false,
    },
    { cacheStore: cache, fetchImpl, now },
  );

  assert.equal(cache.written?.pin, "new-pin");
  assert.equal(cache.written?.folio, "new-folio");
  assert.equal(cache.written?.nonAdValoremTaxes, 0);
});

test("invalid total millage response safely returns null and is not cached", async () => {
  const cache = memoryCache();
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes("/BasicSearch?")) {
      return jsonResponse([
        {
          address: "100 MAIN ST, TAMPA",
          pin: "pin",
          folio: "folio",
        },
      ]);
    }
    return jsonResponse({
      parcelID: "pin",
      schoolTaxRate: 6,
      nonschoolTaxRate: 12,
      totalTaxRate: null,
      taxDistrict: "TA",
    });
  };

  const result = await getHillsboroughTax(
    {
      address: "100 Main St, Tampa, FL 33602",
      purchasePrice: 400_000,
      isPrimaryResidence: true,
    },
    { cacheStore: cache, fetchImpl },
  );
  assert.equal(result, null);
  assert.equal(cache.written, null);
});

test("fresh cache with invalid rates is treated as a miss", async () => {
  const now = Date.UTC(2026, 7, 20);
  const address = "100 Main St, Tampa, FL 33602";
  const cache = memoryCache({
    addressNormalized: normalizeHillsboroughAddressKey(address),
    addressDisplay: address,
    pin: "bad-pin",
    folio: "bad-folio",
    schoolTaxRate: 6,
    nonschoolTaxRate: 12,
    totalTaxRate: 0,
    nonAdValoremTaxes: 0,
    taxDistrict: "BAD",
    queriedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 1_000).toISOString(),
  });
  let calls = 0;
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    calls += 1;
    const url = String(input);
    if (url.includes("/BasicSearch?")) {
      return jsonResponse([
        {
          address: "100 MAIN ST, TAMPA",
          pin: "good-pin",
          folio: "good-folio",
        },
      ]);
    }
    return jsonResponse({
      parcelID: "good-pin",
      schoolTaxRate: 6,
      nonschoolTaxRate: 12,
      totalTaxRate: 18,
      nonAdValoremTaxes: 0,
      taxDistrict: "TA",
    });
  };

  const result = await getHillsboroughTax(
    {
      address,
      purchasePrice: 400_000,
      isPrimaryResidence: true,
    },
    { cacheStore: cache, fetchImpl, now },
  );
  assert.equal(calls, 2);
  assert.equal(result?.source, "hcpa-api");
  assert.equal(cache.written?.pin, "good-pin");
});