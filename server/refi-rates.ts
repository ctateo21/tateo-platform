import * as cheerio from "cheerio";

export interface LiveRate {
  name: string;
  rate: number;
  change: number;
  type: string;
  lastUpdated: string;
}

export interface LiveRatesResponse {
  rates: LiveRate[];
  source: string;
  disclaimer: string;
  asOf: string;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
let cache: { data: LiveRatesResponse; fetchedAt: number } | null = null;

const LOAN_TYPE_MAP: Record<string, string> = {
  "30 Yr. Fixed": "Conventional",
  "15 Yr. Fixed": "Conventional",
  "30 Yr. Jumbo": "Jumbo",
  "7/6 SOFR ARM": "ARM",
  "5/1 ARM": "ARM",
  "30 Yr. FHA": "FHA",
  "30 Yr. VA": "VA",
};

function classifyLoanType(name: string): string {
  for (const [key, type] of Object.entries(LOAN_TYPE_MAP)) {
    if (name.includes(key)) return type;
  }
  if (name.toLowerCase().includes("fha")) return "FHA";
  if (name.toLowerCase().includes("va")) return "VA";
  if (name.toLowerCase().includes("jumbo")) return "Jumbo";
  if (name.toLowerCase().includes("arm")) return "ARM";
  return "Conventional";
}

async function fetchRatesFromMND(): Promise<LiveRate[]> {
  const html = await fetch("https://www.mortgagenewsdaily.com/mortgage-rates", {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RefinanceCalculator/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
  }).then((r) => r.text());

  const $ = cheerio.load(html);
  const rates: LiveRate[] = [];
  const now = new Date().toISOString();

  $(".rate-product").each((_, el) => {
    const rateText = $(el).find(".rate").first().text().trim();
    if (!rateText.includes("%")) return;
    const name = $(el).find(".rate-product-name").first().text().replace(/\s+/g, " ").trim();
    if (!name) return;
    const rateNum = parseFloat(rateText.replace("%", "").trim());
    if (isNaN(rateNum) || rateNum <= 0) return;
    const changeRaw = $(el).find(".rate-daily-chg").first().text().trim();
    const changeClean = changeRaw
      .replace(/&#x2B;/g, "+")
      .replace(/&#x2212;/g, "-")
      .replace(/[^\d.+-]/g, "")
      .trim();
    const changeNum = parseFloat(changeClean) || 0;
    rates.push({ name, rate: rateNum, change: changeNum, type: classifyLoanType(name), lastUpdated: now });
  });

  return rates;
}

function getFallbackRates(): LiveRatesResponse {
  const now = new Date().toISOString();
  return {
    rates: [
      { name: "30 Yr. Fixed", rate: 6.65, change: 0, type: "Conventional", lastUpdated: now },
      { name: "30 Yr. FHA", rate: 6.18, change: 0, type: "FHA", lastUpdated: now },
      { name: "30 Yr. VA", rate: 6.25, change: 0, type: "VA", lastUpdated: now },
      { name: "30 Yr. Jumbo", rate: 6.82, change: 0, type: "Jumbo", lastUpdated: now },
      { name: "15 Yr. Fixed", rate: 6.02, change: 0, type: "Conventional", lastUpdated: now },
    ],
    source: "Mortgage News Daily (estimated)",
    disclaimer: "Live rates temporarily unavailable. Showing recent estimates.",
    asOf: "Unavailable",
  };
}

export async function getLiveRates(): Promise<LiveRatesResponse> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.data;

  try {
    const rates = await fetchRatesFromMND();
    if (rates.length < 2) throw new Error(`Too few rates: ${rates.length}`);

    const asOf = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const response: LiveRatesResponse = {
      rates,
      source: "Mortgage News Daily",
      disclaimer: "Rates sourced from MortgageNewsDaily.com. Survey-based averages; actual rates depend on credit, loan amount, and lender.",
      asOf,
    };

    cache = { data: response, fetchedAt: now };
    return response;
  } catch (err) {
    console.error("Failed to scrape MND rates:", err);
    if (cache) return cache.data;
    return getFallbackRates();
  }
}
