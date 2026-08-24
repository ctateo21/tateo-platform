import * as cheerio from "cheerio";
import { streetAddressMatches } from "./hillsborough-tax";
import type {
  NonAdValoremLookup,
  NonAdValoremResult,
  TaxSysSitusIdentity,
} from "./tax-bill-scraper";

const POLK_PHENIX_ORIGIN = "https://polk.floridatax.us";
const SEARCH_PATH = "/AccountSearch?s=pt";
const TIMEOUT_MS = 20_000;

type FetchImplementation = typeof fetch;

function normalizeCity(value: string): string {
  return value
    .toUpperCase()
    .replace(/\bFL(?:ORIDA)?\b/g, " ")
    .replace(/\b\d{5}(?:-\d{4})?\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeParcel(value: string): string {
  return value.replace(/\D/g, "");
}

function money(value: string): number | null {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function cookieHeader(response: Response): string {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];
  return values
    .map((value) => value.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
}

function hiddenPostFields(html: string): URLSearchParams {
  const $ = cheerio.load(html);
  const fields = new URLSearchParams();
  $("input[type=hidden][name]").each((_, element) => {
    fields.set($(element).attr("name")!, $(element).attr("value") ?? "");
  });
  return fields;
}

function textLines($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): string[] {
  const copy = element.clone();
  copy.find("br").replaceWith("\n");
  return copy.text()
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export interface PolkPhenixSearchResult {
  parcelId: string;
  situsAddress: string;
  situsCity: string;
  detailPath: string;
}

export function parsePolkPhenixSearchResults(
  html: string,
): PolkPhenixSearchResult[] {
  const $ = cheerio.load(html);
  const results: PolkPhenixSearchResult[] = [];
  $('[id^="MainContent_ListView1_PropertyTaxResults_"]').each((_, element) => {
    const card = $(element);
    const link = card.find('a[href^="PropertyDetail?"]').first();
    const href = link.attr("href");
    const parcelId = href
      ? normalizeParcel(new URL(href, `${POLK_PHENIX_ORIGIN}/`).searchParams.get("p") ?? "")
      : "";
    const propertyLabel = card.find("b").filter((_, node) =>
      $(node).text().trim().toUpperCase() === "PROPERTY ADDRESS"
    ).first();
    const addressContainer = propertyLabel.closest(
      "td, .col-12, .col-md-6",
    );
    const lines = textLines($, addressContainer)
      .filter((line) => line.toUpperCase() !== "PROPERTY ADDRESS");
    if (!href || !parcelId || lines.length < 2) return;
    results.push({
      parcelId,
      situsAddress: lines[0],
      situsCity: lines[1],
      detailPath: href,
    });
  });
  return results;
}

export function polkPhenixSearchResultMatches(
  result: PolkPhenixSearchResult,
  parcelId: string,
  expectedSitus: TaxSysSitusIdentity,
): boolean {
  return (
    normalizeParcel(result.parcelId) === normalizeParcel(parcelId) &&
    streetAddressMatches(expectedSitus.situsAddress, result.situsAddress) &&
    normalizeCity(result.situsCity) === normalizeCity(expectedSitus.situsCity)
  );
}

export function parsePolkPhenixBill(
  html: string,
  parcelId: string,
  expectedSitus: TaxSysSitusIdentity,
): NonAdValoremResult | null {
  const $ = cheerio.load(html);
  const accountText = $("#MainContent_lblAccountBanner").text();
  const actualParcel = normalizeParcel(
    accountText.replace(/.*Property Tax Account:\s*/i, ""),
  );
  const physical = textLines($, $("#MainContent_lblGIPhysicalAddress"))
    .map((line) => line.replace(/PROPERTY ADDRESS:/i, "").trim())
    .filter(Boolean);
  if (
    actualParcel !== normalizeParcel(parcelId) ||
    physical.length < 2 ||
    !streetAddressMatches(expectedSitus.situsAddress, physical[0]) ||
    normalizeCity(physical[1]) !== normalizeCity(expectedSitus.situsCity)
  ) {
    return null;
  }

  const yearMatch = $("#MainContent_lblGITaxYearBanner").text().match(/\b(20\d{2})\b/);
  const billYear = yearMatch ? Number(yearMatch[1]) : null;
  const adValoremMills: Array<{ authority: string; mills: number }> = [];
  let totalMillage: number | null = null;
  let totalAdValorem: number | null = null;
  $("#MainContent_PropertyContainer_tpTaxes_TaxesGrid tr").slice(1).each((_, row) => {
    const cells = $(row).find("td").map((__, cell) => $(cell).text().trim()).get();
    if (cells.length < 3) return;
    const mills = Number(cells[1]);
    const charged = money(cells[2]);
    if (/^TOTAL$/i.test(cells[0])) {
      totalMillage = Number.isFinite(mills) && mills > 0 ? mills : null;
      totalAdValorem = charged != null && charged > 0 ? charged : null;
    } else if (Number.isFinite(mills) && mills > 0) {
      adValoremMills.push({ authority: cells[0], mills });
    }
  });

  const lines: Array<{ authority: string; amount: number }> = [];
  let total = 0;
  let sawNonAdValoremTotal = false;
  const nonAdValoremGrid = $(
    "#MainContent_PropertyContainer_tpTaxes_TaxesNonAdValoremGrid",
  );
  nonAdValoremGrid.find("tr")
    .slice(1)
    .each((_, row) => {
      const cells = $(row).find("td").map((__, cell) => $(cell).text().trim()).get();
      if (cells.length < 2) return;
      const amount = money(cells[1]);
      if (amount == null) return;
      if (/^TOTAL$/i.test(cells[0])) {
        total = amount;
        sawNonAdValoremTotal = true;
      }
      else if (amount > 0) lines.push({ authority: cells[0], amount });
    });

  if (
    !billYear ||
    !totalMillage ||
    !totalAdValorem ||
    !adValoremMills.length ||
    nonAdValoremGrid.length !== 1 ||
    !sawNonAdValoremTotal
  ) {
    return null;
  }
  return {
    folio: `v2:polk:${normalizeParcel(parcelId)}`,
    billYear,
    lines,
    total,
    fromCache: false,
    totalMillage,
    adValoremMills,
    totalAdValorem,
  };
}

async function fetchWithTimeout(
  fetchImpl: FetchImplementation,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getPolkPhenixTaxBill(
  parcelId: string,
  expectedSitus: TaxSysSitusIdentity,
  fetchImpl: FetchImplementation = fetch,
): Promise<NonAdValoremLookup> {
  try {
    const searchUrl = `${POLK_PHENIX_ORIGIN}${SEARCH_PATH}`;
    const initial = await fetchWithTimeout(fetchImpl, searchUrl);
    if (!initial.ok) return { state: "unavailable", reason: "scrape_failed" };
    const cookie = cookieHeader(initial);
    const fields = hiddenPostFields(await initial.text());
    fields.set("__EVENTTARGET", "ctl00$MainContent$btnSearch");
    fields.set("__EVENTARGUMENT", "");
    fields.set("ctl00$MainContent$txtSearchCriteria", normalizeParcel(parcelId));
    const searched = await fetchWithTimeout(fetchImpl, searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: fields,
    });
    if (!searched.ok) return { state: "unavailable", reason: "scrape_failed" };
    const matches = parsePolkPhenixSearchResults(await searched.text()).filter(
      (result) => polkPhenixSearchResultMatches(
        result,
        parcelId,
        expectedSitus,
      ),
    );
    if (matches.length !== 1) {
      return { state: "unavailable", reason: "scrape_failed" };
    }
    const detail = await fetchWithTimeout(
      fetchImpl,
      new URL(matches[0].detailPath, `${POLK_PHENIX_ORIGIN}/`).toString(),
      { headers: cookie ? { Cookie: cookie } : undefined },
    );
    if (!detail.ok) return { state: "unavailable", reason: "scrape_failed" };
    const parsed = parsePolkPhenixBill(
      await detail.text(),
      parcelId,
      expectedSitus,
    );
    return parsed
      ? { state: "ready", data: parsed }
      : { state: "unavailable", reason: "scrape_failed" };
  } catch (error: any) {
    console.error("[polk-phenix] bill lookup failed:", error?.message);
    return { state: "unavailable", reason: "scrape_failed" };
  }
}