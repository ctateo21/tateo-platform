-- Durable one-row-per-address property characteristics (one-year TTL) and
-- manually entered Citizens property context. Server service-role code writes
-- these shared tables; RLS intentionally has no client access policy.
create table if not exists public.property_characteristics_cache (
  id                    serial primary key,
  address_normalized    text not null unique,
  address_display       text not null,
  county                text,
  parcel_id             text,
  latitude              numeric,
  longitude             numeric,
  flood_zone            text,
  flood_zone_subtype    text,
  static_bfe            numeric,
  sfha                  boolean,
  year_built            integer,
  year_built_effective  integer,
  square_feet_living    integer,
  square_feet_total     integer,
  stories               numeric,
  living_units          integer,
  building_count        integer,
  has_pool              boolean,
  exterior_wall_code    text,
  exterior_wall_label   text,
  construction_code     text,
  construction_label    text,
  building_data_source  text,
  flood_data_source     text,
  queried_at            timestamptz not null default now(),
  expires_at            timestamptz not null
);
create index if not exists property_characteristics_addr_idx
  on public.property_characteristics_cache (address_normalized);
alter table public.property_characteristics_cache enable row level security;

create table if not exists public.citizens_property_data (
  id                            serial primary key,
  address_normalized            text not null unique,
  address_display               text not null,
  county                        text,
  bceg                          text,
  protection_class              text,
  personal_multiperil_territory text,
  wind_only_eligible            boolean,
  wind_only_territory           text,
  wind_borne_debris             text,
  terrain                       text,
  flood_zone                    text,
  fema_flood_zone_mismatch      boolean default false,
  entered_by                    text,
  entered_at                    timestamptz not null default now(),
  source                        text not null default 'citizens-manual-entry'
);
create index if not exists citizens_property_data_addr_idx
  on public.citizens_property_data (address_normalized);
alter table public.citizens_property_data enable row level security;

notify pgrst, 'reload schema';