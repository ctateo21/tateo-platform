/**
 * Admin maintenance: refresh insurance premiums for a given user.
 *
 *   tsx scripts/refresh-insurance-premiums.ts admin@tateoco.com
 *   tsx scripts/refresh-insurance-premiums.ts admin@tateoco.com --force
 *
 * What it does (per the spec in
 * `attached_assets/Pasted-Copy-paste-this-into-Replit-text-Refresh-all-Insurance-...txt`):
 *
 *   For every `insurance_scenarios` row owned by the resolved user, find the
 *   best available property value from (priority order):
 *     1. property_cache (Zillow purchase price / zestimate)
 *     2. tracked_loans.estimated_home_value
 *     3. purchase_scenarios.price (Purchase with Loan)
 *     4. cash_buy_scenarios.purchase_price
 *     5. seller_scenarios.estimated_sale_price  (useful fallback)
 *
 *   Then compute:
 *     annual_premium  = round(value * 0.0075)
 *     monthly_premium = annual_premium / 12       (derived in UI; not stored)
 *     coverage_a      = annual_premium / 0.0075   (derived in UI; not stored)
 *
 *   Only `annual_premium` is persisted — the Insurance dashboard derives
 *   monthly + coverage_a from it on render.
 *
 * Manual / real-quote protection:
 *   The `insurance_scenarios` schema currently has no `premium_source`
 *   column and no carrier/quote fields, so we cannot positively detect a
 *   real quote. The safest rule (per spec) is:
 *     - update when annual_premium is NULL or 0 (clearly blank/auto)
 *     - update when annual_premium ≈ 0.75% of one of the candidate
 *       property values (within ±$50) — that's a previously auto-seeded
 *       default that should be refreshed
 *     - otherwise SKIP (treat as likely manual)
 *   Pass `--force` to ignore the manual-detection heuristic and overwrite
 *   every row anyway.
 *
 * Matching logic:
 *   The `insurance_scenarios`, `purchase_scenarios`, and `tracked_loans`
 *   tables store address as free text and do NOT have a
 *   `normalized_property_key` column. The `cash_buy_scenarios` and
 *   `seller_scenarios` tables DO. We compute the normalized key locally
 *   from each row's address text and match on that.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
// Use the app's exact cache-key builder so suffix normalization (e.g. "court"→"ct")
// matches the keys actually stored in property_cache.
import { buildNormalizedPropertyKey as buildCacheKey } from "../server/integrations/apify-zillow";

// ── 0.75% default helper ────────────────────────────────────────────────────
const DEFAULT_HOMEOWNERS_INSURANCE_PERCENT = 0.0075;
const MANUAL_DETECTION_TOLERANCE_DOLLARS = 50;

function computeDefaultAnnualPremium(propertyValue: number): number {
  if (!Number.isFinite(propertyValue) || propertyValue <= 0) return 0;
  return Math.round(propertyValue * DEFAULT_HOMEOWNERS_INSURANCE_PERCENT);
}

// ── normalizePropertyKey (inlined from client/src/lib/property-key.ts) ─────
const STREET_SUFFIX_ALIASES: Record<string, string> = {
  st: "street", str: "street", street: "street",
  rd: "road", road: "road",
  ave: "avenue", av: "avenue", avenue: "avenue",
  blvd: "boulevard", boulevard: "boulevard",
  dr: "drive", drive: "drive",
  ln: "lane", lane: "lane",
  ct: "court", court: "court",
  pl: "place", place: "place",
  ter: "terrace", terr: "terrace", terrace: "terrace",
  cir: "circle", circle: "circle",
  pkwy: "parkway", parkway: "parkway",
  hwy: "highway", highway: "highway",
  trl: "trail", trail: "trail",
  way: "way",
  loop: "loop",
};
const DIRECTIONAL_ALIASES: Record<string, string> = {
  n: "north", north: "north",
  s: "south", south: "south",
  e: "east", east: "east",
  w: "west", west: "west",
  ne: "northeast", northeast: "northeast",
  nw: "northwest", northwest: "northwest",
  se: "southeast", southeast: "southeast",
  sw: "southwest", southwest: "southwest",
};
function normalizeToken(tok: string): string {
  const lower = tok.toLowerCase();
  if (DIRECTIONAL_ALIASES[lower]) return DIRECTIONAL_ALIASES[lower];
  if (STREET_SUFFIX_ALIASES[lower]) return STREET_SUFFIX_ALIASES[lower];
  return lower;
}
interface ParsedKey {
  key: string;
  streetNumber: string;
  streetName: string;
  unit: string;
  zip5: string;
  state: string;
}
function parseAddress(address: string | undefined | null): ParsedKey {
  const empty: ParsedKey = { key: "", streetNumber: "", streetName: "", unit: "", zip5: "", state: "" };
  if (!address || typeof address !== "string") return empty;
  const raw = address.trim();
  if (!raw) return empty;
  const zipStateMatch = raw.match(/,\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/i);
  const state = zipStateMatch ? zipStateMatch[1].toLowerCase() : "";
  const zip5 = zipStateMatch ? zipStateMatch[2] : "";
  const streetLine = raw.split(",")[0].trim();
  if (!streetLine) return empty;
  let unit = "";
  let streetCore = streetLine;
  const unitMatch = streetCore.match(/\b(?:apt|apartment|unit|ste|suite|#)\s*([a-z0-9-]+)$/i);
  if (unitMatch) {
    unit = unitMatch[1].toLowerCase();
    streetCore = streetCore.slice(0, unitMatch.index).trim();
  } else {
    const hashMatch = streetCore.match(/#\s*([a-z0-9-]+)$/i);
    if (hashMatch) {
      unit = hashMatch[1].toLowerCase();
      streetCore = streetCore.slice(0, hashMatch.index).trim();
    }
  }
  const tokens = streetCore.replace(/[^a-z0-9\s]/gi, " ").split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return empty;
  let streetNumber = "";
  const nameTokens: string[] = [];
  for (const t of tokens) {
    if (!streetNumber && /^\d+[a-z]?$/i.test(t)) streetNumber = t.toLowerCase();
    else nameTokens.push(normalizeToken(t));
  }
  const streetName = nameTokens.join(" ").trim();
  if (!streetNumber && !streetName) return empty;
  const key = [streetNumber, streetName, unit, zip5, state].join("|");
  return { key, streetNumber, streetName, unit, zip5, state };
}
function normalizePropertyKey(address: string | undefined | null): string {
  return parseAddress(address).key;
}
// ── Types ──────────────────────────────────────────────────────────────────
type ValueSource =
  | "property_cache_zillow"
  | "property_cache_zestimate"
  | "tracked_loans_estimated"
  | "purchase_scenarios_price"
  | "cash_buy_scenarios_price"
  | "seller_scenarios_estimate";

interface Candidate {
  source: ValueSource;
  value: number;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const email = process.argv[2];
  const force = process.argv.includes("--force");

  if (!email) {
    console.error("Usage: tsx scripts/refresh-insurance-premiums.ts <email> [--force]");
    process.exit(2);
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }

  const supabase: SupabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as any },
  });

  console.log("[insurance-refresh] user email", email);

  // Resolve auth user id by paging through auth.users.
  const userId = await resolveUserIdByEmail(supabase, email);
  if (!userId) {
    console.error(`[insurance-refresh] could not find auth user for ${email}`);
    process.exit(1);
  }
  console.log("[insurance-refresh] user id", userId);

  // Fetch insurance + all candidate property tables in parallel.
  const [ins, purchase, cashBuy, tracked, seller] = await Promise.all([
    supabase.from("insurance_scenarios")
      .select("id, address, annual_premium, coverage_type, saved_at")
      .eq("user_id", userId),
    supabase.from("purchase_scenarios")
      .select("id, address, price, saved_at")
      .eq("user_id", userId),
    supabase.from("cash_buy_scenarios")
      .select("id, full_address, normalized_property_key, purchase_price")
      .eq("user_id", userId),
    supabase.from("tracked_loans")
      .select("id, property_address, estimated_home_value")
      .eq("user_id", userId),
    supabase.from("seller_scenarios")
      .select("id, full_address, normalized_property_key, estimated_sale_price")
      .eq("user_id", userId),
  ]);

  for (const r of [ins, purchase, cashBuy, tracked, seller]) {
    if (r.error) {
      console.error("[insurance-refresh] supabase load error", r.error.message);
      process.exit(1);
    }
  }

  const insuranceRows = ins.data ?? [];
  console.log("[insurance-refresh] insurance rows found", insuranceRows.length);

  if (insuranceRows.length === 0) {
    console.log("[insurance-refresh] nothing to do — no insurance scenarios for this user");
    return;
  }

  // Build a single lookup map: normalized_property_key → ordered candidates.
  const byKey = new Map<string, Candidate[]>();
  const push = (key: string, c: Candidate) => {
    if (!key || !Number.isFinite(c.value) || c.value <= 0) return;
    const arr = byKey.get(key) ?? [];
    arr.push(c);
    byKey.set(key, arr);
  };

  for (const p of purchase.data ?? []) {
    const k = normalizePropertyKey((p as any).address);
    push(k, { source: "purchase_scenarios_price", value: Number((p as any).price) });
  }
  for (const c of cashBuy.data ?? []) {
    const k = (c as any).normalized_property_key
      || normalizePropertyKey((c as any).full_address);
    push(k, { source: "cash_buy_scenarios_price", value: Number((c as any).purchase_price) });
  }
  for (const t of tracked.data ?? []) {
    const k = normalizePropertyKey((t as any).property_address);
    push(k, { source: "tracked_loans_estimated", value: Number((t as any).estimated_home_value) });
  }
  for (const s of seller.data ?? []) {
    const k = (s as any).normalized_property_key
      || normalizePropertyKey((s as any).full_address);
    push(k, { source: "seller_scenarios_estimate", value: Number((s as any).estimated_sale_price) });
  }

  // Fetch property_cache rows for every distinct insurance address.
  // property_cache uses the app's `addr:v2:<slug>` key format
  // (server/integrations/apify-zillow.ts:244), NOT our pipe-delimited
  // normalized key — so we build both and map back.
  const cacheToNorm = new Map<string, string>();
  for (const r of insuranceRows) {
    const addr = (r as any).address as string;
    const ck = buildCacheKey(addr);
    const nk = normalizePropertyKey(addr);
    if (ck && nk) cacheToNorm.set(ck, nk);
  }
  const cacheKeys = Array.from(cacheToNorm.keys());
  if (cacheKeys.length > 0) {
    const cache = await supabase
      .from("property_cache")
      .select("cache_key, normalized")
      .in("cache_key", cacheKeys);
    if (cache.error) {
      console.warn("[insurance-refresh] property_cache load warn", cache.error.message);
    } else {
      for (const row of cache.data ?? []) {
        const ck = String((row as any).cache_key ?? "");
        const nk = cacheToNorm.get(ck);
        if (!nk) continue;
        const norm = (row as any).normalized ?? {};
        // Apify-Zillow PropertyScenario fields (server/integrations/apify-zillow.ts:37)
        const zPrice = Number(
          norm.purchasePrice ?? norm.listingPrice ?? norm.soldPrice ??
          norm.zillowPrice ?? norm.price ?? norm.lastSoldPrice,
        );
        if (Number.isFinite(zPrice) && zPrice > 0) {
          push(nk, { source: "property_cache_zillow", value: zPrice });
        }
        const zest = Number(norm.zestimate ?? norm.estimatedHomeValue);
        if (Number.isFinite(zest) && zest > 0) {
          push(nk, { source: "property_cache_zestimate", value: zest });
        }
      }
    }
  }

  // Sort candidates per key by spec priority.
  const PRIORITY: ValueSource[] = [
    "property_cache_zillow",
    "property_cache_zestimate",
    "tracked_loans_estimated",
    "purchase_scenarios_price",
    "cash_buy_scenarios_price",
    "seller_scenarios_estimate",
  ];
  for (const arr of byKey.values()) {
    arr.sort((a, b) => PRIORITY.indexOf(a.source) - PRIORITY.indexOf(b.source));
  }

  // Process each insurance row.
  let updated = 0;
  let skippedManual = 0;
  let skippedNoValue = 0;
  let skippedSameValue = 0;

  for (const row of insuranceRows) {
    const id = (row as any).id as string;
    const address = (row as any).address as string;
    const existingAnnual = (row as any).annual_premium;
    const existing = typeof existingAnnual === "number" && Number.isFinite(existingAnnual)
      ? existingAnnual
      : (existingAnnual != null ? Number(existingAnnual) : null);

    const key = normalizePropertyKey(address);
    console.log("[insurance-refresh] address", address);
    console.log("[insurance-refresh] normalized key", key || "(unparseable)");

    const candidates = key ? (byKey.get(key) ?? []) : [];
    const best = candidates[0];

    if (!best) {
      console.log("[insurance-refresh] value source used", "(none)");
      console.log("[insurance-refresh] property value used", null);
      console.log("[insurance-refresh] skipped manual/quoted", false, "(no candidate value)");
      skippedNoValue++;
      continue;
    }

    console.log("[insurance-refresh] value source used", best.source);
    console.log("[insurance-refresh] property value used", best.value);

    const newAnnual = computeDefaultAnnualPremium(best.value);
    const newMonthly = Math.round((newAnnual / 12) * 100) / 100;
    console.log("[insurance-refresh] annual premium", newAnnual);
    console.log("[insurance-refresh] monthly premium", newMonthly);

    // Manual-quote detection: skip if the existing premium is non-trivial
    // and doesn't look like 0.75% of any known candidate value.
    const isBlank = existing == null || existing === 0;
    const looksLikePriorDefault = !isBlank && candidates.some(c => {
      const wouldBe = computeDefaultAnnualPremium(c.value);
      return Math.abs(wouldBe - (existing as number)) <= MANUAL_DETECTION_TOLERANCE_DOLLARS;
    });
    const isManualLike = !isBlank && !looksLikePriorDefault;

    if (isManualLike && !force) {
      console.log("[insurance-refresh] skipped manual/quoted", true,
        `(existing=${existing} does not match any default)`);
      skippedManual++;
      continue;
    }
    console.log("[insurance-refresh] skipped manual/quoted", false);

    if (existing != null && Math.abs((existing as number) - newAnnual) < 1) {
      console.log("[insurance-refresh] update ok", false, "(already up to date)");
      skippedSameValue++;
      continue;
    }

    const upd = await supabase
      .from("insurance_scenarios")
      .update({ annual_premium: newAnnual })
      .eq("id", id)
      .eq("user_id", userId);
    if (upd.error) {
      console.error("[insurance-refresh] update ok", false, upd.error.message);
      continue;
    }
    console.log("[insurance-refresh] update ok", true,
      `(${existing ?? "null"} → ${newAnnual})`);
    updated++;
  }

  console.log("[insurance-refresh] summary", {
    user: email,
    total: insuranceRows.length,
    updated,
    skippedManual,
    skippedNoValue,
    skippedSameValue,
    force,
  });
}

async function resolveUserIdByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const needle = email.trim().toLowerCase();
  // Page through auth.users via the admin API.
  for (let page = 1; page <= 20; page++) {
    const res = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (res.error) {
      console.error("[insurance-refresh] auth.admin.listUsers error", res.error.message);
      return null;
    }
    const users = res.data?.users ?? [];
    const hit = users.find(u => (u.email ?? "").trim().toLowerCase() === needle);
    if (hit) return hit.id;
    if (users.length < 200) break;
  }
  return null;
}

main().catch(err => {
  console.error("[insurance-refresh] fatal", err);
  process.exit(1);
});
