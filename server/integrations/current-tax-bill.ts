/**
 * Current annual property-tax bill service.
 *
 * Resolves an address to the property owner's ACTUAL current annual
 * tax bill (not a purchase estimate). Used by
 * POST /api/refinance/property-tax/current.
 *
 * Stored in Supabase (public.current_tax_bills) via supabaseAdmin REST.
 *
 * Response shapes:
 *   { state:"ready",       annualTax, monthlyTax, taxYear, adValoremTax?,
 *                          nonAdValoremTax?, source, county, parcelId }
 *   { state:"pending",     county, source }
 *   { state:"unavailable", manualEntryRequired:true, county?, reason }
 *
 * County routing:
 *   1. If ZIP is in Hillsborough set → try HCPA parcel lookup first.
 *      If HCPA rejects (strict match failure), check neighboring county.
 *   2. If ZIP identifies Pinellas or Manatee → parcel lookup for those.
 *   3. Otherwise → unavailable.
 *
 * NEVER invents a number. If actual bill data is not available, returns unavailable.
 */

import { isHillsboroughCountyAddress } from "@shared/hillsborough-county";
import { lookupPIN } from "./hillsborough-tax";
import { lookupPinellasParcel, lookupManateeParcel } from "./county-parcel-lookup";
import { getNonAdValoremForFolio } from "./tax-bill-scraper";
import { supabaseAdmin } from "../supabase";
import { nextTaxRefreshBoundary } from "./property-tax-cache";

// ── ZIP → county sets ─────────────────────────────────────────────

/** Pinellas ZIP codes. */
const PINELLAS_ZIPS = new Set([
  "33701","33702","33703","33704","33705","33706","33707","33708","33709",
  "33710","33711","33712","33713","33714","33715","33716","33755","33756",
  "33759","33760","33761","33762","33763","33764","33765","33766","33767",
  "33770","33771","33772","33773","33774","33775","33776","33777","33778",
  "33781","33782","33785","33786",
]);

/** Manatee ZIP codes. */
const MANATEE_ZIPS = new Set([
  "34201","34202","34203","34205","34207","34208","34209","34210","34211",
  "34212","34215","34216","34217","34218","34219","34220","34221","34222",
  "34251",
]);

function extractZip(address: string): string {
  return (address.match(/\b(\d{5})(?:-\d{4})?\b/) ?? [])[1] ?? "";
}

// ── Response types ────────────────────────────────────────────────

export type CurrentTaxBillResponse =
  | {
      state: "ready";
      annualTax: number;
      monthlyTax: number;
      taxYear: number;
      adValoremTax?: number;
      nonAdValoremTax?: number;
      source: string;
      county: string;
      parcelId: string;
    }
  | {
      state: "pending";
      county: string;
      source: string;
    }
  | {
      state: "unavailable";
      manualEntryRequired: true;
      county?: string;
      reason: string;
    };

// ── Supabase current_tax_bills cache ──────────────────────────────

interface CurrentBillRow {
  county: string;
  parcelId: string;
  taxYear: number;
  annualTaxCents: number;
  adValoremTaxCents: number | null;
  nonAdValoremTaxCents: number | null;
  source: string;
  expiresAt: Date;
}

