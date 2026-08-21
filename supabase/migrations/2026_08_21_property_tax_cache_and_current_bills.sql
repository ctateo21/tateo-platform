-- ============================================================================
-- Migration: property_tax_cache + current_tax_bills + tracked_loans columns
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Never drops or alters hcpa_tax_cache.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. property_tax_cache
--    General multi-county purchase-estimate cache (Supabase-owned).
--    Keyed by county + normalized address.
-- ----------------------------------------------------------------------------
create table if not exists public.property_tax_cache (
  id                           serial primary key,
  county                       text not null,
  address_normalized           text not null,
  address_display              text not null,
  -- Verified parcel identity
  parcel_id                    text,   -- county-specific ID (PIN, strap, parid…)
  folio                        text,   -- folio/account number where available
  tax_district                 text,
  -- Effective ad-valorem percentages (e.g. 0.01197) derived at sample_price.
  -- Both homestead and non-homestead stored so one row covers either scenario.
  homestead_ad_valorem_pct     text not null,
  non_homestead_ad_valorem_pct text not null,
  -- Purchase price used when the percentages were derived (for ±20% validity).
  -- sample_price=0 means the row is a seed/backfill and will always be a miss.
  sample_price                 integer not null default 0,
  -- Total millage for reference/display; null for formula-only counties.
  total_millage                text,
  -- Fixed non-ad valorem annual cost in cents (×100). Does NOT scale with price.
  non_ad_valorem_amt_cents     integer not null default 0,
  non_ad_valorem_lines         jsonb not null default '[]'::jsonb,
  -- Source label (honest): e.g.
  --   "hillsborough-hcpa-api"          — live HCPA millage + verified folio
  --   "hillsborough-hcpa-api-nav-pending" — HCPA rates, NAV scrape in progress
  --   "pinellas-bill-live"             — Pinellas bill millage fully parsed
  --   "pinellas-formula-pending"       — bill scrape pending; formula used
  --   "pinellas-formula-fallback"      — no bill millage; formula only
  --   "manatee-formula-plus-arcgis-nav"— formula pct + ArcGIS NAV dollars
  source                       text not null,
  queried_at                   timestamptz not null default now(),
  -- Expiry rolls to next Nov 1 (annual FL tax/millage refresh boundary).
  expires_at                   timestamptz not null,

  constraint ptc_county_address_unique unique (county, address_normalized)
);

-- Keep the migration safe if an earlier draft of this additive table was
-- already applied. CREATE TABLE IF NOT EXISTS does not add later columns.
alter table public.property_tax_cache
  add column if not exists county text,
  add column if not exists address_normalized text,
  add column if not exists address_display text,
  add column if not exists parcel_id text,
  add column if not exists folio text,
  add column if not exists tax_district text,
  add column if not exists homestead_ad_valorem_pct text,
  add column if not exists non_homestead_ad_valorem_pct text,
  add column if not exists sample_price integer default 0,
  add column if not exists total_millage text,
  add column if not exists non_ad_valorem_amt_cents integer default 0,
  add column if not exists non_ad_valorem_lines jsonb default '[]'::jsonb,
  add column if not exists source text,
  add column if not exists queried_at timestamptz default now(),
  add column if not exists expires_at timestamptz;

-- Copy values from the first draft's dollar/rate column names when present.
do $migration$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'property_tax_cache'
      and column_name = 'ad_valorem_pct_homestead'
  ) then
    execute 'update public.property_tax_cache
      set homestead_ad_valorem_pct =
        coalesce(homestead_ad_valorem_pct, cast(ad_valorem_pct_homestead as text))';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'property_tax_cache'
      and column_name = 'ad_valorem_pct_non_homestead'
  ) then
    execute 'update public.property_tax_cache
      set non_homestead_ad_valorem_pct =
        coalesce(non_homestead_ad_valorem_pct, cast(ad_valorem_pct_non_homestead as text))';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'property_tax_cache'
      and column_name = 'millage_rate'
  ) then
    execute 'update public.property_tax_cache
      set total_millage = coalesce(total_millage, cast(millage_rate as text))';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'property_tax_cache'
      and column_name = 'non_ad_valorem_amt'
  ) then
    execute 'update public.property_tax_cache
      set non_ad_valorem_amt_cents =
        round(coalesce(non_ad_valorem_amt, 0) * 100)::integer
      where non_ad_valorem_amt_cents is null or non_ad_valorem_amt_cents = 0';
  end if;
end
$migration$;

create index if not exists property_tax_cache_county_addr_idx
  on public.property_tax_cache (county, address_normalized);
create unique index if not exists property_tax_cache_county_addr_unique_idx
  on public.property_tax_cache (county, address_normalized);
create index if not exists property_tax_cache_expires_idx
  on public.property_tax_cache (expires_at);

alter table public.property_tax_cache enable row level security;
-- Writes via service role only (no client-facing policy needed).

-- ----------------------------------------------------------------------------
-- 2. current_tax_bills
--    Actual annual owner bills (not purchase estimates). Supabase-owned.
--    Keyed by county + parcel_id.
-- ----------------------------------------------------------------------------
create table if not exists public.current_tax_bills (
  id                       serial primary key,
  county                   text not null,
  parcel_id                text not null,
  address_normalized       text not null,
  address_display          text not null,
  tax_year                 integer not null,
  -- Dollar amounts in cents (×100) for integer precision.
  annual_tax_cents         integer not null,
  ad_valorem_tax_cents     integer,         -- null when not parsed separately
  non_ad_valorem_tax_cents integer,
  -- Source: "tax-collector-bill-scrape" | "manatee-arcgis"
  source                   text not null,
  queried_at               timestamptz not null default now(),
  expires_at               timestamptz not null,

  constraint ctb_county_parcel_unique unique (county, parcel_id)
);

