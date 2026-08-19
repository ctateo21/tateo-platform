import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearQRCache,
  getQRCache,
  setAutoQuoteAccessTokenProviderForTests,
  triggerAutoQuote,
  type AutoQuoteOptions,
} from "./quoterush-auto";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const options: AutoQuoteOptions = {
  address: "123 Palm Way, Tampa, FL 33602",
  coverageA: 425_000,
  isAuthenticated: true,
  yearBuilt: 2007,
  roofYear: 2022,
  openingProtection: true,
  roofShape: "Hip",
  secondaryWaterResistance: "Yes",
  constIdx: 1,
  hurrIdx: 1,
  aopDeductible: 1000,
};

test("cached and concurrent triggers do not start another paid quote", async () => {
  const previousStorage = globalThis.localStorage;
  const previousFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
  let starts = 0;
  setAutoQuoteAccessTokenProviderForTests(
    async () => "test-access-token",
  );
  globalThis.fetch = (async (url, init) => {
    if (String(url).startsWith("/api/insurance/qr-cache")) {
      await new Promise(resolve => setTimeout(resolve, 5));
      return new Response(JSON.stringify({ found: false }));
    }
    if (String(url) === "/api/insurance/qr-start") {
      starts++;
      const headers = new Headers(init?.headers);
      assert.equal(
        headers.get("Authorization"),
        "Bearer test-access-token",
        "automatic quote starts must authenticate the Supabase user",
      );
      return new Response(JSON.stringify({ leadId: 321 }));
    }
    throw new Error(`Unexpected URL ${url}`);
  }) as typeof fetch;

  try {
    await Promise.all([triggerAutoQuote(options), triggerAutoQuote(options)]);
    assert.equal(starts, 1, "concurrent callers share one paid quote start");
    await triggerAutoQuote(options);
    assert.equal(starts, 1, "the pending local cache prevents a second start");
  } finally {
    clearQRCache(options.address);
    setAutoQuoteAccessTokenProviderForTests(null);
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: previousStorage,
    });
  }
});

test("DOB preflight responses do not poison the local quote cache", async () => {
  const previousStorage = globalThis.localStorage;
  const previousFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
  setAutoQuoteAccessTokenProviderForTests(
    async () => "test-access-token",
  );
  globalThis.fetch = (async (url, init) => {
    if (String(url).startsWith("/api/insurance/qr-cache")) {
      return new Response(JSON.stringify({ found: false }));
    }
    if (String(url) === "/api/insurance/qr-start") {
      const headers = new Headers(init?.headers);
      assert.equal(
        headers.get("Authorization"),
        "Bearer test-access-token",
      );
      return new Response(
        JSON.stringify({ code: "DOB_REQUIRED" }),
        { status: 428 },
      );
    }
    throw new Error(`Unexpected URL ${url}`);
  }) as typeof fetch;

  try {
    await triggerAutoQuote(options);
    assert.equal(
      getQRCache(options.address),
      null,
      "DOB_REQUIRED should leave the address eligible for manual preflight",
    );
  } finally {
    clearQRCache(options.address);
    setAutoQuoteAccessTokenProviderForTests(null);
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: previousStorage,
    });
  }
});

test("a shared server-cache hit prevents a paid quote start", async () => {
  const previousStorage = globalThis.localStorage;
  const previousFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
  let starts = 0;
  globalThis.fetch = (async (url) => {
    if (String(url).startsWith("/api/insurance/qr-cache")) {
      return new Response(JSON.stringify({
        found: true,
        expired: false,
        status: "success",
        leadId: 321,
        quotes: [{ siteName: "Cached Carrier" }],
      }));
    }
    if (String(url) === "/api/insurance/qr-start") {
      starts++;
      return new Response(JSON.stringify({ leadId: 654 }));
    }
    throw new Error(`Unexpected URL ${url}`);
  }) as typeof fetch;

  try {
    await triggerAutoQuote(options);
    assert.equal(starts, 0);
  } finally {
    clearQRCache(options.address);
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: previousStorage,
    });
  }
});