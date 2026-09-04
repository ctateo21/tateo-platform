import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildImporterPayload,
  getQuotes,
  importAndSubmit,
  type QuoteRushParams,
} from "./quoterush";
import { resolveQuoteRushPropertyInputs } from "./quoterush-inputs";
import { claimQuoteRushAddress } from "./quoterush-cache-claim";
import { prepareQuoteRushStartRequest } from "./quoterush-start-request";
import { resolveQuoteRushPropertyDefaults } from "@shared/quoterush-property-defaults";

const params: QuoteRushParams = {
  streetAddress: "123 Palm Way",
  city: "Tampa",
  state: "FL",
  zip: "33602",
  county: "Hillsborough",
  coverageA: 425_000,
  policyType: "HO3",
  yearBuilt: 2007,
  roofYear: 2022,
  constructionType: "Mixed",
  masonryConstruction: "Concrete Block",
  frameConstruction: "Stucco",
  hurrDeductible: "5%",
  aopDeductible: "$1,000",
  priorClaims: 0,
  claimRecords: [],
  floodZone: "X",
  sqFt: 2_100,
  windMitForm: true,
  openingProtection: "Hurricane Protection",
  secondaryWaterResistance: "Yes",
  roofShape: "Hip",
  usageType: "Primary",
  rentalTerm: "",
  monthsOccupied: "9 months or more",
  newPurchase: "No",
  purchaseDate: "08/31/2023",
  purchasePrice: 425_000,
  firstName: "Test",
  lastName: "Applicant",
  email: "test@example.com",
  phone: "5555555555",
};

test("importer payload retains exact property answers, mixed construction, and both deductibles", () => {
  const payload = buildImporterPayload(params, "agent@example.com");
  assert.deepEqual(
    {
      yearBuilt: payload.HO.YearBuilt,
      roofYear: payload.HO.UpdateRoofYear,
      openingProtection: payload.HO.OpeningProtection,
      roofShape: payload.HO.RoofShape,
      swr: payload.HO.SecondaryWaterResistance,
      constructionType: payload.HO.ConstructionType,
      construction: payload.HO.Construction,
      masonry: payload.HO.MasonryConstruction,
      frame: payload.HO.FrameConstruction,
      hurricane: payload.HO.HurricaneDeductible,
      windHail: payload.HO.WindHailDeductible,
      aop: payload.HO.AllOtherPerilsDeductible,
      usageType: payload.HO.UsageType,
      rentalTerm: payload.HO.RentalTerm,
      monthsOccupied: payload.HO.MonthsOccupied,
      newPurchase: payload.HO.NewPurchase,
      purchaseDate: payload.HO.PurchaseDate,
      purchasePrice: payload.HO.PurchasePrice,
    },
    {
      yearBuilt: "2007",
      roofYear: "2022",
      openingProtection: "Hurricane Protection",
      roofShape: "Hip",
      swr: "Yes",
      constructionType: "Mixed",
      construction: "Concrete Block",
      masonry: "Concrete Block",
      frame: undefined,
      hurricane: "5%",
      windHail: "5%",
      aop: "$1,000",
      usageType: "Primary",
      rentalTerm: undefined,
      monthsOccupied: "9 months or more",
      newPurchase: "No",
      purchaseDate: "08/31/2023",
      purchasePrice: "425000",
    },
  );
});

