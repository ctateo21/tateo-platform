-- ============================================================================
-- Realtor.com market data cache
-- ============================================================================
-- Stores the normalized output of the Realtor.com Apify scraper
-- (memo23/realtor-search-cheerio) keyed by (zip, property_type, search_radius,
-- cache_week_of) so multiple sellers in the same ZIP share one weekly scrape
-- and we never re-scrape on every page open.
--
-- Cache cycle: same Friday 8:00 AM ET window as listing_market_analyses
-- (analysis_week_of). cache_week_of stores the ET date of the cycle start.
--
-- Run once in the Supabase SQL editor. Idempotent.
-- ============================================================================

create table if not exists public.realtor_market_cache (
  id                       text primary key,
  cache_key                text not null,            -- realtor:v1:<zip>:<propertyType>:<radius>:<weekOf>
  normalized_property_key  text,
  property_address         text,
  zip                      text not null,
  city                     text,
  state                    text,
  property_type            text,
  search_radius_miles      numeric,
  search_params            jsonb,
  active_comps             jsonb,                    -- ListingCompInput[]
  pending_comps            jsonb,
  sold_comps               jsonb,
  raw_realtor_response     jsonb,                    -- full RealtorScrapeResult for debug
  normalized_results       jsonb,                    -- same as active/pending/sold rolled up
  data_sources             jsonb,
  cache_week_of            date not null,
  generated_at             timestamptz not null default now(),
  next_update_due_at       timestamptz not null,
  status                   text not null default 'success',  -- success | empty | error
  error_message            text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- One row per cache_key. Upserts target this constraint.
create unique index if not exists realtor_market_cache_key_idx
  on public.realtor_market_cache(cache_key);

create index if not exists realtor_market_cache_zip_week_idx
  on public.realtor_market_cache(zip, cache_week_of desc);

-- Cache rows are shared across users — market data isn't user-private.
-- Reads are restricted to authenticated users; all writes happen via the
-- service role from the server, so RLS write policies aren't needed.
alter table public.realtor_market_cache enable row level security;
drop policy if exists "realtor_market_cache_read" on public.realtor_market_cache;
create policy "realtor_market_cache_read" on public.realtor_market_cache
  for select using (auth.role() = 'authenticated');