async function readCurrentBillCache(
  county: string,
  parcelId: string,
  now: Date
): Promise<CurrentBillRow | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from("current_tax_bills")
      .select("*")
      .eq("county", county)
      .eq("parcel_id", parcelId)
      .maybeSingle();
    if (error) {
      console.error("[current-bill] cache read failed:", error.message);
      return null;
    }
    if (!data) return null;
    const r = data as Record<string, unknown>;
    const expiresAt = new Date(String(r.expires_at ?? ""));
    const row: CurrentBillRow = {
      county: String(r.county ?? ""),
      parcelId: String(r.parcel_id ?? ""),
      taxYear: Number(r.tax_year ?? 0),
      annualTaxCents: Number(r.annual_tax_cents ?? 0),
      adValoremTaxCents: r.ad_valorem_tax_cents != null
        ? Number(r.ad_valorem_tax_cents)
        : null,
      nonAdValoremTaxCents: r.non_ad_valorem_tax_cents != null
        ? Number(r.non_ad_valorem_tax_cents)
        : null,
      source: String(r.source ?? ""),
      expiresAt,
    };
    if (
      !Number.isFinite(expiresAt.getTime()) ||
      expiresAt <= now ||
      !row.parcelId ||
      !Number.isInteger(row.taxYear) ||
      row.taxYear < 2000 ||
      row.taxYear > now.getUTCFullYear() + 1 ||
      !Number.isInteger(row.annualTaxCents) ||
      row.annualTaxCents <= 0 ||
      (row.source !== "tax-collector-bill-scrape" &&
        row.source !== "manatee-arcgis")
    ) {
      return null;
    }
    return row;
  } catch (e: any) {
    console.error("[current-bill] cache read failed:", e?.message);
    return null;
  }
}

