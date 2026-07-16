/**
 * Hillsborough County property tax estimator.
 * Uses the live HCPA CommonServices API —
 * the same backend the Tax Estimator website
 * at gis.hcpafl.org/PropertySearch/TaxEstimator
 * calls.
 *
 * Two-step flow:
 *   1. BasicSearch by street address → PIN
 *   2. TaxEstimator?pin=PIN → millage rates
 *      + nonAdValoremTaxes (CDD/assessments)
 *
 * Returns the LOW estimate (purchasePrice × 0.85
 * as taxable base) matching HCPA's lower bound,
 * plus the nonAdValoremTaxes added on top since
 * the website explicitly excludes them from its
 * range display.
 */

const HCPA_BASE =
  "https://gis.hcpafl.org/CommonServices/" +
  "property/search";
const HCPA_REFERER =
  "https://gis.hcpafl.org/PropertySearch/" +
  "TaxEstimator.aspx";
const FETCH_TIMEOUT_MS = 8_000;

const HCPA_HEADERS = {
  "Referer": HCPA_REFERER,
  "Accept": "application/json, text/plain, */*",
  "X-Requested-With": "XMLHttpRequest",
};

interface HCPATaxData {
  schoolTaxRate: number;
  nonschoolTaxRate: number;
  totalTaxRate: number;
  nonAdValoremTaxes: number;
  taxDistrict: string;
  justValue: number;
  assessedValue: number;
}

export interface HCPATaxResult {
  annualTax: number;
  monthlyTax: number;
  adValoremTax: number;
  nonAdValoremTax: number;
  taxDistrict: string;
  totalMillageRate: number;
  homestead: boolean;
  source: "hcpa-api";
}

/** Parse the street portion of a full address
 *  for the HCPA BasicSearch query.
 *  "3102 W Nassau St, Tampa, FL 33607"
 *  → "3102 W Nassau" */
function streetForSearch(fullAddress: string): string {
  const street = fullAddress.split(",")[0].trim();
  const tokens = street.split(/\s+/);
  // Use first 3 tokens: number + direction + name
  // Avoids suffix mismatches (St vs Street)
  return tokens.slice(0, 3).join(" ");
}

/** Step 1: Resolve address → PIN via BasicSearch.
 *  Returns null when address is not found. */
