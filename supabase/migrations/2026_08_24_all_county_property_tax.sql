-- ============================================================================
-- Migration: exact arbitrary-price all-county property-tax cache
-- ============================================================================

-- Complete Florida ad-valorem inputs. A complete row can be recomputed for
-- any positive purchase price and does not rely on its legacy sample_price.
alter table public.property_tax_cache
  drop column if exists ad_valorem_pct_homestead,
  drop column if exists ad_valorem_pct_non_homestead,
  drop column if exists millage_rate,
  drop column if exists non_ad_valorem_amt;

alter table public.property_tax_cache
  add column if not exists school_millage numeric,
  add column if not exists non_school_millage numeric,
  add column if not exists assessment_ratio numeric,
  add column if not exists homestead_school_exemption numeric,
  add column if not exists homestead_non_school_exemption numeric,
  add column if not exists parcel_source text,
  add column if not exists rate_year integer;

-- Keep legacy percentage rows intact. New exact rows explicitly persist both
-- Florida homestead exemption buckets ($25k school / $50k non-school).
comment on column public.property_tax_cache.school_millage is
  'School millage in mills per $1,000 assessed value.';
comment on column public.property_tax_cache.non_school_millage is
  'All non-school millage in mills per $1,000 assessed value.';
comment on column public.property_tax_cache.assessment_ratio is
  'Assessed value divided by purchase price for arbitrary-price recomputation.';
comment on column public.property_tax_cache.homestead_school_exemption is
  'Homestead exemption applied to school taxable value, in dollars.';
comment on column public.property_tax_cache.homestead_non_school_exemption is
  'Homestead exemption applied to non-school taxable value, in dollars.';
comment on column public.property_tax_cache.parcel_source is
  'Verified county layer or API that resolved the cached parcel identity.';
comment on column public.property_tax_cache.rate_year is
  'Tax roll year for the persisted millage components.';

alter table public.property_tax_cache enable row level security;
-- No client-facing policy: server service-role reads/writes intentionally
-- bypass RLS, preventing shared parcel/cache data from being exposed.

-- A current bill can be user-provided before a parcel is known. Preserve the
-- existing parcel key used by live server writers, and add the normalized
-- address key for manual/no-parcel rows.
alter table public.current_tax_bills
  alter column parcel_id drop not null,
  add column if not exists entered_by_user_id uuid,
  add column if not exists notes text;

drop index if exists public.current_tax_bills_county_address_unique_idx;
create unique index if not exists current_tax_bills_county_parcel_unique_idx
  on public.current_tax_bills (county, parcel_id);
create unique index if not exists current_tax_bills_addr_year_unique_idx
  on public.current_tax_bills (county, address_normalized, tax_year)
  where parcel_id is null;

alter table public.current_tax_bills enable row level security;
-- No client-facing policy: trusted server writes use the service role.

create table if not exists public.parcel_identity_cache (
  id                 serial primary key,
  county             text not null,
  address_normalized text not null,
  address_display    text not null,
  parcel_id          text not null,
  folio              text,
  tax_district       text,
  situs_address      text,
  situs_city         text,
  just_value         numeric,
  assessed_value     numeric,
  source             text not null,
  queried_at         timestamptz not null default now(),
  expires_at         timestamptz not null,
  unique (county, address_normalized)
);

create index if not exists parcel_identity_cache_addr_idx
  on public.parcel_identity_cache (county, address_normalized);

alter table public.parcel_identity_cache enable row level security;
-- Shared identity data is server-only; service-role access bypasses RLS.

notify pgrst, 'reload schema';