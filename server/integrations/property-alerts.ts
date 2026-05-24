// ============================================================================
// Property alert subscriptions — server-side check jobs
// ============================================================================
// Phase 1: schema + CRUD + manual admin-triggered checks (no scheduler, no
// email send). When a check decides to notify, we write a row to
// `property_alert_events` with status='pending' and update dedupe fields on
// the subscription. A future scheduler/email worker can poll pending events.
// ============================================================================

import { supabaseAdmin } from "../supabase";
import { getLiveRates, type LiveRate } from "../refi-rates";
import {
  buildNormalizedPropertyKey,
  fetchZillowProperty,
  type PropertyScenario,
} from "./apify-zillow";

export type AlertType = "rate_drop" | "price_drop";
export type ScenarioType = "purchase" | "refinance" | "cash_buy" | "seller";

export interface AlertSubscriptionRow {
  id: string;
  user_id: string;
  scenario_id: string;
  scenario_type: ScenarioType;
  alert_type: AlertType;
  is_active: boolean;
  normalized_property_key: string | null;
  property_address: string | null;
  zpid: string | null;
  zillow_url: string | null;
  target_rate: number | null;
  loan_type: string | null;
  loan_term_years: number | null;
  occupancy_type: string | null;
  credit_score: number | null;
  ltv: number | null;
  last_alerted_rate: number | null;
  initial_watched_price: number | null;
  last_seen_price: number | null;
  last_alerted_price: number | null;
  last_checked_at: string | null;
  last_notified_at: string | null;
  notification_channel: string;
  created_at: string;
  updated_at: string;
}

// Property cache rows older than this are considered stale and will be
// refreshed via Apify during the scheduled price check.
const PRICE_CACHE_STALE_MS = 24 * 60 * 60 * 1000; // 24h

/** Map a scenario's loan type (free-form, may be lowercase) to the MND
 *  rate-product `type` bucket returned by `refi-rates.ts`. We only have
 *  Conventional / FHA / VA / Jumbo / ARM in MND; everything else falls
 *  back to Conventional with a note (handled by caller). */
export function loanTypeToMndType(loanType: string | null | undefined): {
  bucket: string;
  approximated: boolean;
} {
  const t = (loanType || "").toLowerCase();
  if (t.includes("fha")) return { bucket: "FHA", approximated: false };
  if (t.includes("va")) return { bucket: "VA", approximated: false };
  if (t.includes("jumbo")) return { bucket: "Jumbo", approximated: false };
  if (t.includes("arm")) return { bucket: "ARM", approximated: false };
  if (t.includes("conventional") || t === "" || t === "usda")
    return { bucket: "Conventional", approximated: t === "usda" };
  // DSCR / Bank Statement / anything else: approximate with conventional.
  return { bucket: "Conventional", approximated: true };
}

/** Pick the live rate row that best matches a subscription: prefer
 *  matching loan-type bucket and the longest term <= the requested term
 *  (defaulting to 30yr when term unknown). Returns null if no rates. */
export function pickCurrentRate(
  rates: LiveRate[],
  sub: Pick<AlertSubscriptionRow, "loan_type" | "loan_term_years">,
): { rate: LiveRate; approximated: boolean } | null {
  if (!rates.length) return null;
  const { bucket, approximated } = loanTypeToMndType(sub.loan_type);
  const term = sub.loan_term_years ?? 30;

  const matchingBucket = rates.filter((r) => r.type === bucket);
  const pool = matchingBucket.length ? matchingBucket : rates;

  // Prefer "30 Yr." vs "15 Yr." by parsing the leading number from name.
  const scored = pool.map((r) => {
    const m = /(\d+)\s*yr/i.exec(r.name);
    const yrs = m ? parseInt(m[1], 10) : 30;
    return { r, yrs, delta: Math.abs(yrs - term) };
  });
  scored.sort((a, b) => a.delta - b.delta);
  return { rate: scored[0].r, approximated: approximated || pool !== matchingBucket };
}

/** Decide whether to fire a rate-drop alert for one subscription. */
export function shouldFireRateAlert(
  currentRate: number,
  sub: Pick<AlertSubscriptionRow, "target_rate" | "last_alerted_rate">,
): boolean {
  if (sub.target_rate == null) return false;
  if (currentRate > sub.target_rate) return false;
  // Already notified at this or a lower rate — don't repeat.
  if (sub.last_alerted_rate != null && currentRate >= sub.last_alerted_rate) return false;
  return true;
}

