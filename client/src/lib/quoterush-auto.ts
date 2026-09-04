// Shared QuoteRUSH auto-trigger utility.
//
// Uses localStorage as a fast per-browser cache backed by the shared
// server DB cache (insurance_quote_cache). Safe to call from any page —
// it deduplicates automatically so entering the same address on several
// pages never triggers a duplicate (paid) quote.

const LS_PREFIX = "qr_auto_";
const LS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const pendingStarts = new Map<string, Promise<void>>();
type AccessTokenProvider = () => Promise<string | undefined>;
let testAccessTokenProvider: AccessTokenProvider | null = null;

export function setAutoQuoteAccessTokenProviderForTests(
  provider: AccessTokenProvider | null,
): void {
  testAccessTokenProvider = provider;
}

async function authenticatedStartFetch(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const token = testAccessTokenProvider
    ? await testAccessTokenProvider()
    : await (async () => {
        const { supabase } = await import("./supabase");
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token;
      })();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}

export interface QRQuote {
  siteName: string;
  annualPremium: number;
  monthlyPremium: number;
  coverageA: number;
  hurricaneDeductible: string;
  aop: string;
  quoteUrl: string | null;
  quoteDate: string;
  rank: number;
}

export interface QRCacheEntry {
  address: string;
  policyType: "HO3" | "HO6" | "DP3";
  leadId: number | null;
  status: "pending" | "success" | "error";
  quotes: QRQuote[];
  quoteCounter: number;
  coverageA: number;
  propertyDataSnapshot?: Record<string, unknown>;
  propertyDataProvenance?: Record<string, unknown>;
  agencyDefaultSnapshot?: Record<string, unknown>;
  consumerPropertyAnswers?: Record<string, unknown>;
  quoteProfileVersion?: string;
  assumptions?: string[];
  expiresAt: string; // ISO
  triggeredAt: string; // ISO
}

function normalizePolicyType(
  policyType?: string,
): "HO3" | "HO6" | "DP3" {
  return policyType === "HO6" || policyType === "DP3"
    ? policyType
    : "HO3";
}

function lsKey(address: string, policyType?: string): string {
  return (
    LS_PREFIX +
    address
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .slice(0, 80) +
    "_" +
    normalizePolicyType(policyType).toLowerCase()
  );
}

export function getQRCache(
  address: string,
  policyType?: string,
): QRCacheEntry | null {
  if (!address) return null;
  try {
    const key = lsKey(address, policyType);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const e = JSON.parse(raw) as QRCacheEntry;
    if (new Date(e.expiresAt) < new Date()) {
      localStorage.removeItem(key);
      return null;
    }
    return e;
  } catch {
    return null;
  }
}

