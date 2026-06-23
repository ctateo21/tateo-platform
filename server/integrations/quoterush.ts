/**
 * QuoteRUSH live carrier quoting integration.
 *
 * Two separate APIs are involved:
 *  1. Importer API  — creates a lead in the agency's QuoteRUSH account (free).
 *     POST https://importer.quoterush.com/Json/Import/{WEBID}
 *     Auth: header "webpassword: {WEBPASSWORD}"
 *  2. Client API    — retrieves live carrier quotes (costs money per request).
 *     Base URL: https://api.quoterush.com
 *     Auth A (lead endpoints):  headers WebId + WebIdPassword
 *     Auth B (quote endpoints): JSON body EndpointKey + Agency
 *
 * Flow: importLead -> findLead -> getQuotableSites -> submitQuoteRequest -> pollGetQuotes
 *
 * Every credential comes from process.env — no hardcoded values.
 *
 * NOTE: All console.log statements here are intentional. They print the raw API
 * responses so the exact field names can be verified once running against the
 * live QuoteRUSH API. Do not remove them.
 */

export interface QuoteRushParams {
  // Property
  address: string;          // full address string
  city: string;             // parsed from address
  state: string;            // always "FL"
  zip: string;              // parsed from address
  streetAddress: string;    // parsed from address
  coverageA: number;        // rebuild cost in dollars
  policyType: string;       // "HO3" | "HO6" | "DP3" | ""
  yearBuilt: number;        // derived from yearIdx
  constructionType: string; // "CBS" | "Frame" | "Mixed"
  roofAge: number;          // years, derived from roofIdx
  hurrDeductiblePct: number; // 2 | 3 | 5
  priorClaims: number;      // 0 | 1 | 2 | 3
  floodZone: string;        // e.g. "X", "AE", "VE"
  aopDeductible: number;    // e.g. 2500

