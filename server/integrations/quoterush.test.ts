  assert.equal(resolverCalls, 0);
  assert.equal(cacheClaims, 0);
});

test("existing-home quote uses an explicit requested date before private expiration", () => {
  const { propertyDefaults } = prepareQuoteRushStartRequest(
    {
      address: "123 Palm Way, Tampa, FL 33602",
      coverageA: 425_000,
      policyType: "HO3",
      usageType: "primary",
      constIdx: 1,
      windIdx: 1,
      hurrIdx: 1,
      hasClaims: false,
      claimRecords: [],
      newPurchase: false,
      policyEffectiveDate: "2026-10-15",
      purchasePrice: 610_000,
      purchasePriceSource: "user-confirmed-property-value",
    },
    resolveQuoteRushPropertyDefaults,
    "2027-01-31",
  );

  assert.deepEqual(propertyDefaults.policyEffectiveDate, {
    value: "10/15/2026",
    source: "user-requested",
    isAssumption: false,
  });
});

test("current policy expiration cannot override a new-purchase closing date", () => {
  const { propertyDefaults } = prepareQuoteRushStartRequest(
    {
      address: "123 Palm Way, Tampa, FL 33602",
      coverageA: 425_000,
      policyType: "HO3",
      usageType: "primary",
      constIdx: 1,
      windIdx: 1,
      hurrIdx: 1,
      hasClaims: false,
      claimRecords: [],
      newPurchase: true,
      policyEffectiveDate: "2026-10-15",
      purchasePrice: 610_000,
      purchasePriceSource: "user-confirmed-contract",
    },
    resolveQuoteRushPropertyDefaults,
    "2027-01-31",
  );

  assert.deepEqual(propertyDefaults.policyEffectiveDate, {
    value: "10/15/2026",
    source: "closing-date",
    isAssumption: false,
  });
});

test("existing-home quote keeps requested date and disclosed fallback precedence without an expiration", () => {
  const request = {
    address: "123 Palm Way, Tampa, FL 33602",
    coverageA: 425_000,
    policyType: "HO3" as const,
    usageType: "primary" as const,
    constIdx: 1,
    windIdx: 1,
    hurrIdx: 1,
    hasClaims: false,
    claimRecords: [],
    newPurchase: false,
    purchasePrice: 610_000,
    purchasePriceSource: "user-confirmed-property-value" as const,
  };
  const requested = prepareQuoteRushStartRequest({
    ...request,
    policyEffectiveDate: "2026-10-15",
  }).propertyDefaults.policyEffectiveDate;
  const fallback = prepareQuoteRushStartRequest(request)
    .propertyDefaults.policyEffectiveDate;

  assert.deepEqual(requested, {
    value: "10/15/2026",
    source: "user-requested",
    isAssumption: false,
  });
  assert.equal(fallback.source, "30-day-default");
  assert.equal(fallback.isAssumption, true);
});

test("private current policy expiration is not accepted into shared consumer answers", () => {
  const routesSource = readFileSync(
    new URL("../routes.ts", import.meta.url),
    "utf8",
  );
  const sanitizerStart = routesSource.indexOf(
    "function publicConsumerPropertyAnswers",
  );
  const sanitizerEnd = routesSource.indexOf(
    "const qrCountyCache",
    sanitizerStart,
  );
  const sanitizer = routesSource.slice(sanitizerStart, sanitizerEnd);
  const privateEndpointStart = routesSource.indexOf(
    '"/api/profile/insurance-property"',
  );
  const quoteStart = routesSource.indexOf('"/api/insurance/qr-start"');

  assert.notEqual(sanitizerStart, -1);
  assert.doesNotMatch(sanitizer, /currentPolicyExpirationDate/);
  assert.notEqual(privateEndpointStart, -1);
  assert.ok(privateEndpointStart < quoteStart);
  assert.match(routesSource, /privateInsuranceProperties/);
});