export function setQRCache(
  address: string,
  patch: Partial<QRCacheEntry>,
  policyType?: string,
): void {
  if (!address) return;
  try {
    const normalizedPolicyType = normalizePolicyType(
      policyType ?? patch.policyType,
    );
    const key = lsKey(address, normalizedPolicyType);
    const existing = getQRCache(address, normalizedPolicyType);
    const expiresAt =
      patch.expiresAt ??
      existing?.expiresAt ??
      new Date(Date.now() + LS_TTL_MS).toISOString();
    const next: QRCacheEntry = {
      address,
      policyType: normalizedPolicyType,
      leadId: null,
      status: "pending",
      quotes: [],
      quoteCounter: 0,
      coverageA: 0,
      triggeredAt: new Date().toISOString(),
      ...(existing ?? {}),
      ...patch,
      expiresAt,
    };
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
}

export function isQRExpired(address: string, policyType?: string): boolean {
  const e = getQRCache(address, policyType);
  if (!e) return true;
  return new Date(e.expiresAt) < new Date();
}

export function clearQRCache(address: string, policyType?: string): void {
  try {
    localStorage.removeItem(lsKey(address, policyType));
  } catch {}
}

/**
 * Checks the shared server DB cache for an address. If a valid (non
 * expired) entry exists, hydrates localStorage and returns it.
 */
export async function checkServerCache(
  address: string,
  policyType?: string,
): Promise<QRCacheEntry | null> {
  if (!address) return null;
  try {
    const res = await fetch(
      `/api/insurance/qr-cache?address=` +
        encodeURIComponent(address) +
        `&policyType=${encodeURIComponent(normalizePolicyType(policyType))}`
    );
    const data = await res.json();
    if (!data.found || data.expired) return null;

    const entry: QRCacheEntry = {
      address,
      policyType: normalizePolicyType(policyType),
      leadId: data.leadId ?? null,
      status: data.status ?? "pending",
      quotes: data.quotes ?? [],
      quoteCounter: data.quoteCounter ?? 0,
      coverageA: data.coverageA ?? 0,
      propertyDataSnapshot: data.propertyDataSnapshot ?? {},
      propertyDataProvenance: data.propertyDataProvenance ?? {},
      agencyDefaultSnapshot: data.agencyDefaultSnapshot ?? {},
      consumerPropertyAnswers: data.consumerPropertyAnswers ?? {},
      quoteProfileVersion: data.quoteProfileVersion,
      assumptions: data.assumptions ?? [],
      expiresAt:
        data.expiresAt ??
        new Date(Date.now() + LS_TTL_MS).toISOString(),
      triggeredAt:
        data.triggeredAt ?? new Date().toISOString(),
    };

    setQRCache(address, entry, entry.policyType);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Main trigger function. Call from any page when an address + price are
 * confirmed. Safe to call multiple times — it deduplicates against both
 * the localStorage and shared server caches before spending a quote.
 */
export interface AutoQuoteOptions {
  address: string;
  price?: number; // full property value
  coverageA?: number; // or Coverage A directly
  policyType?: string;
  floodZone?: string;
  isAuthenticated: boolean;
  yearBuilt: number;
  roofYear: number;
  openingProtection: boolean;
  roofShape: "Hip" | "Flat" | "Gable";
  secondaryWaterResistance: "Yes" | "No" | "Unknown";
  constIdx: 0 | 1 | 2;
  hurrIdx: 0 | 1 | 2;
  aopDeductible: 500 | 1000 | 2500 | 5000 | 10000;
  /** Auto-starts cannot truthfully infer claims, so callers must provide the
   * explicit answer and records collected from the applicant. */
  hasClaims: boolean;
  claimRecords: Array<{
    lossDate: string; claimDetail: string; amount: number;
    paid: boolean; priorResidence: boolean;
  }>;
  sqFt?: number;
  newPurchase?: boolean;
}

async function startAutoQuote(opts: AutoQuoteOptions): Promise<void> {
  const { address, isAuthenticated } = opts;
  const policyType = normalizePolicyType(opts.policyType);

  if (!isAuthenticated) return;
  if (!address || address === "Unknown Address") return;

  const coverageA =
    opts.coverageA ??
    Math.round((opts.price ?? 0) * 0.85);

  if (coverageA <= 0) return;

  const hasExactPropertyAnswers =
    Number.isInteger(opts.yearBuilt) &&
    Number.isInteger(opts.roofYear) &&
    typeof opts.openingProtection === "boolean" &&
    ["Hip", "Flat", "Gable"].includes(opts.roofShape) &&
    ["Yes", "No", "Unknown"].includes(opts.secondaryWaterResistance);
  if (!hasExactPropertyAnswers) {
    throw new Error(
      "Exact property answers are required before starting a live QuoteRUSH quote."
    );
  }

  const windIdx =
    opts.openingProtection &&
    opts.roofShape === "Hip" &&
    opts.secondaryWaterResistance === "Yes"
      ? 2
      : !opts.openingProtection &&
          opts.roofShape === "Gable" &&
          opts.secondaryWaterResistance === "No"
        ? 0
        : 1;

  // Fast local check.
  const cached = getQRCache(address, policyType);
  if (
    cached &&
    (cached.status === "pending" ||
      cached.status === "success")
  )
    return;

  // Shared server cache check.
  const serverCached = await checkServerCache(address, policyType);
  if (
    serverCached &&
    (serverCached.status === "pending" ||
      serverCached.status === "success")
  )
    return;

  // Not cached anywhere — mark pending locally and trigger.
  setQRCache(address, {
    status: "pending",
    coverageA,
    leadId: null,
    quotes: [],
    quoteCounter: 0,
    triggeredAt: new Date().toISOString(),
  }, policyType);

  console.log(
    "[qr-auto] triggering:",
    address,
    "coverageA:",
    coverageA
  );

  try {
    const res = await authenticatedStartFetch("/api/insurance/qr-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        coverageA,
        policyType,
        yearBuilt: opts.yearBuilt,
        roofYear: opts.roofYear,
        openingProtection: opts.openingProtection,
        roofShape: opts.roofShape,
        secondaryWaterResistance: opts.secondaryWaterResistance,
        constIdx: opts.constIdx,
        windIdx,
        hurrIdx: opts.hurrIdx,
        hasClaims: opts.hasClaims,
        claimRecords: opts.claimRecords,
        aopDeductible: opts.aopDeductible,
        floodZone: opts.floodZone || "X",
        sqFt: opts.sqFt ?? 0,
        newPurchase: opts.newPurchase ?? false,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (
        res.status === 428 &&
        data.code === "DOB_REQUIRED"
      ) {
        // DOB must be collected through the authenticated manual preflight.
        // Remove the speculative pending entry so that flow is not blocked.
        clearQRCache(address, policyType);
        return;
      }
      setQRCache(address, { status: "error" }, policyType);
      return;
    }

    if (data.leadId) {
      setQRCache(address, {
        leadId: data.leadId,
        ...(data.fromCache && data.quotes?.length > 0
          ? {
              status: "success" as const,
              quotes: data.quotes,
              quoteCounter: data.quoteCounter,
              expiresAt: data.expiresAt,
            }
          : {}),
      }, policyType);
    } else if (data.status === "pending") {
      // Lost the claim race — another concurrent request is submitting
      // this address. Stay pending (leadId will arrive shortly) rather
      // than poisoning local state with an error.
      setQRCache(
        address,
        { status: "pending", leadId: null },
        policyType,
      );
    } else {
      setQRCache(address, { status: "error" }, policyType);
    }
  } catch (e) {
    console.error("[qr-auto] error:", e);
    setQRCache(address, { status: "error" }, policyType);
  }
}

export function triggerAutoQuote(opts: AutoQuoteOptions): Promise<void> {
  const key = lsKey(opts.address, opts.policyType);
  const existing = pendingStarts.get(key);
  if (existing) return existing;

  const start = startAutoQuote(opts).finally(() => {
    pendingStarts.delete(key);
  });
  pendingStarts.set(key, start);
  return start;
}