test("policy defaults resolve every HO3, HO6, and DP3 property-information rule", () => {
  const base = {
    rebuildCost: 425_000,
    newPurchase: true,
    purchaseDate: "2026-09-30",
  };

  assert.deepEqual(
    resolveQuoteRushPropertyDefaults({ ...base, policyType: "HO3" }),
    {
      usageType: "Primary",
      rentalTerm: "",
      monthsOccupied: "9 months or more",
      newPurchase: "Yes",
      purchaseDate: "09/30/2026",
      purchasePrice: 425_000,
    },
  );

  assert.deepEqual(
    resolveQuoteRushPropertyDefaults({
      ...base,
      policyType: "HO6",
      ho6ResidenceUse: "secondary",
    }),
    {
      usageType: "Secondary",
      rentalTerm: "",
      monthsOccupied: "9 months or more",
      newPurchase: "Yes",
      purchaseDate: "09/30/2026",
      purchasePrice: 850_000,
    },
  );

  assert.deepEqual(
    resolveQuoteRushPropertyDefaults({
      ...base,
      policyType: "HO6",
      ho6ResidenceUse: "primary",
    }),
    {
      usageType: "Primary",
      rentalTerm: "",
      monthsOccupied: "9 months or more",
      newPurchase: "Yes",
      purchaseDate: "09/30/2026",
      purchasePrice: 850_000,
    },
  );

  for (const [input, expected] of [
    ["annual", "Annual"],
    ["monthly", "Monthly"],
    ["weekly", "Weekly"],
  ] as const) {
    const resolved = resolveQuoteRushPropertyDefaults({
      ...base,
      policyType: "HO6",
      ho6ResidenceUse: "investment",
      ho6RentalTerm: input,
    });
    assert.equal(resolved.usageType, "Investment");
    assert.equal(resolved.rentalTerm, expected);
    assert.equal(resolved.purchasePrice, 850_000);
  }

  assert.deepEqual(
    resolveQuoteRushPropertyDefaults({
      ...base,
      policyType: "DP3",
      newPurchase: false,
      purchaseDate: "2023-08-31",
    }),
    {
      usageType: "Investment",
      rentalTerm: "",
      monthsOccupied: "9 months or more",
      newPurchase: "No",
      purchaseDate: "08/31/2023",
      purchasePrice: 425_000,
    },
  );
});

test("quote-start rejects incomplete property details before a cache claim can run", () => {
  const validRequest = {
    address: "123 Palm Way, Tampa, FL 33602",
    coverageA: 425_000,
    policyType: "HO3" as const,
    constIdx: 1,
    windIdx: 1,
    hurrIdx: 1,
    hasClaims: false,
    claimRecords: [],
    newPurchase: true,
    purchaseDate: "2026-09-30",
  };
  let resolverCalls = 0;
  let cacheClaims = 0;
  const resolver = (input: Parameters<typeof resolveQuoteRushPropertyDefaults>[0]) => {
    resolverCalls++;
    return resolveQuoteRushPropertyDefaults(input);
  };
  const prepareThenClaim = (request: unknown) => {
    const prepared = prepareQuoteRushStartRequest(request, resolver);
    cacheClaims++;
    return prepared;
  };

  const { purchaseDate: _purchaseDate, ...missingPurchaseDate } = validRequest;
  for (const [invalidRequest, expectedPath] of [
    [missingPurchaseDate, "purchaseDate"],
    [{ ...validRequest, policyType: "HO6" as const }, "usageType"],
    [
      {
        ...validRequest,
        policyType: "HO6" as const,
        usageType: "investment" as const,
      },
      "rentalTerm",
    ],
  ] as const) {
    assert.throws(() => prepareThenClaim(invalidRequest), (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.match(String(error), new RegExp(expectedPath, "i"));
      return true;
    });
  }
  assert.equal(resolverCalls, 0);
  assert.equal(cacheClaims, 0);
});

test("quote-start route prepares property details before claiming the paid-quote cache", () => {
  const routesSource = readFileSync(
    new URL("../routes.ts", import.meta.url),
    "utf8",
  );
  const routeStart = routesSource.indexOf('"/api/insurance/qr-start"');
  const routeEnd = routesSource.indexOf(
    '"/api/insurance/qr-quotes"',
    routeStart,
  );
  const routeSource = routesSource.slice(routeStart, routeEnd);
  const preparation = routeSource.indexOf("prepareQuoteRushStartRequest");
  const cacheClaim = routeSource.indexOf("claimQuoteRushAddress");
  const paidSubmission = routeSource.indexOf(
    "const result = await importAndSubmit",
  );

  assert.notEqual(routeStart, -1);
  assert.notEqual(routeEnd, -1);
  assert.notEqual(preparation, -1);
  assert.notEqual(cacheClaim, -1);
  assert.notEqual(paidSubmission, -1);
  assert.ok(preparation < cacheClaim);
  assert.ok(cacheClaim < paidSubmission);
  const preserveLead = routeSource.indexOf(
    ".set({ leadId: result.leadId })",
  );
  const ambiguousSubmit = routeSource.indexOf(
    "if (!result.submitted)",
  );
  assert.ok(preserveLead > paidSubmission);
  assert.ok(ambiguousSubmit > preserveLead);
  assert.match(
    routeSource.slice(ambiguousSubmit),
    /status\(202\)[\s\S]*existing lead/,
  );
});

