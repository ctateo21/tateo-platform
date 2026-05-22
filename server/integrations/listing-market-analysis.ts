// AI-powered weekly market analysis for For Sale listings.
//
// All Anthropic calls live server-side; the frontend never sees the API key.
// Results are cached in Supabase (`listing_market_analyses`) and refreshed at
// most once per Friday-aligned week per listing.
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ───────────────────────────── Types ──────────────────────────────────

export interface ListingInput {
  listingId: string;
  userId: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  estimatedSalePrice?: number | null;
  zillowValue?: number | null;
  propertyType?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lotSize?: number | string | null;
  yearBuilt?: number | null;
  hoa?: number | null;
  hasSolar?: boolean | null;
  daysOnMarket?: number | null;
  showingCount?: number | null;
  onlineViews?: number | null;
  onlineSaves?: number | null;
  photoCount?: number | null;
  netProceeds?: number | null;
  mortgagePayoff?: number | null;
  realtorCommissionPct?: number | null;
  sellerClosingCosts?: number | null;
  status?: string | null;
  scenarioUpdatedAt?: string | null;
  comps?: Array<Record<string, unknown>> | null;
}

export interface MarketAnalysisRecord {
  id: string;
  listing_id: string;
  property_address: string;
  analysis_week_of: string;     // YYYY-MM-DD
  generated_at: string;
  next_update_due_at: string;
  status: "draft" | "published" | "error";
  market_summary: string | null;
  pricing_analysis: string | null;
  comps_summary: string | null;
  online_interest_summary: string | null;
  showing_summary: string | null;
  recommended_next_steps: string[] | null;
  risk_flags: string[] | null;
  price_review_recommended: boolean | null;
  confidence_level: "low" | "medium" | "high" | null;
  data_limitations: string[] | null;
  error_message: string | null;
}

// ─────────────────────── Friday-week scheduling ──────────────────────
//
// "Week of" = the Friday on or before today (UTC). Next refresh is the
// following Friday at 00:00 UTC. Lazy refresh treats a row as stale when
// `now >= next_update_due_at` OR `analysis_week_of < currentFriday`.

function fridayOnOrBefore(d: Date): Date {
  // JS getUTCDay(): Sun=0..Sat=6, Fri=5.
  const dow = d.getUTCDay();
  const daysSinceFriday = (dow - 5 + 7) % 7;
  const friday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  friday.setUTCDate(friday.getUTCDate() - daysSinceFriday);
  return friday;
}

function nextFridayAfter(friday: Date): Date {
  const next = new Date(friday);
  next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function currentWeekWindow(now: Date = new Date()) {
  const weekOf = fridayOnOrBefore(now);
  const dueAt = nextFridayAfter(weekOf);
  return { weekOf, weekOfStr: ymd(weekOf), nextUpdateDueAt: dueAt };
}

export function isStale(record: { analysis_week_of: string; next_update_due_at: string }, now: Date = new Date()): boolean {
  const cur = currentWeekWindow(now);
  if (new Date(record.next_update_due_at).getTime() <= now.getTime()) return true;
  // Compare YYYY-MM-DD lexically (both are zero-padded ISO dates).
  if (record.analysis_week_of < cur.weekOfStr) return true;
  return false;
}

// ─────────────────────── Anthropic prompt + call ─────────────────────

function buildPrompt(input: ListingInput): string {
  // Strip nulls/undefined so the model isn't told "null" repeatedly — easier
  // to reason about missing-data caveats this way.
  const known: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== null && v !== undefined && v !== "") known[k] = v;
  }
  return [
    "You are a real estate listing advisor preparing a weekly market briefing for the home seller.",
    "",
    "Speak directly to the seller in plain, friendly English. No jargon. No emojis.",
    "Explain *why* each metric matters in one short sentence.",
    "",
    "STRICT RULES — do not violate:",
    "1. You may ONLY use the listing data provided below. Do NOT invent MLS comps, days-on-market, showings, page views, saves, or any number not present.",
    "2. If a data point is missing, say so honestly in `data_limitations` and lower your confidence.",
    "3. Never quote a competing listing or a specific comp address that is not in the provided `comps` array.",
    "4. Respond with a single JSON object — no markdown, no preamble, no code fences.",
    "",
    "Return exactly this JSON shape:",
    "{",
    '  "market_summary": "2–4 sentence plain-English summary of where this listing stands today",',
    '  "pricing_analysis": "Is the list/estimated price reasonable vs the data we have? Too high / about right / worth reviewing?",',
    '  "comps_summary": "Comment on the comps the seller provided, or note that none were supplied.",',
    '  "online_interest_summary": "Comment on online views/saves if supplied, or note we don\'t track that yet.",',
    '  "showing_summary": "Comment on showings if supplied, or note we don\'t track that yet.",',
    '  "recommended_next_steps": ["short actionable item", "..."],',
    '  "risk_flags": ["short concern phrased as a flag", "..."],',
    '  "price_review_recommended": true | false,',
    '  "confidence_level": "low" | "medium" | "high",',
    '  "data_limitations": ["specific field that was missing or thin", "..."]',
    "}",
    "",
    "Listing data (JSON):",
    JSON.stringify(known, null, 2),
  ].join("\n");
}

