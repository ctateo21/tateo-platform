/**
 * Hillsborough County property tax estimator.
 *
 * Step 1: Parse the street address from the
 *         full Google Maps address string
 * Step 2: Call the HCPA ArcGIS parcel API to
 *         resolve the address to a parcel and
 *         get its municipality (SiteCity)
 * Step 3: Apply 2026 Hillsborough millage
 *         rates + FL homestead exemption to
 *         compute the ad valorem tax estimate
 *
 * Falls back gracefully when:
 *   - Address not found in HCPA database
 *   - ArcGIS API is unreachable
 *   - Address is not in Hillsborough County
 */

// ── 2026 Hillsborough millage rates ─────────
// Source: propertyexemption.com / HCPA TRIM
const SCHOOL_MILLS = 7.336;

const CITY_MILLS: Record<string, number> = {
  "TAMPA": 19.8428,
  "TEMPLE TERRACE": 19.5319,
  "PLANT CITY": 18.2926,
};
const UNINCORPORATED_MILLS = 18.2515;

// HCPA's Tax Estimator returns a RANGE: the lower bound assumes the
// assessed (just) value will come in at ~85% of the purchase price —
// Florida property appraisers typically assess below the sale price —
// and the upper bound taxes the full purchase price. Havo returns the
// lower number, so we apply the same 85% assessed-value assumption.
// Verified against HCPA for 3102 W Nassau St @ $726,100 homestead:
// HCPA lower = $11,413.04; this formula gives ~$11,438 (within 0.25%).
const ASSESSED_RATIO = 0.85;

// Cities that are in Hillsborough but
// unincorporated (no city millage layer)
const HILLSBOROUGH_CITIES = new Set([
  "TAMPA", "TEMPLE TERRACE", "PLANT CITY",
  "BRANDON", "RIVERVIEW", "APOLLO BEACH",
  "RUSKIN", "SUN CITY CENTER", "GIBSONTON",
  "VALRICO", "LUTZ", "ODESSA", "WESTCHASE",
  "NEW TAMPA", "TOWN N COUNTRY", "CARROLLWOOD",
  "CITRUS PARK", "NORTHDALE", "WIMAUMA",
  "LITHIA", "FISHHAWK", "BOYETTE",
  "BALM", "SYDNEY", "THONOTOSASSA",
  "SEFFNER", "DOVER", "MANGO",
]);

interface HCPAParcel {
  folio: string | null;
  strap: string | null;
  siteCity: string;
  fullAddress: string;
  siteZip: string;
}

interface HCPAParcelRates {
  schoolTaxRate: number;
  nonschoolTaxRate: number;
  nonAdValoremTaxes: number;
}

interface TaxResult {
  annualTax: number;
  monthlyTax: number;
  municipality: string;
  millageRate: number;
  homestead: boolean;
  source: "hcpa-api" | "formula-fallback";
}

/** Normalize a city name from HCPA (upper case)
 *  to the canonical municipality key. */
function resolveMillage(siteCity: string): number {
  const upper = siteCity.toUpperCase().trim();
  return CITY_MILLS[upper] ?? UNINCORPORATED_MILLS;
}

/** Fetch the parcel's ACTUAL tax-district rates and
 *  non-ad-valorem assessments (CDD, etc.) from the same
 *  endpoint HCPA's own Tax Estimator uses. Requires the
 *  internal PIN (`strap`) format — folio returns decoys. */
async function fetchParcelRates(
  strap: string
): Promise<HCPAParcelRates | null> {
  try {
    const url =
      "https://gis.hcpafl.org/CommonServices/property/" +
      `search/TaxEstimator?pin=${encodeURIComponent(strap)}`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const d = await resp.json();
    if (
      typeof d?.schoolTaxRate !== "number" ||
      typeof d?.nonschoolTaxRate !== "number" ||
      // Guard against the obfuscated decoy responses the
      // endpoint returns for unrecognized PINs: the real
      // response echoes back the exact PIN we sent.
      d?.parcelID !== strap
    ) {
      return null;
    }
    return {
      schoolTaxRate: d.schoolTaxRate,
      nonschoolTaxRate: d.nonschoolTaxRate,
      nonAdValoremTaxes:
        typeof d.nonAdValoremTaxes === "number"
          ? d.nonAdValoremTaxes
          : 0,
    };
  } catch (err) {
    console.error("[hcpa-api] rates error:", err);
    return null;
  }
}

/** Calculate FL property tax for a new purchase.
 *  This replicates HCPA's own Tax Estimator formula
 *  (their `calculateEstimatedTaxes`, lower bound):
 *  taxable = 85% of price, $25k school exemption,
 *  $50k non-school exemption, plus the parcel's
 *  fixed non-ad-valorem assessments (CDD etc.). */