test("policy effective values are stripped from the shared quote snapshot", () => {
  const privateEffectiveDate = toQuoteCachePolicyEffectiveDate({
    value: "01/31/2027",
    source: "current-policy-expiration",
    isAssumption: false,
  });
  const ordinaryEffectiveDate = toQuoteCachePolicyEffectiveDate({
    value: "10/15/2026",
    source: "user-requested",
    isAssumption: false,
  });

  assert.deepEqual(privateEffectiveDate, {
    source: "current-policy-expiration",
    isAssumption: false,
  });
  assert.equal("value" in privateEffectiveDate, false);
  assert.deepEqual(ordinaryEffectiveDate, {
    source: "user-requested",
    isAssumption: false,
  });
  assert.equal("value" in ordinaryEffectiveDate, false);
});

test("private expiration never changes the shared paid-cache identity", () => {
  const routesSource = readFileSync(
    new URL("../routes.ts", import.meta.url),
    "utf8",
  );
  const quoteStart = routesSource.slice(
    routesSource.indexOf('"/api/insurance/qr-start"'),
    routesSource.indexOf('"/api/insurance/qr-quotes"'),
  );

  assert.match(quoteStart, /addressNormalized, norm/);
  assert.match(quoteStart, /policyType, cacheRequest\.policyType/);
  assert.doesNotMatch(quoteStart, /cacheScope|quoteCacheScope/);
});

test("changing a private expiration does not rotate quote identity", () => {
  const routesSource = readFileSync(
    new URL("../routes.ts", import.meta.url),
    "utf8",
  );
  const privatePropertyPut = routesSource.slice(
    routesSource.indexOf('app.put(\n    "/api/profile/insurance-property"'),
    routesSource.indexOf("// QuoteRUSH server-side shared cache"),
  );

  assert.match(privatePropertyPut, /currentPolicyExpirationDate:/);
  assert.doesNotMatch(privatePropertyPut, /randomUUID|cacheScope/);
});