async function writeCurrentBillCache(params: {
  county: string;
  parcelId: string;
  addressNormalized: string;
  addressDisplay: string;
  taxYear: number;
  annualTaxCents: number;
  adValoremTaxCents: number | null;
  nonAdValoremTaxCents: number | null;
  source: string;
  now: Date;
}): Promise<void> {
  if (!supabaseAdmin) return;
  const expiresAt = nextTaxRefreshBoundary(params.now);
  try {
    const row = {
      county: params.county,
      parcel_id: params.parcelId,
      address_normalized: params.addressNormalized,
      address_display: params.addressDisplay,
      tax_year: params.taxYear,
      annual_tax_cents: params.annualTaxCents,
      ad_valorem_tax_cents: params.adValoremTaxCents,
      non_ad_valorem_tax_cents: params.nonAdValoremTaxCents,
      source: params.source,
      queried_at: params.now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
    const { error } = await supabaseAdmin
      .from("current_tax_bills")
      .upsert(row, { onConflict: "county,parcel_id" });
    if (error) {
      console.error("[current-bill] cache write failed:", error.message);
    }
  } catch (e: any) {
    console.error("[current-bill] cache write failed:", e?.message);
  }
}

function normalizeAddress(address: string): string {
  return address.trim().toUpperCase().replace(/\s+/g, " ");
}

function readyFromCache(cached: CurrentBillRow, county: string): CurrentTaxBillResponse {
  const annualTax = cached.annualTaxCents / 100;
  return {
    state: "ready",
    annualTax,
    monthlyTax: Math.round((annualTax / 12) * 100) / 100,
    taxYear: cached.taxYear,
    adValoremTax: cached.adValoremTaxCents != null
      ? cached.adValoremTaxCents / 100
      : undefined,
    nonAdValoremTax: cached.nonAdValoremTaxCents != null
      ? cached.nonAdValoremTaxCents / 100
      : undefined,
    source: cached.source,
    county,
    parcelId: cached.parcelId,
  };
}

// ── County resolvers ──────────────────────────────────────────────

async function resolveHillsborough(
  address: string,
  now: Date
): Promise<CurrentTaxBillResponse> {
  const county = "hillsborough";

  // Strict HCPA parcel lookup (address + city must match exactly).
  const found = await lookupPIN(address);
  if (!found?.folio) {
    // HCPA rejected — could be a cross-county ZIP. Return null to signal
    // caller should try neighboring county.
    return {
      state: "unavailable",
      manualEntryRequired: true,
      county,
      reason: "parcel-not-found",
    };
  }
  const { folio } = found;

  // Check current_tax_bills cache.
  const cached = await readCurrentBillCache(county, folio, now);
  if (cached) return readyFromCache(cached, county);

  // Fetch the actual bill via Apify scrape.
  // The bill contains both ad-valorem total dollars and NAV.
  const nav = await getNonAdValoremForFolio(
    folio,
    "hillsborough",
    undefined,
    { requireAdValoremTotal: true },
  );
  if (nav.state === "pending") {
    return { state: "pending", county, source: "tax-collector-bill-scrape" };
  }
  if (nav.state !== "ready") {
    return {
      state: "unavailable",
      manualEntryRequired: true,
      county,
      reason: "bill-scrape-unavailable",
    };
  }

  const navTotal = Math.round(nav.data.total * 100); // cents
  const adValoremCents = nav.data.totalAdValorem != null
    ? Math.round(nav.data.totalAdValorem * 100)
    : null;

  // Only store + return "ready" when we have both ad-valorem and NAV.
  if (adValoremCents == null) {
    return {
      state: "unavailable",
      manualEntryRequired: true,
      county,
      reason: "ad-valorem-dollar-total-not-in-bill",
    };
  }

  const annualTaxCents = adValoremCents + navTotal;
  const billYear = nav.data.billYear ?? now.getUTCFullYear() - 1;
  const addrNorm = normalizeAddress(address);

  await writeCurrentBillCache({
    county,
    parcelId: folio,
    addressNormalized: addrNorm,
    addressDisplay: address.trim(),
    taxYear: billYear,
    annualTaxCents,
    adValoremTaxCents: adValoremCents,
    nonAdValoremTaxCents: navTotal,
    source: "tax-collector-bill-scrape",
    now,
  });

  const annualTax = annualTaxCents / 100;
  return {
    state: "ready",
    annualTax,
    monthlyTax: Math.round((annualTax / 12) * 100) / 100,
    taxYear: billYear,
    adValoremTax: adValoremCents / 100,
    nonAdValoremTax: navTotal / 100,
    source: "tax-collector-bill-scrape",
    county,
    parcelId: folio,
  };
}

async function resolvePinellas(
  address: string,
  now: Date
): Promise<CurrentTaxBillResponse> {
  const county = "pinellas";

  const parcel = await lookupPinellasParcel(address);
  if (!parcel?.account) {
    return {
      state: "unavailable",
      manualEntryRequired: true,
      county,
      reason: "parcel-not-found",
    };
  }
  const parcelId = parcel.account;

  // Check current_tax_bills cache.
  const cached = await readCurrentBillCache(county, parcelId, now);
  if (cached) return readyFromCache(cached, county);

  // Fetch actual bill via Apify scrape.
  const nav = await getNonAdValoremForFolio(
    parcelId,
    "pinellas",
    undefined,
    { requireAdValoremTotal: true },
  );
  if (nav.state === "pending") {
    return { state: "pending", county, source: "tax-collector-bill-scrape" };
  }
  if (nav.state !== "ready") {
    return {
      state: "unavailable",
      manualEntryRequired: true,
      county,
      reason: "bill-scrape-unavailable",
    };
  }

  const navTotal = Math.round(nav.data.total * 100); // cents
  const adValoremCents = nav.data.totalAdValorem != null
    ? Math.round(nav.data.totalAdValorem * 100)
    : null;

  if (adValoremCents == null) {
    return {
      state: "unavailable",
      manualEntryRequired: true,
      county,
      reason: "ad-valorem-dollar-total-not-in-bill",
    };
  }

  const annualTaxCents = adValoremCents + navTotal;
  const billYear = nav.data.billYear ?? now.getUTCFullYear() - 1;
  const addrNorm = normalizeAddress(address);

  await writeCurrentBillCache({
    county,
    parcelId,
    addressNormalized: addrNorm,
    addressDisplay: address.trim(),
    taxYear: billYear,
    annualTaxCents,
    adValoremTaxCents: adValoremCents,
    nonAdValoremTaxCents: navTotal,
    source: "tax-collector-bill-scrape",
    now,
  });

  const annualTax = annualTaxCents / 100;
  return {
    state: "ready",
    annualTax,
    monthlyTax: Math.round((annualTax / 12) * 100) / 100,
    taxYear: billYear,
    adValoremTax: adValoremCents / 100,
    nonAdValoremTax: navTotal / 100,
    source: "tax-collector-bill-scrape",
    county,
    parcelId,
  };
}

async function resolveManatee(
  address: string,
  now: Date
): Promise<CurrentTaxBillResponse> {
  const county = "manatee";

  const parcel = await lookupManateeParcel(address);
  if (!parcel) {
    return {
      state: "unavailable",
      manualEntryRequired: true,
      county,
      reason: "parcel-not-found",
    };
  }

  // actualBillYear/actualBillTotal are the best positive historical year.
  if (
    parcel.actualBillYear == null ||
    parcel.actualBillTotal == null ||
    parcel.actualBillTotal <= 0
  ) {
    return {
      state: "unavailable",
      manualEntryRequired: true,
      county,
      reason: "manatee-no-actual-bill-data",
    };
  }

  const taxYear = parcel.actualBillYear;
  const annualTax = Math.round(parcel.actualBillTotal * 100) / 100;
  const parcelId = parcel.parid;
  const addrNorm = normalizeAddress(address);

  // Check current_tax_bills cache (only if same year).
  const cached = await readCurrentBillCache(county, parcelId, now);
  if (cached && cached.taxYear === taxYear) return readyFromCache(cached, county);

  await writeCurrentBillCache({
    county,
    parcelId,
    addressNormalized: addrNorm,
    addressDisplay: address.trim(),
    taxYear,
    annualTaxCents: Math.round(annualTax * 100),
    adValoremTaxCents: null,  // TAXES_YEARn is the combined total
    nonAdValoremTaxCents: parcel.totalNonAdValorem > 0
      ? Math.round(parcel.totalNonAdValorem * 100)
      : null,
    source: "manatee-arcgis",
    now,
  });

  return {
    state: "ready",
    annualTax,
    monthlyTax: Math.round((annualTax / 12) * 100) / 100,
    taxYear,
    nonAdValoremTax: parcel.totalNonAdValorem > 0
      ? parcel.totalNonAdValorem
      : undefined,
    source: "manatee-arcgis",
    county,
    parcelId,
  };
}

// ── Main entry point ──────────────────────────────────────────────

/**
 * Resolve the current annual property-tax bill for the given address.
 *
 * Routing (per spec E — avoid ZIP-only wrong-county acceptance):
 *   1. If ZIP is in Hillsborough set, try HCPA strict parcel match first.
 *      On HCPA rejection (strict match failure) check if the ZIP is also
 *      in a neighboring county set and try that.
 *   2. If ZIP is in Pinellas set → Pinellas parcel lookup.
 *   3. If ZIP is in Manatee set → Manatee ArcGIS lookup.
 *   4. Otherwise → unavailable.
 */
export async function resolveCurrentTaxBill(
  address: string,
  now: Date = new Date()
): Promise<CurrentTaxBillResponse> {
  const zip = extractZip(address);

  // Hillsborough gets first try when ZIP overlaps.
  if (isHillsboroughCountyAddress(address)) {
    const result = await resolveHillsborough(address, now).catch((e: any) => {
      console.error("[current-bill] hillsborough error:", e?.message);
      return null;
    });
    // Only propagate non-"parcel-not-found" results from Hillsborough.
    // A strict-match rejection (parcel-not-found) falls through to check
    // whether the ZIP belongs to a neighboring county.
    if (
      result &&
      !(result.state === "unavailable" && result.reason === "parcel-not-found")
    ) {
      return result;
    }
    // Fall through: cross-county ZIP, HCPA rejected.
    console.log(
      "[current-bill] HCPA rejected, checking neighboring county for ZIP", zip
    );
  }

  // Pinellas
  if (PINELLAS_ZIPS.has(zip)) {
    return resolvePinellas(address, now).catch((e: any) => {
      console.error("[current-bill] pinellas error:", e?.message);
      return {
        state: "unavailable" as const,
        manualEntryRequired: true as const,
        county: "pinellas",
        reason: "internal-error",
      };
    });
  }

  // Manatee
  if (MANATEE_ZIPS.has(zip)) {
    return resolveManatee(address, now).catch((e: any) => {
      console.error("[current-bill] manatee error:", e?.message);
      return {
        state: "unavailable" as const,
        manualEntryRequired: true as const,
        county: "manatee",
        reason: "internal-error",
      };
    });
  }

  return {
    state: "unavailable",
    manualEntryRequired: true,
    reason: "county-not-supported",
  };
}