/** Run the rate-drop alert check across all active subscriptions.
 *  Returns a summary suitable for the admin trigger response. */
export async function runRateDropChecks(): Promise<{
  considered: number;
  notified: number;
  errors: string[];
}> {
  if (!supabaseAdmin) {
    return { considered: 0, notified: 0, errors: ["Supabase admin not configured"] };
  }
  const errors: string[] = [];

  const { data: subs, error } = await supabaseAdmin
    .from("property_alert_subscriptions")
    .select("*")
    .eq("alert_type", "rate_drop")
    .eq("is_active", true);

  if (error) {
    return { considered: 0, notified: 0, errors: [error.message] };
  }
  const list = (subs ?? []) as AlertSubscriptionRow[];
  if (list.length === 0) return { considered: 0, notified: 0, errors };

  let rates: LiveRate[] = [];
  try {
    const live = await getLiveRates();
    rates = live.rates;
  } catch (e: any) {
    return { considered: list.length, notified: 0, errors: [`rates fetch failed: ${e?.message ?? e}`] };
  }

  let notified = 0;
  const nowIso = new Date().toISOString();

  for (const sub of list) {
    try {
      const picked = pickCurrentRate(rates, sub);
      if (!picked) continue;
      const currentRate = picked.rate.rate;

      if (!shouldFireRateAlert(currentRate, sub)) {
        await supabaseAdmin
          .from("property_alert_subscriptions")
          .update({ last_checked_at: nowIso })
          .eq("id", sub.id);
        continue;
      }

      const message =
        `Rates dropped to ${currentRate.toFixed(3)}% (${picked.rate.name})` +
        (picked.approximated ? " — approximated for this loan program" : "") +
        ` for ${sub.property_address ?? "your saved scenario"}.`;

      const { error: evErr } = await supabaseAdmin
        .from("property_alert_events")
        .insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          event_type: "rate_drop",
          property_address: sub.property_address,
          old_value: sub.last_alerted_rate ?? sub.target_rate,
          new_value: currentRate,
          message,
          status: "pending",
        });
      if (evErr) {
        errors.push(`event insert ${sub.id}: ${evErr.message}`);
        continue;
      }

      await supabaseAdmin
        .from("property_alert_subscriptions")
        .update({
          last_alerted_rate: currentRate,
          last_notified_at: nowIso,
          last_checked_at: nowIso,
        })
        .eq("id", sub.id);
      notified++;
    } catch (e: any) {
      errors.push(`sub ${sub.id}: ${e?.message ?? e}`);
    }
  }

  return { considered: list.length, notified, errors };
}

/** Look up the most recent listing price we know for a subscription.
 *  Prefers cached normalized listingPrice (or soldPrice/zestimate as
 *  fallbacks), refreshing via Apify when the cache is older than
 *  PRICE_CACHE_STALE_MS or missing. Returns null when we genuinely
 *  cannot determine a current price (do not alert in that case). */
async function getCurrentListingPriceForSubscription(
  sub: Pick<AlertSubscriptionRow, "property_address" | "zillow_url">,
): Promise<{ price: number; source: "cache" | "scrape" } | null> {
  if (!supabaseAdmin) return null;

  const lookupInput = (sub.zillow_url || sub.property_address || "").trim();
  if (!lookupInput) return null;

  // Compute cache_key with the same rules used by the /api/zillow-lookup route.
  let cacheKey: string;
  if (/^https?:\/\//i.test(lookupInput)) {
    try {
      const u = new URL(lookupInput);
      const path = u.pathname.replace(/\/+$/, "");
      cacheKey = `url:${u.host.toLowerCase()}${path.toLowerCase()}`;
    } catch {
      cacheKey = `url:${lookupInput.toLowerCase()}`;
    }
  } else {
    const normalized = buildNormalizedPropertyKey(lookupInput);
    cacheKey = normalized ?? `addr:raw:${lookupInput.toLowerCase().replace(/\s+/g, " ").trim()}`;
  }

  let normalized: PropertyScenario | null = null;
  let fetchedAtIso: string | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("property_cache")
      .select("normalized, fetched_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (data?.normalized) {
      normalized = data.normalized as PropertyScenario;
      fetchedAtIso = (data.fetched_at as string) ?? null;
    }
  } catch (e: any) {
    console.warn("[property-alerts] cache read failed:", e?.message);
  }

  const stale =
    !normalized ||
    !fetchedAtIso ||
    Date.now() - new Date(fetchedAtIso).getTime() > PRICE_CACHE_STALE_MS;

  if (stale) {
    try {
      normalized = await fetchZillowProperty(lookupInput);
      // Write-through cache for next run.
      void supabaseAdmin
        .from("property_cache")
        .upsert(
          {
            cache_key: cacheKey,
            normalized,
            raw: normalized.rawZillowData,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "cache_key" },
        )
        .then(({ error }) => {
          if (error) console.warn("[property-alerts] cache upsert failed:", error.message);
        });
    } catch (e: any) {
      console.warn("[property-alerts] scrape failed for", cacheKey, e?.message);
      // Don't fail the whole check; just no fresh price available.
      if (!normalized) return null;
    }
  }

  if (!normalized) return null;

  const price =
    (typeof normalized.listingPrice === "number" && normalized.listingPrice > 0
      ? normalized.listingPrice
      : null) ??
    (normalized.isSold && typeof normalized.soldPrice === "number" && normalized.soldPrice > 0
      ? normalized.soldPrice
      : null);

  if (price == null) return null;
  return { price, source: stale ? "scrape" : "cache" };
}