test("insurance hydration always reuses shared quotes despite private expiration", () => {
  const insuranceSource = readFileSync(
    new URL("../../client/src/pages/insurance.tsx", import.meta.url),
    "utf8",
  );
  const hydration = insuranceSource.slice(
    insuranceSource.indexOf("// Auto-trigger / cache-hydrate QuoteRUSH"),
    insuranceSource.indexOf("// ── QuoteRUSH quoting"),
  );

  assert.match(hydration, /const local = getQRCache\(address, quotePolicyType\)/);
  assert.match(hydration, /const quoteIdentity = `\$\{address\}\|\$\{quotePolicyType\}`/);
  assert.doesNotMatch(
    hydration,
    /currentPolicyExpirationLoading|currentPolicyExpirationSaving|private:\$\{/,
  );
});

test("new-purchase quote cannot fall back when its closing date is missing", () => {
  assert.throws(() => prepareQuoteRushStartRequest({
    address: "123 Palm Way, Tampa, FL 33602",
    coverageA: 425_000,
    policyType: "HO3",
    usageType: "primary",
    constIdx: 1,
    windIdx: 1,
    hurrIdx: 1,
    hasClaims: false,
    claimRecords: [],
    newPurchase: true,
    purchasePrice: 610_000,
    purchasePriceSource: "user-confirmed-contract",
  }), /closing date/i);
});

test("insurance quote state auto-fills residence use from matching source occupancy", () => {
  const insuranceSource = readFileSync(
    new URL("../../client/src/pages/insurance.tsx", import.meta.url),
    "utf8",
  );
  const resolverStart = insuranceSource.indexOf(
    "function resolveQuotePropertyAnswersFor",
  );
  const resolverEnd = insuranceSource.indexOf(
    "const [initialQuotePropertyAnswers]",
    resolverStart,
  );
  const resolver = insuranceSource.slice(resolverStart, resolverEnd);
  assert.ok(resolverStart >= 0);
  assert.match(resolver, /cash\?\.occupancyType/);
  assert.match(resolver, /loan\?\.occupancyType/);
  assert.match(resolver, /ins\?\.occupancyType/);
  assert.match(resolver, /\(purchase \? "primary" : undefined\)/);
  assert.ok(
    resolver.indexOf("savedResidenceUse") <
      resolver.lastIndexOf("sourceOccupancy"),
    "an explicitly saved quote answer must remain authoritative",
  );
});

test("quote-start returns a valid shared cache before private preparation and gates", () => {
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
  const cacheLookup = routeSource.indexOf(".where(cacheIdentity)");
  const paidSubmission = routeSource.indexOf(
    "const result = await importAndSubmit",
  );
  const cachedQuoteReturn = routeSource.indexOf(
    "cache hit (success)",
  );
  const dobGate = routeSource.indexOf("DOB_REQUIRED");
  const staleReclaim = routeSource.indexOf(".set(initialRunValues)");

  assert.notEqual(routeStart, -1);
  assert.notEqual(routeEnd, -1);
  assert.notEqual(preparation, -1);
  assert.notEqual(cacheLookup, -1);
  assert.notEqual(cacheClaim, -1);
  assert.notEqual(paidSubmission, -1);
  assert.notEqual(cachedQuoteReturn, -1);
  assert.notEqual(dobGate, -1);
  assert.notEqual(staleReclaim, -1);
  assert.ok(cachedQuoteReturn < dobGate);
  assert.ok(cacheLookup < cachedQuoteReturn);
  assert.ok(cachedQuoteReturn < preparation);
  assert.ok(preparation < cacheClaim);
  assert.ok(dobGate < staleReclaim);
  assert.ok(cacheClaim < paidSubmission);
  assert.equal(routeSource.indexOf("CREDIT_PERMISSION_REQUIRED"), -1);
  assert.equal(routeSource.indexOf("const submissionConsentProfile"), -1);
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
  const snapshotStart = routesSource.indexOf("const initialRunValues = {");
  const snapshotEnd = routesSource.indexOf("\n        };", snapshotStart);
  const snapshotSource = routesSource.slice(snapshotStart, snapshotEnd);
  assert.ok(snapshotStart >= 0);
  assert.doesNotMatch(
    snapshotSource,
    /\b(?:dateOfBirth|firstName|lastName|email|phone|userId)\b/,
  );
  assert.match(snapshotSource, /propertyDataProvenance:/);
  assert.match(
    snapshotSource,
    /windMitigationReportConfirmed:\s*false/,
  );
  assert.match(snapshotSource, /agencyDefaultSnapshot:/);
  assert.match(snapshotSource, /assumptions:/);
  assert.doesNotMatch(
    snapshotSource,
    /hasClaims|claimsCount|priorClaims/,
  );
});

test("verification assumptions and consumer wind disclosure remain explicit", () => {
  const routesSource = readFileSync(
    new URL("../routes.ts", import.meta.url),
    "utf8",
  );
  const insuranceSource = readFileSync(
    new URL("../../client/src/pages/insurance.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    routesSource,
    /Credit permission — assumed, confirm with client/,
  );
  assert.match(
    routesSource,
    /Credit score — assumed Excellent, not verified/,
  );
  assert.match(
    insuranceSource,
    /i === 0 && !windMitigationReportConfirmed/,
  );
  assert.match(
    insuranceSource,
    /This estimate assumes wind mitigation credits based on the home's age\. A wind mitigation inspection is required to confirm them — without one, your premium may be higher\./,
  );
  assert.match(insuranceSource, /Send wind mitigation report/);
  assert.doesNotMatch(
    insuranceSource,
    /creditScoreConsent|insurance-credit-score-consent|Authorization required/,
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
    policyEffectiveDate: "2026-09-30",
    purchasePrice: 610_000,
    purchasePriceSource: "havo-purchase-scenario" as const,
  };

  const cases = [
    [
      { ...base, policyType: "HO3" as const, usageType: "primary" as const },
       {
         usageType: "Primary",
         rentalTerm: "",
         purchasePrice: 610_000,
       },
    ],
    [
      {
        ...base,
        policyType: "HO6" as const,
        usageType: "investment" as const,
        rentalTerm: "monthly" as const,
      },
       { usageType: "Investment", rentalTerm: "Monthly", purchasePrice: 610_000 },
    ],
    [
      { ...base, policyType: "DP3" as const, newPurchase: false, rentalTerm: "weekly" as const },
      { usageType: "Investment", rentalTerm: "Weekly", purchasePrice: 610_000 },
    ],
  ] as const;

  for (const [request, expected] of cases) {
    const { propertyDefaults } = prepareQuoteRushStartRequest(request);
    assert.deepEqual(
      {
        usageType: propertyDefaults.usageType,
        rentalTerm: propertyDefaults.rentalTerm,
        purchasePrice: propertyDefaults.purchasePrice.value,
        purchaseDate: propertyDefaults.purchaseDate,
        newPurchase: propertyDefaults.newPurchase,
      },
      {
        ...expected,
        purchaseDate: request.newPurchase
          ? {
              value: "09/30/2026",
              source: "user-confirmed",
            }
          : {
              value: null,
              source: "unknown",
            },
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
    assert.deepEqual(result, {
      leadId: 987,
      submitted: true,
      error: undefined,
      rawPropertyData: {
        SquareFeet: 2600,
        YearBuilt: 1981,
        ConstructionType: "Frame",
        MasonryConstruction: "Brick",
      },
    });
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
        rawPropertyData: {},
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

test("successful property data survives a later importer failure for persistence", async () => {
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
      return new Response(JSON.stringify({
        SquareFeet: 1999,
        UnmappedProviderField: { retained: true },
      }));
    }
    return new Response("import unavailable", { status: 503 });
  }) as typeof fetch;
  try {
    const result = await importAndSubmit(params);
    assert.equal(result.leadId, 0);
    assert.equal(result.submitted, false);
    assert.deepEqual(result.rawPropertyData, {
      SquareFeet: 1999,
      UnmappedProviderField: { retained: true },
    });
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

test("successful property data survives an importer response-read exception", async () => {
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
      return new Response(JSON.stringify({
        SquareFeet: 1888,
        UnmappedProviderField: "retained",
      }));
    }
    return {
      ok: true,
      status: 200,
      text: async () => {
        throw new TypeError("simulated body read failure");
      },
    } as unknown as Response;
  }) as typeof fetch;
  try {
    assert.deepEqual(await importAndSubmit(params), {
      leadId: 0,
      submitted: false,
      error: "QuoteRUSH importer response could not be read",
      rawPropertyData: {
        SquareFeet: 1888,
        UnmappedProviderField: "retained",
      },
    });
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

test("successful property data survives an importer fetch exception", async () => {
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
      return new Response(JSON.stringify({
        SquareFeet: 1777,
        Unknown: { retained: true },
      }));
    }
    throw new TypeError("simulated importer connection failure");
  }) as typeof fetch;
  try {
    assert.deepEqual(await importAndSubmit(params), {
      leadId: 0,
      submitted: false,
      error: "QuoteRUSH importer response could not be read",
      rawPropertyData: {
        SquareFeet: 1777,
        Unknown: { retained: true },
      },
    });
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

test("public QuoteRUSH cache routes never serialize stored raw property data", () => {
  const routesSource = readFileSync(
    new URL("../routes.ts", import.meta.url),
    "utf8",
  );
  const cacheStart = routesSource.indexOf('"/api/insurance/qr-cache"');
  const cacheEnd = routesSource.indexOf("\n  );", cacheStart);
  const publicCacheSource = routesSource.slice(cacheStart, cacheEnd);
  assert.ok(cacheStart >= 0);
  assert.doesNotMatch(publicCacheSource, /rawQuoterushPropertyData/);
  assert.doesNotMatch(publicCacheSource, /raw_quoterush_property_data/);
  assert.match(routesSource, /rawQuoterushPropertyData: result\.rawPropertyData/);
  assert.match(routesSource, /rawQuoterushPropertyDataExpiresAt/);
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
    purchasePrice: 610_000, purchasePriceSource: "havo-purchase-scenario" as const,
    usageType: "primary" as const,
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

test("legacy index callers retain year/roof buckets while wind follows the corrected year rule", () => {
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
  assert.equal(legacy.openingProtection, "None");
  assert.equal(legacy.secondaryWaterResistance, "No");
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