test("quote polling requires authenticated, address-and-policy-bound cache access", () => {
  const routesSource = readFileSync(
    new URL("../routes.ts", import.meta.url),
    "utf8",
  );
  for (const route of ["/api/insurance/qr-quotes", "/api/insurance/qr-refresh"]) {
    const start = routesSource.indexOf(`"${route}"`);
    const end = routesSource.indexOf("\n  );", start);
    const source = routesSource.slice(start, end);
    assert.ok(start >= 0);
    assert.ok(source.indexOf("optionalUser(req)") < source.indexOf("getQuotes(leadId)"));
    assert.match(source, /address: z\.string\(\)\.min\(5\)/);
    assert.match(source, /policyType: z\.enum\(\["HO3", "HO6", "DP3"\]\)/);
    assert.ok(
      source.indexOf("findQuoteCacheLead(leadId, address, policyType)") <
        source.indexOf("getQuotes(leadId)"),
    );
  }
});

test("quote cache snapshots are explicitly non-PII", () => {
  const routesSource = readFileSync(
    new URL("../routes.ts", import.meta.url),
    "utf8",
  );
  const snapshotStart = routesSource.indexOf("propertyDataSnapshot: {");
  const snapshotEnd = routesSource.indexOf("const result = await importAndSubmit", snapshotStart);
  const snapshotSource = routesSource.slice(snapshotStart, snapshotEnd);
  assert.ok(snapshotStart >= 0);
  assert.doesNotMatch(
    snapshotSource,
    /\b(?:dateOfBirth|firstName|lastName|email|phone|userId)\b/,
  );
  assert.match(snapshotSource, /propertyDataProvenance:/);
  assert.match(snapshotSource, /agencyDefaultSnapshot:/);
  assert.match(snapshotSource, /assumptions:/);
  assert.doesNotMatch(
    snapshotSource,
    /hasClaims|claimsCount|priorClaims/,
  );
});

test("quote-start resolves normalized HO3, HO6, and DP3 defaults before cache access", () => {
  const base = {
    address: "123 Palm Way, Tampa, FL 33602",
    coverageA: 425_000,
    constIdx: 1,
    windIdx: 1,
    hurrIdx: 1,
    hasClaims: false,
    claimRecords: [],
    newPurchase: true,
    purchaseDate: "2026-09-30",
  };

  const cases = [
    [
      { ...base, policyType: "HO3" as const },
      { usageType: "Primary", rentalTerm: "", purchasePrice: 425_000 },
    ],
    [
      {
        ...base,
        policyType: "HO6" as const,
        usageType: "investment" as const,
        rentalTerm: "monthly" as const,
      },
      { usageType: "Investment", rentalTerm: "Monthly", purchasePrice: 850_000 },
    ],
    [
      { ...base, policyType: "DP3" as const, newPurchase: false },
      { usageType: "Investment", rentalTerm: "", purchasePrice: 425_000 },
    ],
  ] as const;

  for (const [request, expected] of cases) {
    const { propertyDefaults } = prepareQuoteRushStartRequest(request);
    assert.deepEqual(
      {
        usageType: propertyDefaults.usageType,
        rentalTerm: propertyDefaults.rentalTerm,
        purchasePrice: propertyDefaults.purchasePrice,
        purchaseDate: propertyDefaults.purchaseDate,
        newPurchase: propertyDefaults.newPurchase,
      },
      {
        ...expected,
        purchaseDate: "09/30/2026",
        newPurchase: request.newPurchase ? "Yes" : "No",
      },
    );
  }
});

