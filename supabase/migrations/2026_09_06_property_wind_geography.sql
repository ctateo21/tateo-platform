-- Public-source ASCE 7-22 wind geography retained with one-year property data.
alter table public.property_characteristics_cache
  add column if not exists design_wind_speed integer,
  add column if not exists windborne_debris_region boolean,
  add column if not exists miles_to_coast numeric,
  add column if not exists wind_data_source text,
  add column if not exists coast_data_source text;

notify pgrst, 'reload schema';