interface AnthropicJsonShape {
  market_summary?: string;
  pricing_analysis?: string;
  comps_summary?: string;
  online_interest_summary?: string;
  showing_summary?: string;
  recommended_next_steps?: unknown;
  risk_flags?: unknown;
  price_review_recommended?: unknown;
  confidence_level?: unknown;
  data_limitations?: unknown;
}

async function callAnthropic(prompt: string): Promise<{ parsed: AnthropicJsonShape; raw: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    system:
      "You are a careful, conservative real estate analyst. You only analyze data the user provides. " +
      "You never fabricate MLS data, comps, showings, page views, or saves. " +
      "You respond with a single valid JSON object and nothing else.",
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== "text") {
    throw new Error("Empty response from Anthropic");
  }
  const raw = content.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: AnthropicJsonShape;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Tolerate the rare case where Claude wraps JSON in extra prose by
    // grabbing the first balanced object substring.
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error("Anthropic response was not valid JSON");
    }
    parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  }
  return { parsed, raw };
}

function coerceStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return out.length ? out : null;
}

// ─────────────────────── Public entrypoint ───────────────────────────

export async function getOrGenerateMarketAnalysis(
  input: ListingInput,
  opts: { forceRefresh?: boolean } = {}
): Promise<MarketAnalysisRecord> {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured");
  }

  // Most recent stored row for this listing, scoped to the authenticated
  // owner. We bypass RLS via the service-role client, so we must scope by
  // user_id ourselves to prevent cross-tenant reads.
  const { data: existingRows, error: fetchErr } = await supabaseAdmin
    .from("listing_market_analyses")
    .select("*")
    .eq("listing_id", input.listingId)
    .eq("user_id", input.userId)
    .order("analysis_week_of", { ascending: false })
    .limit(1);

  if (fetchErr) {
    // Tolerate the table being missing during rollout — caller will surface
    // a friendly error in the UI.
    throw new Error(`Failed to read listing_market_analyses: ${fetchErr.message}`);
  }

  const existing = existingRows?.[0] as MarketAnalysisRecord | undefined;

  if (
    existing &&
    existing.status === "published" &&
    !opts.forceRefresh &&
    !isStale(existing)
  ) {
    return existing;
  }

  const cur = currentWeekWindow();
  const prompt = buildPrompt(input);

  let parsed: AnthropicJsonShape | null = null;
  let raw: string | null = null;
  let errorMessage: string | null = null;
  try {
    const result = await callAnthropic(prompt);
    parsed = result.parsed;
    raw = result.raw;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const row: Record<string, unknown> = {
    id:
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : `lma_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    listing_id: input.listingId,
    user_id: input.userId,
    property_address: input.address,
    analysis_week_of: cur.weekOfStr,
    generated_at: new Date().toISOString(),
    next_update_due_at: cur.nextUpdateDueAt.toISOString(),
    status: errorMessage ? "error" : "published",
    market_summary: parsed?.market_summary ?? null,
    pricing_analysis: parsed?.pricing_analysis ?? null,
    comps_summary: parsed?.comps_summary ?? null,
    online_interest_summary: parsed?.online_interest_summary ?? null,
    showing_summary: parsed?.showing_summary ?? null,
    recommended_next_steps: coerceStringArray(parsed?.recommended_next_steps),
    risk_flags: coerceStringArray(parsed?.risk_flags),
    price_review_recommended:
      typeof parsed?.price_review_recommended === "boolean" ? parsed.price_review_recommended : null,
    confidence_level:
      parsed?.confidence_level === "low" || parsed?.confidence_level === "medium" || parsed?.confidence_level === "high"
        ? parsed.confidence_level
        : null,
    data_limitations: coerceStringArray(parsed?.data_limitations),
    raw_prompt: prompt,
    raw_anthropic_response: raw,
    error_message: errorMessage,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("listing_market_analyses")
    .insert(row)
    .select("*")
    .single();

  if (insertErr) {
    // If we can't persist, still return the in-memory result so the UI shows
    // something useful for this request — but log so it's visible.
    console.warn("[market-analysis] failed to persist row:", insertErr.message);
    return row as unknown as MarketAnalysisRecord;
  }
  return inserted as MarketAnalysisRecord;
}