-- Upgrade any partial earlier draft in place.
alter table public.current_tax_bills
  add column if not exists county text,
  add column if not exists parcel_id text,
  add column if not exists address_normalized text,
  add column if not exists address_display text,
  add column if not exists tax_year integer,
  add column if not exists annual_tax_cents integer,
  add column if not exists ad_valorem_tax_cents integer,
  add column if not exists non_ad_valorem_tax_cents integer,
  add column if not exists source text,
  add column if not exists queried_at timestamptz default now(),
  add column if not exists expires_at timestamptz;

-- Copy actual bill values from the first draft's dollar columns when present.
do $migration$
begin
  -- The finalized cents-based writer no longer sends the first draft's
  -- dollar columns. Keep them for backward compatibility, but make them
  -- optional on deployments where the draft required them.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'current_tax_bills'
      and column_name = 'current_annual_tax_bill'
  ) then
    execute 'alter table public.current_tax_bills
      alter column current_annual_tax_bill drop not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'current_tax_bills'
      and column_name = 'ad_valorem_portion'
  ) then
    execute 'alter table public.current_tax_bills
      alter column ad_valorem_portion drop not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'current_tax_bills'
      and column_name = 'non_ad_valorem_portion'
  ) then
    execute 'alter table public.current_tax_bills
      alter column non_ad_valorem_portion drop not null';
  end if;

  update public.current_tax_bills
    set address_display = coalesce(address_display, address_normalized)
    where address_display is null;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'current_tax_bills'
      and column_name = 'current_annual_tax_bill'
  ) then
    execute 'update public.current_tax_bills
      set annual_tax_cents =
        round(current_annual_tax_bill * 100)::integer
      where annual_tax_cents is null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'current_tax_bills'
      and column_name = 'ad_valorem_portion'
  ) then
    execute 'update public.current_tax_bills
      set ad_valorem_tax_cents =
        round(ad_valorem_portion * 100)::integer
      where ad_valorem_tax_cents is null and ad_valorem_portion is not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'current_tax_bills'
      and column_name = 'non_ad_valorem_portion'
  ) then
    execute 'update public.current_tax_bills
      set non_ad_valorem_tax_cents =
        round(non_ad_valorem_portion * 100)::integer
      where non_ad_valorem_tax_cents is null and non_ad_valorem_portion is not null';
  end if;
end
$migration$;

create index if not exists current_tax_bills_county_parcel_idx
  on public.current_tax_bills (county, parcel_id);
create unique index if not exists current_tax_bills_county_parcel_unique_idx
  on public.current_tax_bills (county, parcel_id);
create index if not exists current_tax_bills_expires_idx
  on public.current_tax_bills (expires_at);

alter table public.current_tax_bills enable row level security;

-- ----------------------------------------------------------------------------
-- 3. Backfill property_tax_cache from hcpa_tax_cache rows with verified folios.
--    sample_price is left at 0 so these rows are ALWAYS invalid per
--    isCacheRowValid (sample_price <= 0 → miss → live refresh).
--    Percentages are also left at 0 for the same reason. The backfill's only
--    purpose is to pre-populate parcel identity (folio) so when a live HCPA
--    request hits and writes a real row, ON CONFLICT simply updates it.
--    We do NOT invent approximate percentages from raw millage here.
--    Some deployments predate this optional legacy table; skip the seed there.
-- ----------------------------------------------------------------------------
do $migration$
begin
  if to_regclass('public.hcpa_tax_cache') is not null then
    execute $seed$
      insert into public.property_tax_cache (
        county,
        address_normalized,
        address_display,
        parcel_id,
        folio,
        tax_district,
        homestead_ad_valorem_pct,
        non_homestead_ad_valorem_pct,
        sample_price,
        total_millage,
        non_ad_valorem_amt_cents,
        non_ad_valorem_lines,
        source,
        queried_at,
        expires_at
      )
      select
        'hillsborough'                 as county,
        address_normalized,
        address_display,
        pin                            as parcel_id,
        folio,
        tax_district,
        '0'                            as homestead_ad_valorem_pct,
        '0'                            as non_homestead_ad_valorem_pct,
        0                              as sample_price,
        cast(total_millage_rate as text) as total_millage,
        non_ad_valorem_amt * 100       as non_ad_valorem_amt_cents,
        '[]'::jsonb                    as non_ad_valorem_lines,
        'hillsborough-hcpa-cache-seed' as source,
        queried_at,
        expires_at
      from public.hcpa_tax_cache
      where
        folio is not null
        and folio <> ''
        and total_millage_rate > 0
      on conflict (county, address_normalized) do nothing
    $seed$;
  end if;
end
$migration$;

-- ----------------------------------------------------------------------------
-- 4. tracked_loans: property-tax persistence columns
-- ----------------------------------------------------------------------------
alter table public.tracked_loans
  add column if not exists annual_property_tax            numeric,
  add column if not exists annual_property_tax_source     text,
  add column if not exists annual_property_tax_year       integer,
  add column if not exists annual_property_tax_queried_at timestamptz;

notify pgrst, 'reload schema';
