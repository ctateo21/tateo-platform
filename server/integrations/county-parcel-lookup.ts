/**
 * County property appraiser parcel lookups for FL counties beyond
 * Hillsborough. Each lookup resolves an address to the parcel
 * identifier used by the county's Tax Collector site
 * (<county>.county-taxes.com) — or, for Manatee, returns the full
 * non-ad valorem assessment amounts directly (its ArcGIS layer
 * publishes them, so no bill scrape is needed).
 */

const TIMEOUT_MS = 8_000;

/** "3102 W Nassau St, Tampa, FL 33607" → "3102 W Nassau"
 *  (first 3 tokens of the street avoids suffix mismatches). */
function streetForQuery(fullAddress: string): string {
  const street = fullAddress.split(",")[0].trim();
  return street.split(/\s+/).slice(0, 3).join(" ");
}

function cityFromAddress(fullAddress: string): string {
  const parts = fullAddress.split(",");
  return (parts[1] ?? "").trim().toUpperCase();
}

// ── Pinellas ─────────────────────────────────────────────────────

/**
 * Pinellas County PA — PropertySearch_A ArcGIS layer.
 * Returns DISPLAY_STRAP_NOHYPHEN (18 digits, section/township/range
 * display order) — the only strap order pinellas.county-taxes.com's
 * search recognizes (INTERNAL_STRAP returns "no bills matched").
 */
export async function lookupPinellasParcel(
  address: string
): Promise<string | null> {
  try {
    const street = encodeURIComponent(
      `${streetForQuery(address).toUpperCase()}%`
    );
    const url =
      "https://egis.pinellas.gov/pcpagis/rest/services/Pcpao_gov/" +
      "PropertySearch_A/MapServer/0/query" +
      `?where=SITE_ADDRESS+LIKE+%27${street}%27` +
      "&outFields=DISPLAY_STRAP_NOHYPHEN,SITE_ADDRESS,SITE_CITYZIP" +
      "&resultRecordCount=5&returnGeometry=false&f=json";

    const resp = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const features = data?.features ?? [];
    if (!features.length) return null;

    const inputCity = cityFromAddress(address);
    const best =
      features.find((f: any) =>
        (f.attributes?.SITE_CITYZIP ?? "")
          .toUpperCase()
          .includes(inputCity)
      ) ?? features[0];

    return best?.attributes?.DISPLAY_STRAP_NOHYPHEN ?? null;
  } catch (err: any) {
    console.error("[pinellas-lookup]", err?.message);
    return null;
  }
}

// ── Manatee ──────────────────────────────────────────────────────

export interface ManateeParcelData {
  parid: string;
  situsAddress: string;
  situsCity: string;
  justValue: number;
  navCddName: string | null;
  /** Non-zero non-ad valorem lines, ready for disclosure display. */
  navLines: Array<{ authority: string; amount: number }>;
  totalNonAdValorem: number;
}

/**
 * Manatee County PA — WebLayers ArcGIS. The parcel record carries
 * ALL non-ad valorem amounts (CDD, fire, stormwater, …) directly,
 * so Manatee needs no Tax Collector scrape at all.
 */
export async function lookupManateeParcel(
  address: string
): Promise<ManateeParcelData | null> {
  try {
    const street = encodeURIComponent(
      `${streetForQuery(address).toUpperCase()}%`
    );
    const fields = [
      "PARID", "SITUS_ADDRESS", "SITUS_POSTAL_CITY", "CAD_JUST_VALUE",
      "NAV_CDD_TAX", "NAV_CDD_NAME", "NAV_CITY_TAX", "NAV_FIRE_TAX",
      "NAV_STORM_TAX", "NAV_DREDGE_TAX", "NAV_LIGHT_TAX",
      "NAV_OTHER_TAX", "NAV_PARK_TAX", "NAV_PAVE_TAX", "NAV_SEWER_TAX",
      "NAV_PACE_TAX", "NAV_STEWARD_TAX",
    ].join(",");

    const url =
      "https://gis.manateepao.com/arcgis/rest/services/Website/" +
      "WebLayers/MapServer/0/query" +
      `?where=SITUS_ADDRESS+LIKE+%27${street}%27` +
      `&outFields=${fields}` +
      "&resultRecordCount=5&returnGeometry=false&f=json";

    const resp = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const features = data?.features ?? [];
    if (!features.length) return null;

    const inputCity = cityFromAddress(address);
    const best =
      features.find((f: any) =>
        (f.attributes?.SITUS_POSTAL_CITY ?? "")
          .toUpperCase()
          .includes(inputCity)
      ) ?? features[0];

    if (!best?.attributes) return null;
    const a = best.attributes;
    const nav = (v: any) =>
      typeof v === "number" && v > 0 ? v : 0;

    const navLines: Array<{ authority: string; amount: number }> = [];
    const push = (authority: string, amount: number) => {
      if (amount > 0)
        navLines.push({
          authority,
          amount: Math.round(amount * 100) / 100,
        });
    };
    push(a.NAV_CDD_NAME ?? "CDD Assessment", nav(a.NAV_CDD_TAX));
    push("Fire Assessment", nav(a.NAV_FIRE_TAX));
    push("Stormwater", nav(a.NAV_STORM_TAX));
    push("Sewer/Water", nav(a.NAV_SEWER_TAX));
    push("Municipal", nav(a.NAV_CITY_TAX));
    push("Dredge", nav(a.NAV_DREDGE_TAX));
    push("Street Lighting", nav(a.NAV_LIGHT_TAX));
    push("Parks", nav(a.NAV_PARK_TAX));
    push("Paving", nav(a.NAV_PAVE_TAX));
    push("PACE", nav(a.NAV_PACE_TAX));
    push("Stewardship", nav(a.NAV_STEWARD_TAX));
    push("Other Assessments", nav(a.NAV_OTHER_TAX));

    const totalNonAdValorem = Math.round(
      navLines.reduce((s, l) => s + l.amount, 0)
    );

    return {
      parid: String(a.PARID ?? ""),
      situsAddress: a.SITUS_ADDRESS ?? "",
      situsCity: a.SITUS_POSTAL_CITY ?? "",
      justValue: a.CAD_JUST_VALUE ?? 0,
      navCddName: a.NAV_CDD_NAME ?? null,
      navLines,
      totalNonAdValorem,
    };
  } catch (err: any) {
    console.error("[manatee-lookup]", err?.message);
    return null;
  }
}

// ── Pasco ────────────────────────────────────────────────────────

/**
 * Pasco County PA — search.pascopa.com HTML search. In practice the
 * search page often returns only the form (requires form postback),
 * so this frequently yields null and the caller falls back to a
 * formula estimate.
 */
export async function lookupPascoParcel(
  address: string
): Promise<string | null> {
  try {
    const parts = address.split(",");
    const streetPart = (parts[0] ?? "").trim();
    const cityPart = (parts[1] ?? "").trim();

    const url =
      "https://search.pascopa.com/default.aspx?criteria=addr" +
      `&address=${encodeURIComponent(streetPart)}` +
      `&city=${encodeURIComponent(cityPart)}&zip=`;

    const resp = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Havo/1.0)",
      },
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Pasco parcel IDs are 15-20 digit numbers embedded in results.
    const matches = Array.from(
      html.matchAll(/\b(\d{15,20})\b/g),
      m => m[1]
    );
    const unique = Array.from(new Set(matches));
    return unique[0] ?? null;
  } catch (err: any) {
    console.error("[pasco-lookup]", err?.message);
    return null;
  }
}
