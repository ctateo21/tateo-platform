import {
  extractFiveDigitZip,
  isHillsboroughCountyAddress,
} from "@shared/hillsborough-county";

export type OtherSupportedCounty =
  | "manatee"
  | "pinellas"
  | "pasco"
  | "sarasota"
  | "hernando"
  | "lee"
  | "collier"
  | "polk";

export type PropertyTaxRoute =
  | {
      kind: "hillsborough";
      url: "/api/property-tax/hillsborough";
    }
  | {
      kind: "county";
      url: "/api/property-tax/county";
      county: OtherSupportedCounty;
    };

/**
 * Distinct situs ZIPs published by the county Property Appraisers, verified
 * 2026-08-21. Shared boundary ZIPs intentionally remain in every county set.
 *
 * Sources:
 * - Manatee: gis.manateepao.com ... Website/WebLayers/MapServer/0
 *   (SITUS_POSTAL_ZIP)
 * - Pinellas: egis.pinellas.gov ... PropertySearch_B/MapServer/0
 *   (trailing ZIP in SITE_CITYZIP)
 * - Pasco: maps.pascopa.com ... Parcels/MapServer/3 (PHYS_ZIP)
 * - Sarasota: services3.arcgis.com ... ParcelHosted/FeatureServer/0 (LOCZIP)
 * - Hernando: services2.arcgis.com ... Parcels/FeatureServer/0 (SITUS_ZIP5)
 * - Lee: services2.arcgis.com ... Lee_County_Parcels/FeatureServer/0 (SITEZIP)
 * - Collier: collierappraiser.com Main_Data int_parcels_csv.zip
 *   (SiteZipCode)
 * - Polk: polkflpa.gov AppraisalData ftp_site.zip (ZIP)
 *
 * Non-ZIP placeholders and malformed values were discarded. Sarasota's lone
 * out-of-state value 37275 was also discarded because it cannot be Florida
 * situs coverage.
 */
export const OTHER_SUPPORTED_COUNTY_ZIPS: Readonly<
  Record<OtherSupportedCounty, ReadonlySet<string>>
> = {
  manatee: new Set([
    "33598",
    "34201",
    "34202",
    "34203",
    "34205",
    "34207",
    "34208",
    "34209",
    "34210",
    "34211",
    "34212",
    "34215",
    "34216",
    "34217",
    "34218",
    "34219",
    "34221",
    "34222",
    "34228",
    "34240",
    "34243",
    "34251",
    "34266",
  ]),
  pinellas: new Set([
    "33672",
    "33701",
    "33702",
    "33703",
    "33704",
    "33705",
    "33706",
    "33707",
    "33708",
    "33709",
    "33710",
    "33711",
    "33712",
    "33713",
    "33714",
    "33715",
    "33716",
    "33729",
    "33733",
    "33755",
    "33756",
    "33759",
    "33760",
    "33761",
    "33762",
    "33763",
    "33764",
    "33765",
    "33767",
    "33770",
    "33771",
    "33772",
    "33773",
    "33774",
    "33776",
    "33777",
    "33778",
    "33781",
    "33782",
    "33785",
    "33786",
    "34677",
    "34681",
    "34683",
    "34684",
    "34685",
    "34688",
    "34689",
    "34690",
    "34695",
    "34698",
  ]),
  pasco: new Set([
    "33523",
    "33525",
    "33540",
    "33541",
    "33542",
    "33543",
    "33544",
    "33545",
    "33548",
    "33549",
    "33556",
    "33558",
    "33559",
    "33576",
    "33597",
    "33849",
    "34604",
    "34610",
    "34637",
    "34638",
    "34639",
    "34652",
    "34653",
    "34654",
    "34655",
    "34667",
    "34668",
    "34669",
    "34690",
    "34691",
  ]),
  sarasota: new Set([
    "33953",
    "33966",
    "34223",
    "34224",
    "34228",
    "34229",
    "34231",
    "34232",
    "34233",
    "34234",
    "34235",
    "34236",
    "34237",
    "34238",
    "34239",
    "34240",
    "34241",
    "34242",
    "34243",
    "34251",
    "34266",
    "34275",
    "34284",
    "34285",
    "34286",
    "34287",
    "34288",
    "34289",
    "34291",
    "34292",
    "34293",
  ]),
  hernando: new Set([
    "33523",
    "33597",
    "34601",
    "34602",
    "34604",
    "34606",
    "34607",
    "34608",
    "34609",
    "34613",
    "34614",
    "34661",
  ]),
  lee: new Set([
    "33901",
    "33903",
    "33904",
    "33905",
    "33907",
    "33908",
    "33909",
    "33912",
    "33913",
    "33914",
    "33916",
    "33917",
    "33919",
    "33920",
    "33921",
    "33922",
    "33924",
    "33928",
    "33929",
    "33931",
    "33936",
    "33955",
    "33956",
    "33957",
    "33965",
    "33966",
    "33967",
    "33971",
    "33972",
    "33973",
    "33974",
    "33976",
    "33990",
    "33991",
    "33993",
    "34110",
    "34119",
    "34134",
    "34135",
  ]),
  collier: new Set([
    "34102",
    "34103",
    "34104",
    "34105",
    "34108",
    "34109",
    "34110",
    "34112",
    "34113",
    "34114",
    "34116",
    "34117",
    "34119",
    "34120",
    "34134",
    "34137",
    "34138",
    "34139",
    "34140",
    "34141",
    "34142",
    "34145",
  ]),
  polk: new Set([
    "33525",
    "33547",
    "33597",
    "33801",
    "33802",
    "33803",
    "33804",
    "33805",
    "33806",
    "33807",
    "33809",
    "33810",
    "33811",
    "33812",
    "33813",
    "33815",
    "33820",
    "33823",
    "33825",
    "33827",
    "33830",
    "33831",
    "33834",
    "33835",
    "33836",
    "33837",
    "33838",
    "33839",
    "33840",
    "33841",
    "33843",
    "33844",
    "33845",
    "33846",
    "33847",
    "33849",
    "33850",
    "33851",
    "33853",
    "33854",
    "33855",
    "33858",
    "33859",
    "33860",
    "33863",
    "33867",
    "33868",
    "33877",
    "33880",
    "33881",
    "33882",
    "33883",
    "33884",
    "33896",
    "33897",
    "33898",
    "34711",
    "34714",
    "34739",
    "34758",
    "34759",
  ]),
};