/** Decide whether to fire a price-drop alert. */
export function shouldFirePriceAlert(
  currentPrice: number,
  sub: Pick<AlertSubscriptionRow, "last_seen_price" | "last_alerted_price" | "initial_watched_price">,
): boolean {
  const baseline =
    sub.last_seen_price ?? sub.initial_watched_price ?? null;
  if (baseline == null) return false;
  if (currentPrice >= baseline) return false;
  // Already notified at this or a lower price — don't repeat.
  if (sub.last_alerted_price != null && currentPrice >= sub.last_alerted_price) return false;
  return true;
}

/** Run the price-drop alert check across all active subscriptions. */
export async function runPriceDropChecks(): Promise<{
  considered: number;
  notified: number;
  errors: string[];
}> {
  if (!supabaseAdmin) {
    return { considered: 0, notified: 0, errors: ["Supabase admin not configured"] };
  }
  const errors: string[] = [];

  const { data: subs, error } = await supabaseAdmin
    .from("property_alert_subscriptions")
    .select("*")
    .eq("alert_type", "price_drop")
    .eq("is_active", true);

  if (error) {
    return { considered: 0, notified: 0, errors: [error.message] };
  }
  const list = (subs ?? []) as AlertSubscriptionRow[];
  if (list.length === 0) return { considered: 0, notified: 0, errors };

  let notified = 0;
  const nowIso = new Date().toISOString();

  for (const sub of list) {
    try {
      const result = await getCurrentListingPriceForSubscription(sub);
      if (!result) {
        await supabaseAdmin
          .from("property_alert_subscriptions")
          .update({ last_checked_at: nowIso })
          .eq("id", sub.id);
        continue;
      }
      const currentPrice = result.price;

      if (!shouldFirePriceAlert(currentPrice, sub)) {
        // Ratchet-down only: never raise the baseline. A rising price
        // must not move the comparison floor up, or a later drop back
        // to the original list price would fire a false alert.
        const baseline = sub.last_seen_price ?? sub.initial_watched_price ?? null;
        const patch: Record<string, unknown> = { last_checked_at: nowIso };
        if (baseline == null || currentPrice < baseline) {
          patch.last_seen_price = currentPrice;
        }
        await supabaseAdmin
          .from("property_alert_subscriptions")
          .update(patch)
          .eq("id", sub.id);
        continue;
      }

      const baseline = sub.last_seen_price ?? sub.initial_watched_price ?? currentPrice;
      const message =
        `Listing price dropped from $${Math.round(baseline).toLocaleString()} to $${Math.round(currentPrice).toLocaleString()} ` +
        `for ${sub.property_address ?? "your saved property"}.`;

      const { error: evErr } = await supabaseAdmin
        .from("property_alert_events")
        .insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          event_type: "price_drop",
          property_address: sub.property_address,
          old_value: baseline,
          new_value: currentPrice,
          message,
          status: "pending",
        });
      if (evErr) {
        errors.push(`event insert ${sub.id}: ${evErr.message}`);
        continue;
      }

      await supabaseAdmin
        .from("property_alert_subscriptions")
        .update({
          last_seen_price: currentPrice,
          last_alerted_price: currentPrice,
          last_notified_at: nowIso,
          last_checked_at: nowIso,
        })
        .eq("id", sub.id);
      notified++;
    } catch (e: any) {
      errors.push(`sub ${sub.id}: ${e?.message ?? e}`);
    }
  }

  return { considered: list.length, notified, errors };
}
