/**
 * General purchase property-tax estimation service.
 *
 * Wraps the general property_tax_cache (Supabase) around each county's
 * live provider. County-specific logic (HCPA, Pinellas ArcGIS + bill scrape,
 * Manatee ArcGIS) writes both homestead and non-homestead effective
 * percentages plus fixed NAV so a single cache row serves any scenario.
 *
 * Cache hit path:
 *   read general cache → isCacheRowValid (parcel, price, expiry) →
 *   computeFromCache (selectedPct × price + fixed NAV) → return with source.
 *   Counties with fixed exemptions (Hillsborough/Pinellas) reuse effective
 *   percentages only at the exact sample price; linear formula counties may
 *   reuse them within the shared ±20% guardrail.
 *
 * Cache miss path (or >20% price, invalid, expired):
 *   live provider → compute both homestead/NH percentages → write cache →
 *   return result
 *
 * Hillsborough:
 *   Reads general cache first, then falls back to legacy HCPA cache during
 *   rollout. Live HCPA refresh uses calcAdValorem to derive both percentages
 *   at sample_price, writes general cache. When bill scrape provides NAV
 *   lines, upserts without losing verified rates/parcel.
 *
 * Pinellas:
 *   Writes complete live percentages only when bill millage is ready.
 *   Otherwise returns explicit pinellas-formula-fallback label and does
 *   NOT cache as a live row.
 *
 * Manatee:
 *   Writes formula homestead/NH percentages (COUNTY_MILLAGE) plus verified
 *   ArcGIS NAV dollars with source "manatee-formula-plus-arcgis-nav".
 */

import {
  getPropertyTaxCacheRow,
  writePropertyTaxCache,
  isCacheRowValid,
  computeFromCache,
} from "./property-tax-cache";
import {
  normalizeHillsboroughAddressKey,
} from "@shared/hillsborough-county";
import {
  lookupPIN,
  fetchHcpaRatesForPin,
  calcAdValorem,
  areHcpaRatesValid,
  supabaseHcpaTaxCache,
} from "./hillsborough-tax";
import {
  lookupPinellasParcel,
  lookupManateeParcel,
} from "./county-parcel-lookup";
import { getNonAdValoremForFolio } from "./tax-bill-scraper";

// ── Formula percentages used when live millage is unavailable ─────
// 2025 effective county tax rates as share of purchase price.
export const COUNTY_FORMULA_RATES: Record<string, { h: number; nh: number }> = {
  pinellas: { h: 0.01517, nh: 0.0185 },
  pasco: { h: 0.0141, nh: 0.0172 },
  manatee: { h: 0.01197, nh: 0.0146 },
  sarasota: { h: 0.0105, nh: 0.0128 },
  hernando: { h: 0.01197, nh: 0.0146 },
  lee: { h: 0.01148, nh: 0.014 },
  collier: { h: 0.00804, nh: 0.0098 },
  polk: { h: 0.01263, nh: 0.0154 },
};

// ── Shared address normalizer ──────────────────────────────────────
function normalizeAddr(address: string): string {
  // For Hillsborough we use the shared normalizer; for others a simple upper-trim.
  return address.trim().toUpperCase().replace(/\s+/g, " ");
}

// ── Result types ──────────────────────────────────────────────────

export interface PurchaseTaxResult {
  adValoremTax: number;
  nonAdValoremTax: number;
  annualTax: number;
  monthlyTax: number;
  source: string;
  fromGeneralCache: boolean;
  parcelId?: string;
  folio?: string;
  taxDistrict?: string;
  millageRate?: number;
  nonAdValoremLines?: Array<{ authority: string; amount: number }>;
  nonAdValoremPending?: boolean;
}

// ── Hillsborough ─────────────────────────────────────────────────