function calcTax(
  price: number,
  schoolMills: number,
  nonSchoolMills: number,
  nonAdValorem: number,
  homestead: boolean
): number {
  const T = price * ASSESSED_RATIO;
  if (!homestead) {
    return Math.round(
      (T * (schoolMills + nonSchoolMills)) / 1000 +
      nonAdValorem
    );
  }
  const schoolTax = Math.max(
    0, ((T - 25_000) * schoolMills) / 1000
  );
  // HCPA's estimator phases in the second $25k
  // exemption between $50k and $75k of value
  let nonSchoolTaxable: number;
  if (T < 50_000) {
    nonSchoolTaxable = T - 25_000;
  } else if (T < 75_000) {
    nonSchoolTaxable = 25_000;
  } else {
    nonSchoolTaxable = T - 50_000;
  }
  const nonSchoolTax = Math.max(
    0, (nonSchoolTaxable * nonSchoolMills) / 1000
  );
  return Math.round(
    schoolTax + nonSchoolTax + nonAdValorem
  );
}

/** Parse the street address portion from a
 *  Google Maps full address string.
 *  "3102 W Nassau St, Tampa, FL 33607"
 *  → "3102 W NASSAU" (enough for LIKE match) */
function parseStreetForQuery(fullAddress: string): string {
  const street = fullAddress.split(",")[0].trim();
  // Take just the first 3 tokens (house number +
  // direction + street name) to avoid suffix
  // mismatches (St vs Street, Blvd vs Boulevard)
  const tokens = street.toUpperCase().split(/\s+/);
  return tokens.slice(0, 3).join(" ");
}

/** Look up a parcel in the HCPA ArcGIS API.
 *  Returns null when the parcel is not found
 *  or the API is unreachable. */
export async function lookupHCPAParcel(
  address: string
): Promise<HCPAParcel | null> {
  try {
    const streetQuery = parseStreetForQuery(address);
    const where = encodeURIComponent(
      `FullAddress LIKE '${streetQuery}%'`
    );
    const fields = "folio,strap,FullAddress,SiteCity,SiteZip";
    const url =
      "https://gis.hcpafl.org/arcgis/rest/services/" +
      "Webmaps/HillsboroughFL_WebParcels/" +
      `MapServer/0/query?where=${where}` +
      `&outFields=${fields}&resultRecordCount=5&f=json`;

    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    const features = data?.features ?? [];
    if (!features.length) return null;

    // If multiple results, prefer the one whose
    // SiteCity matches the city in the address
    const inputCity = (address.split(",")[1] ?? "")
                      .trim().toUpperCase();
    const best = features.find(
      (f: any) =>
        f.attributes.SiteCity?.toUpperCase() ===
        inputCity
    ) ?? features[0];

    const a = best.attributes;
    return {
      folio: a.folio ?? null,
      strap: a.strap ?? null,
      siteCity: (a.SiteCity ?? "").toUpperCase(),
      fullAddress: a.FullAddress ?? "",
      siteZip: a.SiteZip ?? "",
    };
  } catch (err) {
    console.error("[hcpa-api] lookup error:", err);
    return null;
  }
}

/** Main export: get the Hillsborough County
 *  property tax estimate for a new purchase.
 *  Returns null when the address cannot be
 *  found in HCPA (caller should use fallback). */
export async function getHillsboroughTax(params: {
  address: string;
  purchasePrice: number;
  isPrimaryResidence: boolean;
}): Promise<TaxResult | null> {
  const parcel = await lookupHCPAParcel(
    params.address
  );
  if (!parcel) return null;

  // Prefer the parcel's ACTUAL district rates from
  // HCPA (includes CDD millage and non-ad-valorem
  // assessments); fall back to the municipality
  // millage table when that endpoint is unavailable.
  const rates = parcel.strap
    ? await fetchParcelRates(parcel.strap)
    : null;

  let schoolMills: number;
  let nonSchoolMills: number;
  let nonAdValorem: number;
  if (rates) {
    schoolMills = rates.schoolTaxRate;
    nonSchoolMills = rates.nonschoolTaxRate;
    nonAdValorem = rates.nonAdValoremTaxes;
  } else {
    const totalMills = resolveMillage(parcel.siteCity);
    schoolMills = SCHOOL_MILLS;
    nonSchoolMills = totalMills - SCHOOL_MILLS;
    nonAdValorem = 0;
  }
  const totalMills = schoolMills + nonSchoolMills;

  const annual = calcTax(
    params.purchasePrice,
    schoolMills,
    nonSchoolMills,
    nonAdValorem,
    params.isPrimaryResidence
  );

  return {
    annualTax: annual,
    monthlyTax: Math.round((annual / 12) * 100) / 100,
    municipality: parcel.siteCity || "Unincorporated",
    millageRate: totalMills,
    homestead: params.isPrimaryResidence,
    source: rates ? "hcpa-api" : "formula-fallback",
  };
}

/** Returns true when the address looks like
 *  it could be in Hillsborough County. Used
 *  for quick pre-filtering before the API
 *  call. */
export function isHillsboroughCountyAddress(
  address: string
): boolean {
  const lower = address.toLowerCase();
  if (!lower.includes(" fl ") &&
      !lower.endsWith(" fl") &&
      !lower.includes(",fl") &&
      !lower.includes(", fl")) return false;
  return Array.from(HILLSBOROUGH_CITIES).some(c =>
    lower.includes(c.toLowerCase())
  );
}