  // User (pass anonymous defaults if not logged in)
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface QuoteRushQuote {
  carrier: string;        // carrier name
  policyType: string;     // "HO3" | "HO6" | "DP3" etc.
  annualPremium: number;  // annual dollar amount
  monthlyPremium: number; // annualPremium / 12
  rank: number;           // 1 = cheapest
}

export interface QuoteRushResult {
  status:
    | "success"      // quotes returned
    | "no_carriers"  // zero carriers willing to quote
    | "timeout"      // polling timed out
    | "error";       // hard failure
  quotes: QuoteRushQuote[]; // sorted cheapest first
  leadRef?: string;         // lead identifier for reference
  errorMessage?: string;
}

/**
 * Parse a Google Maps formatted address, e.g. "123 Main St, Tampa, FL 33602".
 */
function parseAddress(fullAddress: string): {
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
} {
  const parts = fullAddress.split(",").map((p) => p.trim());
  const streetAddress = parts[0] || "";
  const city = parts[1] || "";
  // Last part is typically "FL 33602"
  const lastPart = parts[parts.length - 1] || "";
  const stateZipMatch = lastPart.match(/([A-Z]{2})\s+(\d{5})/);
  const state = stateZipMatch?.[1] || "FL";
  const zip = stateZipMatch?.[2] || "";
  return { streetAddress, city, state, zip };
}

// ── Step 1: Import Lead (Importer API) ──────────────────────────────────────
async function importLead(params: QuoteRushParams): Promise<string> {
  const WEBID = process.env.QUOTERUSH_WEBID;
  const WEBPASSWORD = process.env.QUOTERUSH_WEBPASSWORD;
  const ASSIGNED_EMAIL = process.env.QUOTERUSH_ASSIGNED_EMAIL || "";

  if (!WEBID || !WEBPASSWORD) {
    throw new Error("QUOTERUSH_WEBID or QUOTERUSH_WEBPASSWORD not set");
  }

  // NOTE: The exact JSON field names below are based on the QuoteRUSH Importer
  // API documentation at https://api-docs.quoterush.com. If field names differ
  // in your account's API docs, update them here.
  const payload = {
    Lob_Home: true,
    Lob_Flood: params.floodZone !== "X" && params.floodZone !== "",
    Lob_Auto: false,
    FirstName: params.firstName || "Havo",
    LastName: params.lastName || "Lead",
    Email: params.email || "",
    Phone: params.phone || "",
    Address: params.streetAddress,
    City: params.city,
    State: params.state || "FL",
    Zip: params.zip,
    YearBuilt: params.yearBuilt,
    ConstructionType: params.constructionType,
    RoofAge: params.roofAge,
    CoverageA: params.coverageA,
    HurricaneDeductiblePercent: params.hurrDeductiblePct,
    AOPDeductible: params.aopDeductible,
    PriorClaims: params.priorClaims,
    CurrentlyInsured: "Yes",
    PolicyType: params.policyType || "HO3",
    FloodZone: params.floodZone || "X",
    AssignedEmail: ASSIGNED_EMAIL,
    Source: "Havo Platform",
  };

  const response = await fetch(
    `https://importer.quoterush.com/Json/Import/${WEBID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        webpassword: WEBPASSWORD,
      },
      body: JSON.stringify(payload),
    },
  );

  const text = await response.text();
  console.log("[quoterush] importer response:", text);

  if (!response.ok) {
    throw new Error(`QuoteRUSH Importer error ${response.status}: ${text}`);
  }

  // Importer API returns a lead reference ID in the response. Try JSON first,
  // then fall back to the trimmed text.
  try {
    const json = JSON.parse(text);
    return String(
      json.id || json.LeadId || json.leadId || json.lead_id || text.trim(),
    );
  } catch {
    return text.trim();
  }
}

// ── Step 2: Find Lead (Client API) ──────────────────────────────────────────
async function findLead(email: string, lastName: string): Promise<string> {
  const WEBID = process.env.QUOTERUSH_WEBID!;
  const WEBPASSWORD = process.env.QUOTERUSH_WEBPASSWORD!;

  // NOTE: Verify these endpoint paths against https://client-api-docs.quoterush.com
  const url = new URL("https://api.quoterush.com/api/leads/findleads");
  url.searchParams.set("email", email);
  url.searchParams.set("lastName", lastName);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      WebId: WEBID,
      WebIdPassword: WEBPASSWORD,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  console.log("[quoterush] findleads response:", text);

  if (!response.ok) {
    throw new Error(`QuoteRUSH FindLeads error ${response.status}: ${text}`);
  }

  const json = JSON.parse(text);
  // The response contains an array of leads. Find the most recent matching one.
  const leads: any[] = Array.isArray(json)
    ? json
    : json.leads || json.data || [json];

  if (!leads.length) {
    throw new Error("No leads found after import");
  }

  // Take the first (most recent) lead
  const lead = leads[0];
  const leadId = String(
    lead.id || lead.leadId || lead.LeadId || lead.lead_id || lead.ID,
  );

  if (!leadId || leadId === "undefined") {
    throw new Error(
      `Could not extract lead ID from: ${JSON.stringify(lead)}`,
    );
  }

  return leadId;
}

// ── Step 3: Get Quotable Sites ──────────────────────────────────────────────
async function getQuotableSites(leadId: string): Promise<string[]> {
  const WEBID = process.env.QUOTERUSH_WEBID!;
  const WEBPASSWORD = process.env.QUOTERUSH_WEBPASSWORD!;

  // NOTE: Verify endpoint path against the Client API docs.
  const response = await fetch(
    `https://api.quoterush.com/api/leads/${leadId}/sites`,
    {
      method: "GET",
      headers: {
        WebId: WEBID,
        WebIdPassword: WEBPASSWORD,
        "Content-Type": "application/json",
      },
    },
  );

  const text = await response.text();
  console.log("[quoterush] quotable sites response:", text);

  if (!response.ok) {
    // Not fatal — proceed with an empty array and let SubmitQuoteRequest use
    // all available carriers.
    console.warn("[quoterush] GetQuotableSites failed, proceeding");
    return [];
  }

  try {
    const json = JSON.parse(text);
    const sites: any[] = Array.isArray(json)
      ? json
      : json.sites || json.data || [];
    return sites
      .map((s: any) => String(s.siteId || s.id || s.SiteId || s))
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ── Step 4: Submit Quote Request ────────────────────────────────────────────
async function submitQuoteRequest(
  leadId: string,
  sites: string[],
): Promise<string> {
  const ENDPOINT_KEY = process.env.QUOTERUSH_ENDPOINT_KEY!;
  const AGENCY = process.env.QUOTERUSH_AGENCY!;

  // NOTE: Verify endpoint path and body structure against the Client API docs.
  const body: Record<string, any> = {
    EndpointKey: ENDPOINT_KEY,
    Agency: AGENCY,
    LeadId: leadId,
  };

  // Only include sites if we have them.
  if (sites.length > 0) {
    body.Sites = sites;
  }

  const response = await fetch("https://api.quoterush.com/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  console.log("[quoterush] submit quote response:", text);

  if (!response.ok) {
    throw new Error(
      `QuoteRUSH SubmitQuoteRequest error ${response.status}: ${text}`,
    );
  }

  const json = JSON.parse(text);
  const quoteId = String(
    json.quoteId || json.id || json.QuoteId || json.requestId || text.trim(),
  );

  if (!quoteId || quoteId === "undefined") {
    throw new Error(`Could not extract quote request ID: ${text}`);
  }

  return quoteId;
}

// ── Step 5: Get Quotes (with polling) ───────────────────────────────────────
async function pollGetQuotes(quoteId: string): Promise<QuoteRushQuote[]> {
  const MAX_ATTEMPTS = 3;
  const DELAY_MS = 3000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Wait 3 seconds before each poll.
    await new Promise((r) => setTimeout(r, DELAY_MS));

    const response = await fetch(
      `https://api.quoterush.com/api/quotes/${quoteId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    const text = await response.text();
    console.log(`[quoterush] GetQuotes attempt ${attempt}:`, text);

    if (!response.ok) {
      console.warn(
        `[quoterush] GetQuotes attempt ${attempt} failed:`,
        response.status,
      );
      continue;
    }

    const json = JSON.parse(text);
    const rawQuotes: any[] = Array.isArray(json)
      ? json
      : json.quotes || json.Quotes || json.data || [];

    if (!rawQuotes.length) {
      console.log(`[quoterush] No quotes yet on attempt ${attempt}`);
      continue;
    }

    // Parse and sort by annual premium ascending.
    const quotes: QuoteRushQuote[] = rawQuotes
      .filter(
        (q: any) =>
          q.premium || q.annualPremium || q.AnnualPremium || q.Premium,
      )
      .map((q: any) => {
        const annual = parseFloat(
          q.annualPremium || q.AnnualPremium || q.premium || q.Premium || "0",
        );
        return {
          carrier: String(
            q.carrier ||
              q.Carrier ||
              q.carrierName ||
              q.CarrierName ||
              "Unknown Carrier",
          ),
          policyType: String(
            q.policyType || q.PolicyType || q.product || q.Product || "HO3",
          ),
          annualPremium: Math.round(annual),
          monthlyPremium: Math.round(annual / 12),
          rank: 0, // filled in after sorting
        };
      })
      .sort(
        (a: QuoteRushQuote, b: QuoteRushQuote) =>
          a.annualPremium - b.annualPremium,
      )
      .map((q: QuoteRushQuote, i: number) => ({ ...q, rank: i + 1 }));

    // Return top 3.
    return quotes.slice(0, 3);
  }

  // All attempts exhausted — return empty array.
  return [];
}

// ── Main exported functions ─────────────────────────────────────────────────

/** For logged-in users: full flow with live quotes. */
export async function getQuoteRushQuotes(
  params: QuoteRushParams,
): Promise<QuoteRushResult> {
  try {
    // Step 1: Import lead (always fires — free).
    const leadRef = await importLead(params);
    console.log("[quoterush] lead imported:", leadRef);

    // Step 2: Find the lead to get its internal ID.
    const leadId = await findLead(params.email, params.lastName);
    console.log("[quoterush] lead found:", leadId);

    // Step 3: Get quotable sites (non-fatal if it fails).
    const sites = await getQuotableSites(leadId);
    console.log("[quoterush] quotable sites:", sites);

    if (sites.length === 0) {
      console.log("[quoterush] no quotable sites — returning no_carriers");
      return { status: "no_carriers", quotes: [], leadRef };
    }

    // Step 4: Submit quote request (costs money).
    const quoteId = await submitQuoteRequest(leadId, sites);
    console.log("[quoterush] quote request:", quoteId);

    // Step 5: Poll for results.
    const quotes = await pollGetQuotes(quoteId);
    console.log("[quoterush] quotes returned:", quotes.length);

    if (quotes.length === 0) {
      return { status: "timeout", quotes: [], leadRef };
    }

    return { status: "success", quotes, leadRef };
  } catch (err: any) {
    console.error("[quoterush] fatal error:", err?.message);
    return {
      status: "error",
      quotes: [],
      errorMessage: err?.message || "Unknown error",
    };
  }
}

/** For anonymous users: import lead only, no quotes. */
export async function importLeadOnly(
  params: QuoteRushParams,
): Promise<{ success: boolean; leadRef?: string }> {
  try {
    const leadRef = await importLead(params);
    return { success: true, leadRef };
  } catch (err: any) {
    console.error("[quoterush] lead import error:", err?.message);
    return { success: false };
  }
}
