import { isHillsboroughCountyAddress } from "@shared/hillsborough-county";

export type PropertyTaxRoute =
  | {
      kind: "hillsborough";
      url: "/api/property-tax/hillsborough";
    }
  | {
      kind: "county";
      url: "/api/property-tax/county";
      county: string;
    };

export function getOtherSupportedCounty(
  address: string,
): string | null {
  return (
    /\bbradenton\b|\blakewood ranch\b|\bpalmetto\b|\bparrish\b|\bmyakka city\b|\banna maria\b|\bholmes beach\b|\bell?enton\b|\blongboat key\b/i.test(address) ? "manatee" :
    /\bclearwater\b|\bst\.?\s*pete(?:rsburg)?\b|\btarpon springs\b|\bdunedin\b|\blargo\b|\bseminole\b|\boldsmar\b|\bsafety harbor\b|\bbelleair\b|\bgulfport\b|\bpinellas park\b|\bpalm harbor\b|\btreasure island\b|\bmadeira beach\b|\bindian rocks beach\b|\bkenneth city\b/i.test(address) ? "pinellas" :
    /\bnew port richey\b|\bland o'? ?lakes\b|\bzephyrhills\b|\bdade city\b|\bholiday\b|\bhudson\b|\bwesley chapel\b|\bport richey\b|\btrinity\b|\bsan antonio\b|\bshady hills\b/i.test(address) ? "pasco" :
    /\bsarasota\b|\bvenice\b|\bnokomis\b|\bosprey\b|\bnorth port\b|\bsiesta key\b/i.test(address) ? "sarasota" :
    /\bspring hill\b|\bbrooksville\b|\bweeki wachee\b|\bhernando beach\b/i.test(address) ? "hernando" :
    /\bfort myers\b|\bcape coral\b|\bbonita springs\b|\bestero\b|\bsanibel\b|\blehigh acres\b|\bnorth fort myers\b|\bcaptiva\b/i.test(address) ? "lee" :
    /\bnaples\b|\bmarco island\b|\bimmokalee\b|\bgolden gate\b|\bave maria\b/i.test(address) ? "collier" :
    /\blakeland\b|\bbartow\b|\bwinter haven\b|\bhaines city\b|\bauburndale\b|\blake wales\b|\bmulberry\b|\bdavenport\b/i.test(address) ? "polk" :
    null
  );
}

/**
 * ZIP boundaries can cross county lines. In that case HCPA gets the first
 * chance only because its strict parcel matcher can authoritatively accept a
 * Hillsborough parcel; a rejection continues to the known neighboring county.
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