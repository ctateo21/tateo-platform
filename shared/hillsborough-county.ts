/**
 * ZIP codes with geography in Hillsborough County, from Plan Hillsborough's
 * 2026 ZIP demographic profiles. Some ZIP boundaries cross county lines; the
 * server still requires a strict HCPA parcel-address match before using live
 * Hillsborough tax data.
 */
export const HILLSBOROUGH_COUNTY_ZIP_CODES = [
  "33510",
  "33511",
  "33527",
  "33534",
  "33540",
  "33544",
  "33547",
  "33548",
  "33549",
  "33556",
  "33558",
  "33559",
  "33563",
  "33565",
  "33566",
  "33567",
  "33569",
  "33570",
  "33572",
  "33573",
  "33578",
  "33579",
  "33583",
  "33584",
  "33592",
  "33594",
  "33596",
  "33598",
  "33602",
  "33603",
  "33604",
  "33605",
  "33606",
  "33607",
  "33609",
  "33610",
  "33611",
  "33612",
  "33613",
  "33614",
  "33615",
  "33616",
  "33617",
  "33618",
  "33619",
  "33620",
  "33621",
  "33624",
  "33625",
  "33626",
  "33629",
  "33634",
  "33635",
  "33637",
  "33647",
  "33662",
  "33810",
  "33860",
] as const;

const HILLSBOROUGH_ZIP_SET = new Set<string>(
  HILLSBOROUGH_COUNTY_ZIP_CODES,
);

export function extractFiveDigitZip(address: string): string | null {
  const stateMatches = Array.from(
    address.matchAll(
      /\b(?:FL|Florida)[,\s]+(\d{5})(?:-\d{4})?\b/gi,
    ),
  );
  if (stateMatches.length) {
    return stateMatches[stateMatches.length - 1][1];
  }

  const terminalMatch = address.match(
    /(?:^|[\s,])(\d{5})(?:-\d{4})?(?=\s*(?:,\s*)?(?:USA|US|United States)?\s*$)/i,
  );
  return terminalMatch?.[1] ?? null;
}

export function isHillsboroughCountyAddress(address: string): boolean {
  const zip = extractFiveDigitZip(address);
  return zip !== null && HILLSBOROUGH_ZIP_SET.has(zip);
}

export function normalizeHillsboroughAddressKey(address: string): string {
  return address
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[,\.#]+/g, "")
    .slice(0, 200);
}