import { supabase } from "./supabase";

export interface Listing {
  id: string;
  seller_id: string;
  address: string;
  unit: string | null;
  city: string;
  state: string;
  zip: string;
  mls_number: string | null;
  list_price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  community: string | null;
  status: "active" | "pending" | "sold";
  list_date: string | null;
  last_updated: string;
}

export interface WeeklyRecap {
  id: string;
  listing_id: string;
  recap_date: string;
  days_on_market: number | null;
  avg_market_dom: number | null;
  list_price: number | null;
  recommended_price_low: number | null;
  recommended_price_high: number | null;
  projected_sale_low: number | null;
  projected_sale_high: number | null;
  zillow_daily_views_est: number | null;
  zillow_daily_saves_est: number | null;
  zillow_heat_index_est: number | null;
  realtor_weekly_views_est: number | null;
  realtor_weekly_saves_est: number | null;
  redfin_weekly_views_est: number | null;
  redfin_hot_home: boolean | null;
  comp_1_address: string | null; comp_1_price: number | null; comp_1_dom: number | null; comp_1_status: string | null;
  comp_2_address: string | null; comp_2_price: number | null; comp_2_dom: number | null; comp_2_status: string | null;
  comp_3_address: string | null; comp_3_price: number | null; comp_3_dom: number | null; comp_3_status: string | null;
  market_inventory_months: number | null;
  market_median_price: number | null;
  market_sale_to_list_pct: number | null;
  market_summary: string | null;
  engagement_summary: string | null;
  price_drop_rationale: string | null;
  next_steps: string[] | null;
  agent_notes: string | null;
  published: boolean;
  created_at: string;
}

export interface SellerProfile {
  id: string;
  name: string;
  email: string;
}

export async function fetchMyListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("last_updated", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Listing[];
}

export async function fetchListingRecaps(listingId: string, publishedOnly = false): Promise<WeeklyRecap[]> {
  let q = supabase
    .from("weekly_recaps")
    .select("*")
    .eq("listing_id", listingId)
    .order("recap_date", { ascending: false });
  if (publishedOnly) q = q.eq("published", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WeeklyRecap[];
}

export async function fetchAllListingsWithSellers(): Promise<(Listing & { seller_name?: string; seller_email?: string; last_recap_date?: string | null })[]> {
  const [{ data: listings, error: lErr }, { data: profiles, error: pErr }, { data: recaps, error: rErr }] = await Promise.all([
    supabase.from("listings").select("*").order("last_updated", { ascending: false }),
    supabase.from("profiles").select("id, name, email"),
    supabase.from("weekly_recaps").select("listing_id, recap_date").order("recap_date", { ascending: false }),
  ]);
  if (lErr) throw lErr;
  if (pErr) throw pErr;
  if (rErr) throw rErr;
  const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const lastRecapByListing = new Map<string, string>();
  for (const r of recaps ?? []) {
    if (!lastRecapByListing.has((r as any).listing_id)) {
      lastRecapByListing.set((r as any).listing_id, (r as any).recap_date);
    }
  }
  return (listings ?? []).map((l: any) => ({
    ...l,
    seller_name: byId.get(l.seller_id)?.name,
    seller_email: byId.get(l.seller_id)?.email,
    last_recap_date: lastRecapByListing.get(l.id) ?? null,
  }));
}

export async function upsertListing(listing: Partial<Listing> & { seller_id: string; address: string; city: string; state: string; zip: string; list_price: number }) {
  const payload = { ...listing, last_updated: new Date().toISOString() };
  const { data, error } = await supabase.from("listings").upsert(payload).select().single();
  if (error) throw error;
  return data as Listing;
}

export async function deleteListing(id: string) {
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertRecap(recap: Partial<WeeklyRecap> & { listing_id: string }) {
  const { data, error } = await supabase.from("weekly_recaps").upsert(recap).select().single();
  if (error) throw error;
  return data as WeeklyRecap;
}

export async function deleteRecap(id: string) {
  const { error } = await supabase.from("weekly_recaps").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSellers(): Promise<SellerProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email")
    .is("agent", null)
    .order("name");
  if (error) throw error;
  return (data ?? []) as SellerProfile[];
}

// ── Helpers for status colors / formatting ───────────────────────────
export function domColor(dom: number | null, avg: number | null): string {
  if (dom == null) return "text-muted-foreground";
  if (dom < 28) return "text-emerald-600";
  if (dom <= 60) return "text-amber-600";
  return "text-red-600";
}

export function heatColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 5) return "text-emerald-600";
  if (pct >= 2) return "text-amber-600";
  return "text-red-600";
}

export function statusColor(status: string | null): string {
  switch ((status ?? "").toLowerCase()) {
    case "sold": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "pending": return "bg-amber-100 text-amber-800 border-amber-200";
    case "active": return "bg-blue-100 text-blue-800 border-blue-200";
    default: return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
