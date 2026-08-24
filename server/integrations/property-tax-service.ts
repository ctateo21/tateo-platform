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
} from "./hillsborough-tax";
import {
  lookupPinellasParcel,
  lookupManateeParcel,
} from "./county-parcel-lookup";
import {
  getNonAdValoremForFolio,
  type TaxSysSitusIdentity,
} from "./tax-bill-scraper";
import {
  resolveParcel,
  type CountySlug,
} from "./parcel-resolver";
import { getPolkPhenixTaxBill } from "./polk-phenix-tax";

// ── Formula percentages used when live millage is unavailable ─────
// 2025 effective county tax rates as share of purchase price.
export const COUNTY_FORMULA_RATES: Record<string, { h: number; nh: number }> = {
  pinellas: { h: 0.01517, nh: 0.0185 },
  pasco: { h: 0.0141, nh: 0.0172 },
  manatee: { h: 0.01197, nh: 0.0146 },
  sarasota: { h: 0.0105, nh: 0.0128 },
  hernando: { h: 0.01197, nh: 0.0146 },
  lee: { h: 0.01148, nh: 0.014 },
  // 2025 Collier parcel millage is roughly 11.05 mills. New-purchase
  // reassessment at the shared 85% model is about 0.94% before homestead.
  collier: { h: 0.00825, nh: 0.00939 },
  polk: { h: 0.01263, nh: 0.0154 },
};

export function deriveCountyAssessmentBasis(params: {
  county: CountySlug;
  purchasePrice: number;
  justValue?: number;
  assessedValue?: number;
}): {
  assessmentRatio: number;
  homesteadNonSchoolExemption: number;
  valueBasis: "verified-parcel-value" | "formula-assumed-market-value";
} {
  const observedValue =
    Number.isFinite(params.justValue) && (params.justValue ?? 0) > 0
      ? params.justValue!
      : Number.isFinite(params.assessedValue) &&
          (params.assessedValue ?? 0) > 0
        ? params.assessedValue!
        : null;
  const observedRatio =
    observedValue && params.purchasePrice > 0
      ? observedValue / params.purchasePrice
      : null;
  const saneObservedRatio =
    observedRatio != null && observedRatio >= 0.25 && observedRatio <= 2
      ? observedRatio
      : null;

  // Pinellas's public estimator uses the larger of 85% of purchase price or
  // current just value. The ratio captures that verified basis at cache time,
  // as required by the arbitrary-price cache contract.
  const assessmentRatio =
    params.county === "pinellas"
      ? Math.max(0.85, saneObservedRatio ?? 0.85)
      : saneObservedRatio ?? 1;

  return {
    assessmentRatio,
    homesteadNonSchoolExemption:
      params.county === "pinellas" ? 51_411 : 50_000,
    valueBasis: saneObservedRatio
      ? "verified-parcel-value"
      : "formula-assumed-market-value",
  };
}

// ── Shared address normalizer ──────────────────────────────────────
function normalizeAddr(address: string): string {
  // For Hillsborough we use the shared normalizer; for others a simple upper-trim.
  return address.trim().toUpperCase().replace(/\s+/g, " ");
}