const COUNTY_ROUTING_PRIORITY: readonly OtherSupportedCounty[] = [
  "manatee",
  "pinellas",
  "pasco",
  "sarasota",
  "hernando",
  "lee",
  "collier",
  "polk",
];

const ZIPLESS_CITY_PATTERNS: Readonly<
  Record<OtherSupportedCounty, RegExp>
> = {
  manatee: /\bbradenton\b|\blakewood ranch\b|\bpalmetto\b|\bparrish\b|\bmyakka city\b|\banna maria\b|\bholmes beach\b|\bell?enton\b|\blongboat key\b/i,
  pinellas: /\bclearwater\b|\bst\.?\s*pete(?:rsburg)?\b|\btarpon springs\b|\bdunedin\b|\blargo\b|\bseminole\b|\boldsmar\b|\bsafety harbor\b|\bbelleair\b|\bgulfport\b|\bpinellas park\b|\bpalm harbor\b|\btreasure island\b|\bmadeira beach\b|\bindian rocks beach\b|\bkenneth city\b/i,
  pasco: /\bnew port richey\b|\bland o'? ?lakes\b|\bzephyrhills\b|\bdade city\b|\bholiday\b|\bhudson\b|\bwesley chapel\b|\bport richey\b|\btrinity\b|\bsan antonio\b|\bshady hills\b/i,
  sarasota: /\bsarasota\b|\bvenice\b|\bnokomis\b|\bosprey\b|\bnorth port\b|\bsiesta key\b/i,
  hernando: /\bspring hill\b|\bbrooksville\b|\bweeki wachee\b|\bhernando beach\b/i,
  lee: /\bfort myers\b|\bcape coral\b|\bbonita springs\b|\bestero\b|\bsanibel\b|\blehigh acres\b|\bnorth fort myers\b|\bcaptiva\b/i,
  collier: /\bnaples\b|\bmarco island\b|\bimmokalee\b|\bgolden gate\b|\bave maria\b/i,
  polk: /\blakeland\b|\bbartow\b|\bwinter haven\b|\bhaines city\b|\bauburndale\b|\blake wales\b|\bmulberry\b|\bdavenport\b/i,
};

export function getOtherSupportedCounty(
  address: string,
): OtherSupportedCounty | null {
  const zip = extractFiveDigitZip(address);
  if (zip) {
    const matches = COUNTY_ROUTING_PRIORITY.filter((county) =>
      OTHER_SUPPORTED_COUNTY_ZIPS[county].has(zip)
    );
    if (matches.length === 1) return matches[0];
    // Shared boundary ZIPs are now safe to disambiguate by city because the
    // server's universal parcel resolver still requires an exact county situs
    // match before it can return live data. If city evidence is not unique,
    // remain conservative and use the generic fallback.
    const cityMatches = matches.filter((county) =>
      ZIPLESS_CITY_PATTERNS[county].test(address)
    );
    return cityMatches.length === 1 ? cityMatches[0] : null;
  }

  for (const county of COUNTY_ROUTING_PRIORITY) {
    if (ZIPLESS_CITY_PATTERNS[county].test(address)) {
      return county;
    }
  }
  return null;
}

/**
 * HCPA gets the first chance for Hillsborough boundary ZIPs because its strict
 * parcel matcher can authoritatively accept or reject the address. Other
 * shared ZIPs use city only to choose which strict county resolver to try.
 */
export function buildPropertyTaxRoutePlan(
  address: string,
): PropertyTaxRoute[] {
  const routes: PropertyTaxRoute[] = [];
  if (isHillsboroughCountyAddress(address)) {
    routes.push({
      kind: "hillsborough",
      url: "/api/property-tax/hillsborough",
    });
  }

  const otherCounty = getOtherSupportedCounty(address);
  if (otherCounty) {
    routes.push({
      kind: "county",
      url: "/api/property-tax/county",
      county: otherCounty,
    });
  }
  return routes;
}