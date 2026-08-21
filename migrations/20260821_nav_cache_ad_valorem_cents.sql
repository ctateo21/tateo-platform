-- Add actual ad-valorem dollar total (cents) to non_ad_valorem_cache.
-- Populated from the bill parser when the bill's "Total Ad Valorem Taxes"
-- row contains a dollar amount in addition to the millage rate.
alter table non_ad_valorem_cache
  add column if not exists total_ad_valorem_cents integer;