export async function getHillsboroughPurchaseTax(params: {
  address: string;
  purchasePrice: number;
  isPrimaryResidence: boolean;
  now?: Date;
}): Promise<PurchaseTaxResult | null> {
  const { address, purchasePrice, isPrimaryResidence } = params;
  const now = params.now ?? new Date();

  // Step 1: Check general cache (Supabase).
  const addrNorm = normalizeHillsboroughAddressKey(address);
  const cached = await getPropertyTaxCacheRow("hillsborough", addrNorm);
  if (
    cached &&
    isCacheRowValid(cached, purchasePrice, now, {
      requireExactSamplePrice: true,
    })
  ) {
    let cacheRow = cached;
    let nonAdValoremPending = /-nav-pending$/.test(cached.source);

    // A rates-only row remains useful while the bill scrape runs, but it must
    // keep checking for the fixed assessments instead of freezing $0 until
    // the annual expiry boundary.
    if (nonAdValoremPending && cached.folio) {
      const nav = await getNonAdValoremForFolio(
        cached.folio,
        "hillsborough",
      );
      if (nav.state === "ready") {
        const nonAdValoremAmtCents = Math.round(nav.data.total * 100);
        const source = cached.source.replace(/-nav-pending$/, "");
        await writePropertyTaxCache({
          county: cached.county,
          addressNormalized: cached.addressNormalized,
          addressDisplay: cached.addressDisplay,
          parcelId: cached.parcelId,
          folio: cached.folio,
          taxDistrict: cached.taxDistrict,
          homesteadAdValoremPct: cached.homesteadAdValoremPct,
          nonHomesteadAdValoremPct: cached.nonHomesteadAdValoremPct,
          samplePrice: cached.samplePrice,
          totalMillage: cached.totalMillage,
          nonAdValoremAmtCents,
          nonAdValoremLines: nav.data.lines,
          source,
          now,
        });
        cacheRow = {
          ...cached,
          nonAdValoremAmtCents,
          nonAdValoremLines: nav.data.lines,
          source,
        };
        nonAdValoremPending = false;
      }
    }

    const { adValoremTax, nonAdValoremTax, annualTax } = computeFromCache(
      cacheRow, purchasePrice, isPrimaryResidence
    );
    console.log(
      `[ptc] hillsborough general-cache hit: adVal=$${adValoremTax}` +
      ` nav=$${nonAdValoremTax} source=${cacheRow.source}`
    );
    return {
      adValoremTax,
      nonAdValoremTax,
      annualTax,
      monthlyTax: Math.round((annualTax / 12) * 100) / 100,
      source: cacheRow.source,
      fromGeneralCache: true,
      parcelId: cacheRow.parcelId ?? undefined,
      folio: cacheRow.folio ?? undefined,
      taxDistrict: cacheRow.taxDistrict ?? undefined,
      millageRate: cacheRow.totalMillage ?? undefined,
      nonAdValoremLines: cacheRow.nonAdValoremLines,
      nonAdValoremPending,
    };
  }

  // Step 2: Legacy HCPA cache (Supabase hcpa_tax_cache) as fallback during rollout.
  const legacyCached = await supabaseHcpaTaxCache.get(addrNorm);
  const legacyValid =
    legacyCached &&
    new Date(legacyCached.expiresAt).getTime() > now.getTime() &&
    legacyCached.folio &&
    areHcpaRatesValid(legacyCached);

  // Step 3: Preserve the existing legacy-rate cache as the second read path
  // during rollout. Raw school/non-school rates can be safely recalculated for
  // any price, then promoted into the general cache at the new sample price.
  if (legacyValid && legacyCached) {
    const hAdValorem = calcAdValorem(
      purchasePrice, true,
      legacyCached.schoolTaxRate, legacyCached.nonschoolTaxRate,
      legacyCached.totalTaxRate,
    );
    const nhAdValorem = calcAdValorem(
      purchasePrice, false,
      legacyCached.schoolTaxRate, legacyCached.nonschoolTaxRate,
      legacyCached.totalTaxRate,
    );
    let navTotal = legacyCached.nonAdValoremTaxes;
    let navLines: Array<{ authority: string; amount: number }> = [];
    let navPending = navTotal <= 0;
    const nav = await getNonAdValoremForFolio(
      legacyCached.folio!,
      "hillsborough",
    );
    if (nav.state === "ready") {
      navTotal = Math.round(nav.data.total * 100) / 100;
      navLines = nav.data.lines;
      navPending = false;
    }
    const source = navPending
      ? "hillsborough-hcpa-cache-nav-pending"
      : "hillsborough-hcpa-cache";
    await writePropertyTaxCache({
      county: "hillsborough",
      addressNormalized: addrNorm,
      addressDisplay: address.trim(),
      parcelId: legacyCached.pin,
      folio: legacyCached.folio,
      taxDistrict: legacyCached.taxDistrict,
      homesteadAdValoremPct: hAdValorem / purchasePrice,
      nonHomesteadAdValoremPct: nhAdValorem / purchasePrice,
      samplePrice: purchasePrice,
      totalMillage: legacyCached.totalTaxRate,
      nonAdValoremAmtCents: Math.round(navTotal * 100),
      nonAdValoremLines: navLines,
      source,
      now,
    });
    const adValorem = isPrimaryResidence ? hAdValorem : nhAdValorem;
    const annualTax = adValorem + navTotal;
    return {
      adValoremTax: adValorem,
      nonAdValoremTax: navTotal,
      annualTax,
      monthlyTax: Math.round((annualTax / 12) * 100) / 100,
      source: "hcpa-cache",
      fromGeneralCache: false,
      parcelId: legacyCached.pin,
      folio: legacyCached.folio ?? undefined,
      taxDistrict: legacyCached.taxDistrict,
      millageRate: legacyCached.totalTaxRate,
      nonAdValoremLines: navLines,
      nonAdValoremPending: navPending,
    };
  }

  // Step 4: Live HCPA fetch.
  const found = await lookupPIN(address);
  if (!found) return null;

  const { pin, folio } = found;

  // Fetch millage rates from HCPA TaxEstimator.
  const taxData = await fetchHcpaRatesForPin(pin);
  if (!taxData) {
    return null;
  }

  // Derive both homestead and non-homestead percentages at samplePrice=purchasePrice.
  const samplePrice = purchasePrice;
  const hAdValorem = calcAdValorem(
    samplePrice, true,
    taxData.schoolTaxRate, taxData.nonschoolTaxRate, taxData.totalTaxRate
  );
  const nhAdValorem = calcAdValorem(
    samplePrice, false,
    taxData.schoolTaxRate, taxData.nonschoolTaxRate, taxData.totalTaxRate
  );
  const hPct = samplePrice > 0 ? hAdValorem / samplePrice : 0;
  const nhPct = samplePrice > 0 ? nhAdValorem / samplePrice : 0;

  // Get NAV (non-blocking — may be pending).
  let navTotal = 0;
  let navLines: Array<{ authority: string; amount: number }> = [];
  let navPending = false;
  if (folio) {
    const nav = await getNonAdValoremForFolio(folio, "hillsborough");
    if (nav.state === "ready") {
      navTotal = Math.round(nav.data.total * 100) / 100;
      navLines = nav.data.lines;
    } else if (
      legacyCached?.pin === pin &&
      legacyCached.nonAdValoremTaxes > 0
    ) {
      navTotal = legacyCached.nonAdValoremTaxes;
    } else {
      navPending = true;
    }
  }

  // Write to general cache (only when we have folio for verified parcel identity).
  if (folio && hPct > 0 && nhPct > 0) {
    await writePropertyTaxCache({
      county: "hillsborough",
      addressNormalized: addrNorm,
      addressDisplay: address.trim(),
      parcelId: pin,
      folio,
      taxDistrict: taxData.taxDistrict,
      homesteadAdValoremPct: hPct,
      nonHomesteadAdValoremPct: nhPct,
      samplePrice,
      totalMillage: taxData.totalTaxRate,
      nonAdValoremAmtCents: navPending ? 0 : Math.round(navTotal * 100),
      nonAdValoremLines: navPending ? [] : navLines,
      source: navPending ? "hillsborough-hcpa-api-nav-pending" : "hillsborough-hcpa-api",
      now,
    });
  }

  // Also update legacy HCPA cache if folio.
  if (folio) {
    await supabaseHcpaTaxCache.set({
      addressNormalized: addrNorm,
      addressDisplay: address.trim(),
      pin,
      folio,
      schoolTaxRate: taxData.schoolTaxRate,
      nonschoolTaxRate: taxData.nonschoolTaxRate,
      totalTaxRate: taxData.totalTaxRate,
      nonAdValoremTaxes: navPending ? (legacyCached?.pin === pin ? legacyCached.nonAdValoremTaxes : 0) : navTotal,
      taxDistrict: taxData.taxDistrict,
      queriedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  const adValorem = isPrimaryResidence ? hAdValorem : nhAdValorem;
  const annualTax = adValorem + navTotal;
  return {
    adValoremTax: adValorem,
    nonAdValoremTax: navTotal,
    annualTax,
    monthlyTax: Math.round((annualTax / 12) * 100) / 100,
    source: "hcpa-api",
    fromGeneralCache: false,
    parcelId: pin,
    folio: folio ?? undefined,
    taxDistrict: taxData.taxDistrict,
    millageRate: taxData.totalTaxRate,
    nonAdValoremLines: navLines,
    nonAdValoremPending: navPending,
  };
}

// ── Pinellas ─────────────────────────────────────────────────────

export function computePinellasAdValorem(params: {
  purchasePrice: number;
  justValue: number;
  isPrimaryResidence: boolean;
  billMillage: number;
  billMills: Array<{ authority: string; mills: number }> | null;
}): number {
  const SCHOOL_MILLS = 6.293;
  const SCHOOL_EXEMPTION = 25_000;
  const NON_SCHOOL_EXEMPTION = 51_411;
  const estimatedJustValue = Math.max(
    0.85 * params.purchasePrice,
    params.justValue,
  );
  const schoolTaxable = params.isPrimaryResidence
    ? Math.max(estimatedJustValue - SCHOOL_EXEMPTION, 0)
    : estimatedJustValue;
  const nonSchoolTaxable = params.isPrimaryResidence
    ? Math.max(estimatedJustValue - NON_SCHOOL_EXEMPTION, 0)
    : estimatedJustValue;

  if (params.billMills?.length) {
    return params.billMills.reduce((sum, line) => {
      const taxable = /SCHOOL/i.test(line.authority)
        ? schoolTaxable
        : nonSchoolTaxable;
      return sum + Math.round((taxable * line.mills) / 1000);
    }, 0);
  }

  const nonSchoolMills = Math.max(params.billMillage - SCHOOL_MILLS, 0);
  return Math.round(
    (
      schoolTaxable * SCHOOL_MILLS +
      nonSchoolTaxable * nonSchoolMills
    ) / 1000,
  );
}

export async function getPinellasPurchaseTax(params: {
  address: string;
  purchasePrice: number;
  isPrimaryResidence: boolean;
  now?: Date;
}): Promise<{
  adValorem: number;
  nonAdValorem: number;
  nonAdValoremLines: Array<{ authority: string; amount: number }>;
  nonAdValoremPending: boolean;
  source: string;
  parcelId: string | null;
  millageRate: number | null;
  fromGeneralCache: boolean;
}> {
  const { address, purchasePrice, isPrimaryResidence } = params;
  const now = params.now ?? new Date();
  const addrNorm = normalizeAddr(address);

  // Check general cache.
  const cached = await getPropertyTaxCacheRow("pinellas", addrNorm);
  if (
    cached &&
    isCacheRowValid(cached, purchasePrice, now, {
      requireExactSamplePrice: true,
    })
  ) {
    const { adValoremTax, nonAdValoremTax } = computeFromCache(
      cached, purchasePrice, isPrimaryResidence
    );
    console.log(
      `[ptc] pinellas general-cache hit: adVal=$${adValoremTax}` +
      ` nav=$${nonAdValoremTax} source=${cached.source}`
    );
    return {
      adValorem: adValoremTax,
      nonAdValorem: nonAdValoremTax,
      nonAdValoremLines: cached.nonAdValoremLines,
      nonAdValoremPending: false,
      source: cached.source,
      parcelId: cached.parcelId,
      millageRate: cached.totalMillage,
      fromGeneralCache: true,
    };
  }

  // Live parcel lookup.
  const parcel = await lookupPinellasParcel(address);
  const parcelId = parcel?.account ?? null;

  const formulaRates = COUNTY_FORMULA_RATES.pinellas!;
  const formulaAdValorem = Math.round(
    purchasePrice * (isPrimaryResidence ? formulaRates.h : formulaRates.nh)
  );

  if (!parcel || !parcelId) {
    return {
      adValorem: formulaAdValorem,
      nonAdValorem: 0,
      nonAdValoremLines: [],
      nonAdValoremPending: false,
      source: "pinellas-formula-fallback",
      parcelId: null,
      millageRate: null,
      fromGeneralCache: false,
    };
  }

  // Get NAV + bill millage.
  let nonAdValorem = 0;
  let nonAdValoremLines: Array<{ authority: string; amount: number }> = [];
  let nonAdValoremPending = false;
  let billMillage: number | null = null;
  let billMills: Array<{ authority: string; mills: number }> | null = null;

  const nav = await getNonAdValoremForFolio(parcelId, "pinellas");
  if (nav.state === "ready") {
    nonAdValorem = Math.round(nav.data.total * 100) / 100;
    nonAdValoremLines = nav.data.lines;
    billMillage = nav.data.totalMillage;
    billMills = nav.data.adValoremMills;
  } else if (nav.state === "pending") {
    nonAdValoremPending = true;
  }

  // Compute Pinellas ad-valorem using the county's Tax Estimator method,
  // but ONLY when bill millage is ready.
  let pinellasAdValorem: number | null = null;
  let source: string;

  if (billMillage) {
    pinellasAdValorem = computePinellasAdValorem({
      purchasePrice,
      justValue: parcel.justValue ?? 0,
      isPrimaryResidence,
      billMillage,
      billMills,
    });

    // Derive both pcts at sample_price and write live cache.
    const hAdValorem = computePinellasAdValorem({
      purchasePrice,
      justValue: parcel.justValue ?? 0,
      isPrimaryResidence: true,
      billMillage,
      billMills,
    });
    const nhAdValorem = computePinellasAdValorem({
      purchasePrice,
      justValue: parcel.justValue ?? 0,
      isPrimaryResidence: false,
      billMillage,
      billMills,
    });

    const hPct = purchasePrice > 0 ? hAdValorem / purchasePrice : 0;
    const nhPct = purchasePrice > 0 ? nhAdValorem / purchasePrice : 0;

    if (hPct > 0 && nhPct > 0) {
      await writePropertyTaxCache({
        county: "pinellas",
        addressNormalized: addrNorm,
        addressDisplay: address.trim(),
        parcelId,
        folio: parcelId,
        taxDistrict: "pinellas",
        homesteadAdValoremPct: hPct,
        nonHomesteadAdValoremPct: nhPct,
        samplePrice: purchasePrice,
        totalMillage: billMillage,
        nonAdValoremAmtCents: nonAdValoremPending
          ? 0
          : Math.round(nonAdValorem * 100),
        nonAdValoremLines: nonAdValoremPending ? [] : nonAdValoremLines,
        source: "pinellas-bill-live",
        now,
      });
    }
    source = "pinellas-bill-live";
  } else {
    // Bill millage not ready — use formula, explicitly labeled.
    pinellasAdValorem = formulaAdValorem;
    source = nonAdValoremPending
      ? "pinellas-formula-pending"
      : "pinellas-formula-fallback";
    // Do NOT cache as live.
  }

  return {
    adValorem: pinellasAdValorem ?? formulaAdValorem,
    nonAdValorem,
    nonAdValoremLines,
    nonAdValoremPending,
    source,
    parcelId,
    millageRate: billMillage,
    fromGeneralCache: false,
  };
}

// ── Manatee ──────────────────────────────────────────────────────

export async function getManateePurchaseTax(params: {
  address: string;
  purchasePrice: number;
  isPrimaryResidence: boolean;
  now?: Date;
}): Promise<{
  adValorem: number;
  nonAdValorem: number;
  nonAdValoremLines: Array<{ authority: string; amount: number }>;
  source: string;
  parcelId: string | null;
  fromGeneralCache: boolean;
}> {
  const { address, purchasePrice, isPrimaryResidence } = params;
  const now = params.now ?? new Date();
  const addrNorm = normalizeAddr(address);

  // Check general cache.
  const cached = await getPropertyTaxCacheRow("manatee", addrNorm);
  if (cached && isCacheRowValid(cached, purchasePrice, now)) {
    const { adValoremTax, nonAdValoremTax } = computeFromCache(
      cached, purchasePrice, isPrimaryResidence
    );
    console.log(
      `[ptc] manatee general-cache hit: adVal=$${adValoremTax}` +
      ` nav=$${nonAdValoremTax} source=${cached.source}`
    );
    return {
      adValorem: adValoremTax,
      nonAdValorem: nonAdValoremTax,
      nonAdValoremLines: cached.nonAdValoremLines,
      source: cached.source,
      parcelId: cached.parcelId,
      fromGeneralCache: true,
    };
  }

  // Live ArcGIS lookup.
  const formulaRates = COUNTY_FORMULA_RATES.manatee!;
  const hPct = formulaRates.h;
  const nhPct = formulaRates.nh;
  const adValorem = Math.round(purchasePrice * (isPrimaryResidence ? hPct : nhPct));

  const parcel = await lookupManateeParcel(address);
  if (!parcel) {
    return {
      adValorem,
      nonAdValorem: 0,
      nonAdValoremLines: [],
      source: "manatee-formula-fallback",
      parcelId: null,
      fromGeneralCache: false,
    };
  }

  console.log(
    `[county-tax] manatee parcel=${parcel.parid}` +
    ` adVal=$${adValorem} nonAdVal=$${parcel.totalNonAdValorem}` +
    ` cdd=${parcel.navCddName ?? "none"}`
  );

  // Write general cache with formula percentages + verified ArcGIS NAV.
  await writePropertyTaxCache({
    county: "manatee",
    addressNormalized: addrNorm,
    addressDisplay: address.trim(),
    parcelId: parcel.parid,
    folio: parcel.parid,
    taxDistrict: parcel.situsCity || "manatee",
    homesteadAdValoremPct: hPct,
    nonHomesteadAdValoremPct: nhPct,
    samplePrice: purchasePrice,
    totalMillage: null,
    nonAdValoremAmtCents: parcel.totalNonAdValorem * 100,
    nonAdValoremLines: parcel.navLines,
    source: "manatee-formula-plus-arcgis-nav",
    now,
  });

  return {
    adValorem,
    nonAdValorem: parcel.totalNonAdValorem,
    nonAdValoremLines: parcel.navLines,
    source: "manatee-formula-plus-arcgis-nav",
    parcelId: parcel.parid,
    fromGeneralCache: false,
  };
}
