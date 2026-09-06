-- Server-only QuoteRUSH GetPropertyData mapping evidence. Existing quote
-- cache rows remain unchanged; null means no successful property lookup was
-- captured for that row.
begin;

alter table insurance_quote_cache
  add column if not exists raw_quoterush_property_data jsonb,
  add column if not exists raw_quoterush_property_data_source text,
  add column if not exists raw_quoterush_property_data_fetched_at timestamp,
  add column if not exists raw_quoterush_property_data_expires_at timestamp;

create index if not exists insurance_quote_cache_raw_quoterush_property_data_expires_at_idx
  on insurance_quote_cache (raw_quoterush_property_data_expires_at)
  where raw_quoterush_property_data is not null;

commit;