async function lookupPIN(
  address: string
): Promise<string | null> {
  const query = encodeURIComponent(
    streetForSearch(address)
  );
  const url =
    `${HCPA_BASE}/BasicSearch?address=${query}`;

  const resp = await fetch(url, {
    headers: HCPA_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) return null;

  const results = await resp.json();
  if (!Array.isArray(results) || !results.length) {
    return null;
  }

  // If multiple results, prefer the one whose
  // city matches the input address
  const inputCity = (
    address.split(",")[1] ?? ""
  ).trim().toUpperCase();

  const best =
    results.find(
      (r: any) =>
        (r.address ?? "")
          .toUpperCase()
          .includes(inputCity)
    ) ?? results[0];

  return best.pin ?? null;
}

/** Step 2: Fetch tax data by PIN. */
async function fetchTaxData(
  pin: string
): Promise<HCPATaxData | null> {
  const url =
    `${HCPA_BASE}/TaxEstimator?pin=` +
    encodeURIComponent(pin);

  const resp = await fetch(url, {
    headers: HCPA_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) return null;

  const data = await resp.json();

  // Validate we got useful data back
  if (
    typeof data?.schoolTaxRate !== "number" ||
    typeof data?.nonschoolTaxRate !== "number"
  ) {
    return null;
  }

  // The endpoint returns rotating decoy/obfuscated
  // JSON for unknown PINs — only trust a response
  // that echoes back the exact PIN we asked for.
  if (
    typeof data?.parcelID === "string" &&
    data.parcelID !== pin
  ) {
    console.log(
      "[hcpa-tax] decoy response (parcelID mismatch), rejecting"
    );
    return null;
  }

  return {
    schoolTaxRate: data.schoolTaxRate,
    nonschoolTaxRate: data.nonschoolTaxRate,
    totalTaxRate: data.totalTaxRate,
    nonAdValoremTaxes: data.nonAdValoremTaxes ?? 0,
    taxDistrict: data.taxDistrict ?? "",
    justValue: data.justValue ?? 0,
    assessedValue: data.assessedValue ?? 0,
  };
}

/** Calculate the ad valorem tax portion using
 *  HCPA's exact formula.
 *
 *  Low estimate = purchasePrice × 0.85 as the
 *  taxable base (matches HCPA website lower bound).
 *  NonAdValorem (CDD) is added separately on top.
 */
function calcAdValorem(
  purchasePrice: number,
  homestead: boolean,
  schoolRate: number,
  nonSchoolRate: number,
  totalRate: number
): number {
  // HCPA low estimate: 85% of purchase price
  const taxableBase = purchasePrice * 0.85;

  if (!homestead) {
    return Math.round(
      taxableBase * (totalRate / 1000)
    );
  }

  // Homestead exemption:
  //   $25k off ALL taxes (school + non-school)
  //   $25k more off NON-SCHOOL only
  //   (for value between $50k and $75k)
  const schoolTaxable = Math.max(
    0, taxableBase - 25_000
  );
  const schoolTax =
    schoolTaxable * (schoolRate / 1000);

  let nonSchoolTaxable: number;
  if (taxableBase < 50_000) {
    nonSchoolTaxable = Math.max(
      0, taxableBase - 25_000
    );
  } else {
    nonSchoolTaxable = Math.max(
      0, taxableBase - 50_000
    );
  }
  const nonSchoolTax =
    nonSchoolTaxable * (nonSchoolRate / 1000);

  return Math.round(schoolTax + nonSchoolTax);
}

/** Main export: resolve address → full tax
 *  estimate including CDD/non-ad valorem.
 *  Returns null on any API failure. */
export async function getHillsboroughTax(params: {
  address: string;
  purchasePrice: number;
  isPrimaryResidence: boolean;
}): Promise<HCPATaxResult | null> {
  // Step 1: address → PIN
  const pin = await lookupPIN(params.address);
  if (!pin) {
    console.log(
      "[hcpa-tax] PIN not found for:",
      params.address
    );
    return null;
  }
  console.log("[hcpa-tax] PIN:", pin);

  // Step 2: PIN → tax data
  const taxData = await fetchTaxData(pin);
  if (!taxData) {
    console.log("[hcpa-tax] TaxEstimator failed");
    return null;
  }
  console.log("[hcpa-tax] taxData:", {
    district:     taxData.taxDistrict,
    totalMills:   taxData.totalTaxRate,
    nonAdValorem: taxData.nonAdValoremTaxes,
  });

  // Step 3: calculate
  const adValorem = calcAdValorem(
    params.purchasePrice,
    params.isPrimaryResidence,
    taxData.schoolTaxRate,
    taxData.nonschoolTaxRate,
    taxData.totalTaxRate
  );

  const nonAdValorem = Math.round(
    taxData.nonAdValoremTaxes ?? 0
  );

  const annualTax = adValorem + nonAdValorem;

  console.log(
    `[hcpa-tax] ${taxData.taxDistrict}` +
    ` mills=${taxData.totalTaxRate}` +
    ` homestead=${params.isPrimaryResidence}` +
    ` adVal=$${adValorem}` +
    ` nonAdVal=$${nonAdValorem}` +
    ` total=$${annualTax}`
  );

  return {
    annualTax,
    monthlyTax: Math.round(
      (annualTax / 12) * 100
    ) / 100,
    adValoremTax: adValorem,
    nonAdValoremTax: nonAdValorem,
    taxDistrict: taxData.taxDistrict,
    totalMillageRate: taxData.totalTaxRate,
    homestead: params.isPrimaryResidence,
    source: "hcpa-api",
  };
}

/** Fast pre-filter: does this address look like
 *  it could be Hillsborough County? Used to skip
 *  the API call for clearly out-of-county addresses. */
export function isHillsboroughCountyAddress(
  address: string
): boolean {
  const lower = address.toLowerCase();
  const hasFL =
    lower.includes(", fl ") ||
    lower.includes(",fl ") ||
    / fl \d{5}/.test(lower);
  if (!hasFL) return false;

  return [
    "tampa", "brandon", "riverview",
    "apollo beach", "temple terrace",
    "plant city", "lithia", "odessa",
    "westchase", "carrollwood", "lutz",
    "ruskin", "valrico", "sun city center",
    "gibsonton", "thonotosassa", "wimauma",
    "fishhawk", "boyette",
  ].some(c => lower.includes(c));
}