function expectedTaxSysSitus(
  county: CountySlug,
  address: string,
): TaxSysSitusIdentity {
  const parts = address.split(",");
  return {
    county: county.charAt(0).toUpperCase() + county.slice(1),
    situsAddress: (parts[0] ?? "").trim(),
    situsCity: (parts[1] ?? "").trim(),
  };
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
  operationalError?: string;
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
    (
      cached.source.endsWith("-situs-v2") ||
      cached.source.endsWith("-nav-pending")
    ) &&
    isCacheRowValid(cached, purchasePrice, now)
  ) {
    let cacheRow = cached;
    let nonAdValoremPending = /-nav-pending$/.test(cached.source);
    let operationalError: string | undefined;

    // A rates-only row remains useful while the bill scrape runs, but it must
    // keep checking for the fixed assessments instead of freezing $0 until
    // the annual expiry boundary.
    if (nonAdValoremPending && cached.folio) {
      const nav = await getNonAdValoremForFolio(
        cached.folio,
        "hillsborough",
        undefined,
        { expectedSitus: expectedTaxSysSitus("hillsborough", address) },
      );
      if (nav.state === "ready") {
        const nonAdValoremAmtCents = Math.round(nav.data.total * 100);
        const source =
          `${cached.source.replace(/-nav-pending$/, "")}-situs-v2`;
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
          schoolMillage: cached.schoolMillage,
          nonSchoolMillage: cached.nonSchoolMillage,
          assessmentRatio: cached.assessmentRatio,
          homesteadSchoolExemption: cached.homesteadSchoolExemption,
          homesteadNonSchoolExemption: cached.homesteadNonSchoolExemption,
          parcelSource: cached.parcelSource,
          rateYear: cached.rateYear,
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
      } else if (
        nav.state === "unavailable" &&
        nav.reason === "apify_token_missing"
      ) {
        nonAdValoremPending = false;
        operationalError =
          "Live county tax bills are unavailable because APIFY_TOKEN is not configured.";
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
      operationalError,
    };
  }

  // Step 2: Live HCPA fetch.
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
  let operationalError: string | undefined;
  if (folio) {
    const nav = await getNonAdValoremForFolio(
      folio,
      "hillsborough",
      undefined,
      { expectedSitus: expectedTaxSysSitus("hillsborough", address) },
    );
    if (nav.state === "ready") {
      navTotal = Math.round(nav.data.total * 100) / 100;
      navLines = nav.data.lines;
    } else {
      navPending = nav.state === "pending";
      if (
        nav.state === "unavailable" &&
        nav.reason === "apify_token_missing"
      ) {
        operationalError =
          "Live county tax bills are unavailable because APIFY_TOKEN is not configured.";
      }
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
      schoolMillage: taxData.schoolTaxRate,
      nonSchoolMillage: taxData.nonschoolTaxRate,
      assessmentRatio: 0.85,
      homesteadSchoolExemption: 25_000,
      homesteadNonSchoolExemption: 50_000,
      parcelSource: "hcpa-api",
      rateYear: now.getUTCFullYear(),
      nonAdValoremAmtCents: navPending ? 0 : Math.round(navTotal * 100),
      nonAdValoremLines: navPending ? [] : navLines,
      source: navPending || operationalError
        ? "hillsborough-hcpa-api-nav-pending"
        : "hillsborough-hcpa-api-situs-v2",
      now,
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
    operationalError,
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
    isCacheRowValid(cached, purchasePrice, now)
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
  let billYear: number | null = null;

  const nav = await getNonAdValoremForFolio(
    parcelId,
    "pinellas",
    undefined,
    { expectedSitus: expectedTaxSysSitus("pinellas", address) },
  );
  if (nav.state === "ready") {
    nonAdValorem = Math.round(nav.data.total * 100) / 100;
    nonAdValoremLines = nav.data.lines;
    billMillage = nav.data.totalMillage;
    billMills = nav.data.adValoremMills;
    billYear = nav.data.billYear;
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
      const schoolMillage = billMills?.length
        ? billMills
            .filter((line) => /SCHOOL/i.test(line.authority))
            .reduce((sum, line) => sum + line.mills, 0)
        : Math.min(SCHOOL_MILLAGE_FALLBACK, billMillage);
      const nonSchoolMillage = Math.max(billMillage - schoolMillage, 0);
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
        schoolMillage,
        nonSchoolMillage,
        assessmentRatio: 0.85,
        homesteadSchoolExemption: 25_000,
        homesteadNonSchoolExemption: 51_411,
        parcelSource: "pinellas-pa-arcgis",
        rateYear: billYear ?? now.getUTCFullYear(),
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

const SCHOOL_MILLAGE_FALLBACK = 6.293;

function formulaPurchaseResult(params: {
  county: CountySlug;
  purchasePrice: number;
  isPrimaryResidence: boolean;
  sourceSuffix?: string;
  parcelId?: string;
  operationalError?: string;
}): PurchaseTaxResult {
  const rates = COUNTY_FORMULA_RATES[params.county];
  const adValoremTax = rates
    ? Math.round(
        params.purchasePrice *
          (params.isPrimaryResidence ? rates.h : rates.nh),
      )
    : 0;
  return {
    adValoremTax,
    nonAdValoremTax: 0,
    annualTax: adValoremTax,
    monthlyTax: Math.round((adValoremTax / 12) * 100) / 100,
    source:
      `${params.county}-formula-` +
      (params.sourceSuffix ?? "fallback"),
    fromGeneralCache: false,
    parcelId: params.parcelId,
    nonAdValoremLines: [],
    nonAdValoremPending: params.sourceSuffix === "bill-pending",
    operationalError: params.operationalError,
  };
}

/**
 * Shared purchase estimator for the eight non-Hillsborough route targets.
 * A live row is written only after a verified parcel and TaxSys bill provide
 * millage. Formula results remain explicitly labeled and are never cached as
 * live parcel calculations.
 */
export async function getCountyPurchaseTax(params: {
  county: CountySlug;
  address: string;
  purchasePrice: number;
  isPrimaryResidence: boolean;
  now?: Date;
}): Promise<PurchaseTaxResult> {
  const {
    county,
    address,
    purchasePrice,
    isPrimaryResidence,
  } = params;
  const now = params.now ?? new Date();
  const addressNormalized = normalizeAddr(address);
  const cached = await getPropertyTaxCacheRow(county, addressNormalized);
  if (
    cached &&
    cached.source.endsWith("-situs-v2") &&
    isCacheRowValid(cached, purchasePrice, now)
  ) {
    const computed = computeFromCache(
      cached,
      purchasePrice,
      isPrimaryResidence,
    );
    return {
      ...computed,
      monthlyTax: Math.round((computed.annualTax / 12) * 100) / 100,
      source: cached.source,
      fromGeneralCache: true,
      parcelId: cached.parcelId ?? undefined,
      folio: cached.folio ?? undefined,
      taxDistrict: cached.taxDistrict ?? undefined,
      millageRate: cached.totalMillage ?? undefined,
      nonAdValoremLines: cached.nonAdValoremLines,
      nonAdValoremPending: false,
    };
  }

  const identity = await resolveParcel(county, address, { now });
  if (identity.status !== "found" || !identity.parcelId) {
    return {
      adValoremTax: 0,
      nonAdValoremTax: 0,
      annualTax: 0,
      monthlyTax: 0,
      source: `${county}-strict-parcel-unavailable`,
      fromGeneralCache: false,
      nonAdValoremLines: [],
      nonAdValoremPending: false,
    };
  }

  const expectedSitus = {
    county: county.charAt(0).toUpperCase() + county.slice(1),
    situsAddress: identity.situsAddress ?? address.split(",")[0] ?? "",
    situsCity: identity.situsCity ?? address.split(",")[1] ?? "",
  };
  const bill = county === "polk"
    ? await getPolkPhenixTaxBill(identity.parcelId, expectedSitus)
    : await getNonAdValoremForFolio(
        identity.parcelId,
        county,
        undefined,
        { expectedSitus },
      );
  if (bill.state === "pending") {
    return formulaPurchaseResult({
      county,
      purchasePrice,
      isPrimaryResidence,
      sourceSuffix: "bill-pending",
      parcelId: identity.parcelId,
    });
  }
  if (bill.state === "unavailable") {
    const missingToken = bill.reason === "apify_token_missing";
    return formulaPurchaseResult({
      county,
      purchasePrice,
      isPrimaryResidence,
      sourceSuffix: missingToken ? "operational-error" : "fallback",
      parcelId: identity.parcelId,
      operationalError: missingToken
        ? "Live county tax bills are unavailable because APIFY_TOKEN is not configured."
        : undefined,
    });
  }

  const totalMillage = bill.data.totalMillage;
  if (!totalMillage || totalMillage <= 0) {
    return formulaPurchaseResult({
      county,
      purchasePrice,
      isPrimaryResidence,
      sourceSuffix: "bill-millage-unavailable",
      parcelId: identity.parcelId,
    });
  }

  const schoolMillage = bill.data.adValoremMills?.length
    ? bill.data.adValoremMills
        .filter((line) => /SCHOOL/i.test(line.authority))
        .reduce((sum, line) => sum + line.mills, 0)
    : Math.min(SCHOOL_MILLAGE_FALLBACK, totalMillage);
  const nonSchoolMillage = Math.max(totalMillage - schoolMillage, 0);
  if (schoolMillage <= 0 || nonSchoolMillage <= 0) {
    return formulaPurchaseResult({
      county,
      purchasePrice,
      isPrimaryResidence,
      sourceSuffix: "bill-millage-unavailable",
      parcelId: identity.parcelId,
    });
  }

  const assessmentBasis = deriveCountyAssessmentBasis({
    county,
    purchasePrice,
    justValue: identity.justValue,
    assessedValue: identity.assessedValue,
  });
  const {
    assessmentRatio,
    homesteadNonSchoolExemption,
    valueBasis,
  } = assessmentBasis;
  const formulaRow = {
    homesteadAdValoremPct: 0,
    nonHomesteadAdValoremPct: 0,
    schoolMillage,
    nonSchoolMillage,
    assessmentRatio,
    homesteadSchoolExemption: 25_000,
    homesteadNonSchoolExemption,
    rateYear: bill.data.billYear ?? now.getUTCFullYear(),
    nonAdValoremAmtCents: Math.round(bill.data.total * 100),
  };
  const computed = computeFromCache(
    formulaRow,
    purchasePrice,
    isPrimaryResidence,
  );
  const homestead = computeFromCache(formulaRow, purchasePrice, true);
  const nonHomestead = computeFromCache(formulaRow, purchasePrice, false);
  const source = valueBasis === "verified-parcel-value"
    ? `${county}-bill-live-observed-value-situs-v2`
    : `${county}-bill-live-value-formula-situs-v2`;

  await writePropertyTaxCache({
    county,
    addressNormalized,
    addressDisplay: address.trim(),
    parcelId: identity.parcelId,
    folio: identity.folio,
    taxDistrict: identity.taxDistrict,
    homesteadAdValoremPct: homestead.adValoremTax / purchasePrice,
    nonHomesteadAdValoremPct:
      nonHomestead.adValoremTax / purchasePrice,
    samplePrice: purchasePrice,
    totalMillage,
    schoolMillage,
    nonSchoolMillage,
    assessmentRatio,
    homesteadSchoolExemption: 25_000,
    homesteadNonSchoolExemption,
    parcelSource: identity.source,
    rateYear: bill.data.billYear ?? now.getUTCFullYear(),
    nonAdValoremAmtCents: Math.round(bill.data.total * 100),
    nonAdValoremLines: bill.data.lines,
    source,
    now,
  });

  return {
    ...computed,
    monthlyTax: Math.round((computed.annualTax / 12) * 100) / 100,
    source,
    fromGeneralCache: false,
    parcelId: identity.parcelId,
    folio: identity.folio ?? undefined,
    taxDistrict: identity.taxDistrict ?? undefined,
    millageRate: totalMillage,
    nonAdValoremLines: bill.data.lines,
    nonAdValoremPending: false,
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