test("property enrichment can supplement square footage but cannot overwrite explicit quote answers", async () => {
  const previousFetch = globalThis.fetch;
  const oldEnv = {
    webId: process.env.QUOTERUSH_WEBID,
    password: process.env.QUOTERUSH_WEBID_PASSWORD,
    key: process.env.QUOTERUSH_ENDPOINT_KEY,
    agency: process.env.QUOTERUSH_AGENCY_ID,
  };
  Object.assign(process.env, {
    QUOTERUSH_WEBID: "test-web-id",
    QUOTERUSH_WEBID_PASSWORD: "test-password",
    QUOTERUSH_ENDPOINT_KEY: "test-key",
    QUOTERUSH_AGENCY_ID: "test-agency",
  });
  const calls: Array<{ url: string; body?: unknown }> = [];
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), body: init?.body });
    if (String(url).includes("GetPropertyData")) {
      return new Response(JSON.stringify({
        SquareFeet: 2600,
        YearBuilt: 1981,
        ConstructionType: "Frame",
        MasonryConstruction: "Brick",
      }));
    }
    if (String(url).includes("importer.quoterush.com")) {
      return new Response(JSON.stringify({ LeadId: 987 }));
    }
    return new Response("submitted");
  }) as typeof fetch;

  try {
    const result = await importAndSubmit({ ...params, sqFt: 0 });
    assert.deepEqual(result, { leadId: 987, submitted: true, error: undefined });
    const importer = calls.find(({ url }) => url.includes("importer.quoterush.com"))!;
    const payload = JSON.parse(String(importer.body));
    assert.equal(payload.HO.SquareFeet, "2600");
    assert.equal(payload.HO.YearBuilt, "2007");
    assert.equal(payload.HO.ConstructionType, "Mixed");
    assert.equal(payload.HO.Construction, "Concrete Block");
    assert.equal("FrameConstruction" in payload.HO, false);

    await importAndSubmit({ ...params, sqFt: 2_100 });
    const importers = calls.filter(({ url }) => url.includes("importer.quoterush.com"));
    const explicitSquareFeetPayload = JSON.parse(String(importers.at(-1)!.body));
    assert.equal(
      explicitSquareFeetPayload.HO.SquareFeet,
      "2100",
      "late QuoteRUSH property enrichment must not replace a trusted square-foot value",
    );
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries({
      QUOTERUSH_WEBID: oldEnv.webId,
      QUOTERUSH_WEBID_PASSWORD: oldEnv.password,
      QUOTERUSH_ENDPOINT_KEY: oldEnv.key,
      QUOTERUSH_AGENCY_ID: oldEnv.agency,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("submit transport failure preserves the imported lead for reconciliation", async () => {
  const previousFetch = globalThis.fetch;
  const oldEnv = {
    webId: process.env.QUOTERUSH_WEBID,
    password: process.env.QUOTERUSH_WEBID_PASSWORD,
    key: process.env.QUOTERUSH_ENDPOINT_KEY,
    agency: process.env.QUOTERUSH_AGENCY_ID,
  };
  Object.assign(process.env, {
    QUOTERUSH_WEBID: "test-web-id",
    QUOTERUSH_WEBID_PASSWORD: "test-password",
    QUOTERUSH_ENDPOINT_KEY: "test-key",
    QUOTERUSH_AGENCY_ID: "test-agency",
  });
  globalThis.fetch = (async (url) => {
    if (String(url).includes("GetPropertyData")) {
      return new Response(JSON.stringify({}));
    }
    if (String(url).includes("importer.quoterush.com")) {
      return new Response(JSON.stringify({ LeadId: 654 }));
    }
    throw new TypeError("simulated connection reset");
  }) as typeof fetch;

  try {
    assert.deepEqual(
      await importAndSubmit(params),
      {
        leadId: 654,
        submitted: false,
        error: "Quote submission status could not be confirmed",
      },
    );
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries({
      QUOTERUSH_WEBID: oldEnv.webId,
      QUOTERUSH_WEBID_PASSWORD: oldEnv.password,
      QUOTERUSH_ENDPOINT_KEY: oldEnv.key,
      QUOTERUSH_AGENCY_ID: oldEnv.agency,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("import payload omits square footage when no trusted value is available", () => {
  const payload = buildImporterPayload({ ...params, sqFt: 0 }, "agent@example.com");
  assert.equal("SquareFeet" in payload.HO, false);
});

test("import payload never fabricates prior claim details", () => {
  assert.throws(
    () =>
      buildImporterPayload(
        { ...params, priorClaims: 1 },
        "agent@example.com",
      ),
    /claim details must be confirmed/i,
  );
});

test("import payload maps only completed applicant claim records", () => {
  const payload = buildImporterPayload({
    ...params,
    priorClaims: 1,
    claimRecords: [{
      lossDate: "2024-06-01",
      claimDetail: "Water damage from a supply line",
      amount: 12_500,
      paid: false,
      priorResidence: true,
    }],
  }, "agent@example.com");
  assert.equal(payload.HO.Claims, "Yes");
  assert.deepEqual(payload.Claims, [{
    ClaimDetail: "Water damage from a supply line",
    Date: "06/01/2024",
    Amount: "12500",
    PriorResidence: true,
    Paid: false,
  }]);
  assert.equal("ActOfGod" in payload.Claims[0], false);
  assert.equal("CatastrophicLoss" in payload.Claims[0], false);
  assert.throws(
    () => buildImporterPayload({ ...params, priorClaims: 1, claimRecords: [] }, "agent@example.com"),
    /claim details must be confirmed/i,
  );
});

test("HO6 keeps C/D/E, uses $2,000 medical, and omits Coverage B", () => {
  const payload = buildImporterPayload(
    { ...params, policyType: "HO6", coverageA: 212_500 },
    "agent@example.com",
  );
  assert.equal(payload.HO.CoverageA, "212500");
  assert.equal(payload.HO.CoverageF, "$2,000");
  assert.equal("CoverageB" in payload.HO, false);
  assert.equal("CoverageBPercent" in payload.HO, false);
  assert.equal(payload.HO.CoverageC, "53125");
  assert.equal(payload.HO.CoverageD, "21250");
  assert.equal(payload.HO.CoverageE, "$300,000");
  assert.equal("LossAssessment" in payload.HO, false);
});

test("quote-start requires a matching complete claim answer", () => {
  const base = {
    address: "123 Palm Way, Tampa, FL 33602", coverageA: 425_000,
    constIdx: 1, windIdx: 1, hurrIdx: 1, newPurchase: true,
    purchaseDate: "2026-09-30", hasClaims: true, claimRecords: [],
  };
  assert.throws(() => prepareQuoteRushStartRequest(base), /claim/i);
  assert.throws(() => prepareQuoteRushStartRequest({
    ...base, claimRecords: [{
      lossDate: "2024-06-01", claimDetail: "Wind", amount: 0,
      paid: true, priorResidence: false,
    }],
  }), /amount/i);
  assert.doesNotThrow(() => prepareQuoteRushStartRequest({
    ...base, hasClaims: false, claimRecords: [], hasMortgage: false,
  }));
});

test("FEMA zone does not synthesize a separate flood policy", () => {
  const payload = buildImporterPayload(
    { ...params, floodZone: "AE" },
    "agent@example.com",
  );
  assert.equal(payload.Client.Lob_Flood, false);
  assert.equal(payload.HO.FloodZone, "AE");
  assert.equal(payload.HO.FloodPolicy, false);
  assert.equal("Flood" in payload, false);
});

test("unknown flood zone is omitted instead of fabricated as X", () => {
  const payload = buildImporterPayload(
    { ...params, floodZone: "" },
    "agent@example.com",
  );
  assert.equal("FloodZone" in payload.HO, false);
});

test("mortgage is omitted unless Havo has a derived answer", () => {
  const unknown = buildImporterPayload(params, "agent@example.com");
  assert.equal("Mortgage" in unknown.HO, false);

  const financed = buildImporterPayload(
    { ...params, hasMortgage: true },
    "agent@example.com",
  );
  assert.equal(financed.HO.Mortgage, "Yes");

  const freeAndClear = buildImporterPayload(
    { ...params, hasMortgage: false },
    "agent@example.com",
  );
  assert.equal(freeAndClear.HO.Mortgage, "No");
});

test("legacy index callers retain the intentional bucket fallback only when exact years are absent", () => {
  const exact = resolveQuoteRushPropertyInputs({
    yearBuilt: 2011,
    roofYear: 2024,
    yearIdx: 3,
    roofIdx: 3,
    constIdx: 1,
    windIdx: 0,
    openingProtection: true,
    secondaryWaterResistance: "Unknown",
    roofShape: "Flat",
  }, 2026);
  assert.equal(exact.yearBuilt, 2011);
  assert.equal(exact.roofYear, 2024);
  assert.equal(exact.openingProtection, "Hurricane Protection");
  assert.equal(exact.secondaryWaterResistance, "Unknown");
  assert.equal(exact.roofShape, "Flat");
  assert.equal(exact.constructionType, "Mixed");
  assert.equal(exact.frameConstruction, "");

  const legacy = resolveQuoteRushPropertyInputs({
    yearIdx: 2,
    roofIdx: 0,
    constIdx: 0,
    windIdx: 2,
  }, 2026);
  assert.equal(legacy.yearBuilt, 1980);
  assert.equal(legacy.roofYear, 2024);
  assert.equal(legacy.openingProtection, "Hurricane Protection");
});

test("concurrent address claims allow only one paid submission", async () => {
  let claimed = false;
  let paidSubmissions = 0;
  const insertPending = async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
    if (claimed) return [];
    claimed = true;
    return [{ id: 1 }];
  };
  const findCurrent = async () => ({
    leadId: null,
    status: "pending",
  });

  const attempt = async () => {
    const claim = await claimQuoteRushAddress(insertPending, findCurrent);
    if (claim.claimed) paidSubmissions++;
    return claim;
  };
  const results = await Promise.all([attempt(), attempt()]);

  assert.equal(paidSubmissions, 1);
  assert.equal(results.filter(result => result.claimed).length, 1);
  const loser = results.find(result => !result.claimed);
  assert.deepEqual(loser, {
    claimed: false,
    row: { leadId: null, status: "pending" },
  });
});

test("same address and policy race allows only one paid submission", async () => {
  const claimedIdentities = new Set<string>();
  let paidSubmissions = 0;
  const identity = "123 palm way tampa fl 33602|HO6";

  const attempt = async () => {
    const claim = await claimQuoteRushAddress(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        if (claimedIdentities.has(identity)) return [];
        claimedIdentities.add(identity);
        return [{ id: 1 }];
      },
      async () => ({ leadId: null, status: "pending" }),
    );
    if (claim.claimed) paidSubmissions++;
    return claim;
  };

  const claims = await Promise.all([attempt(), attempt()]);
  assert.equal(paidSubmissions, 1);
  assert.equal(claims.filter(claim => claim.claimed).length, 1);
});

test("same address with different policy types has independent claims", async () => {
  const claimedIdentities = new Set<string>();
  let paidSubmissions = 0;

  const attempt = async (policyType: "HO3" | "HO6") => {
    const identity = `123 palm way tampa fl 33602|${policyType}`;
    const claim = await claimQuoteRushAddress(
      async () => {
        if (claimedIdentities.has(identity)) return [];
        claimedIdentities.add(identity);
        return [{ id: claimedIdentities.size }];
      },
      async () => ({ leadId: null, status: "pending" }),
    );
    if (claim.claimed) paidSubmissions++;
  };

  await Promise.all([attempt("HO3"), attempt("HO6")]);
  assert.equal(paidSubmissions, 2);
  assert.deepEqual(
    [...claimedIdentities].sort(),
    [
      "123 palm way tampa fl 33602|HO3",
      "123 palm way tampa fl 33602|HO6",
    ],
  );
});

test("QuoteRUSH returns only the three cheapest positive carrier results", async () => {
  const previousFetch = globalThis.fetch;
  const previousEndpointKey = process.env.QUOTERUSH_ENDPOINT_KEY;
  const previousAgency = process.env.QUOTERUSH_AGENCY_ID;
  process.env.QUOTERUSH_ENDPOINT_KEY = "test-key";
  process.env.QUOTERUSH_AGENCY_ID = "test-agency";
  globalThis.fetch = (async () => new Response(JSON.stringify({
    QuoteCounter: 5,
    Quotes: [
      { SiteName: "Expensive", Premium: "5000" },
      { SiteName: "Cheapest", Premium: "1000" },
      { SiteName: "Invalid", Premium: "0" },
      { SiteName: "Third", Premium: "3000" },
      { SiteName: "Second", Premium: "2000" },
      { SiteName: "Fourth", Premium: "4000" },
    ],
  }))) as typeof fetch;

  try {
    const result = await getQuotes(123);
    assert.equal(result.quoteCounter, 5);
    assert.deepEqual(
      result.quotes.map(quote => ({
        carrier: quote.siteName,
        premium: quote.annualPremium,
        rank: quote.rank,
      })),
      [
        { carrier: "Cheapest", premium: 1000, rank: 1 },
        { carrier: "Second", premium: 2000, rank: 2 },
        { carrier: "Third", premium: 3000, rank: 3 },
      ],
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousEndpointKey === undefined) {
      delete process.env.QUOTERUSH_ENDPOINT_KEY;
    } else {
      process.env.QUOTERUSH_ENDPOINT_KEY = previousEndpointKey;
    }
    if (previousAgency === undefined) {
      delete process.env.QUOTERUSH_AGENCY_ID;
    } else {
      process.env.QUOTERUSH_AGENCY_ID = previousAgency;
    }
  }
});