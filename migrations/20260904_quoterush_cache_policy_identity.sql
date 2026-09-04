-- QuoteRUSH paid-cache identity is normalized address + policy type.
-- Apply to the Neon/Postgres database used by Drizzle (not Supabase).
begin;

update insurance_quote_cache
set policy_type = case
  when upper(trim(coalesce(policy_type, ''))) in ('HO3', 'HO6', 'DP3')
    then upper(trim(policy_type))
  else 'HO3'
end;

alter table insurance_quote_cache
  alter column policy_type set default 'HO3',
  alter column policy_type set not null;

-- Non-PII quote context only. Do not place DOB, name, email, phone, or any
-- user identifier in these snapshots.
alter table insurance_quote_cache
  add column if not exists property_data_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists property_data_provenance jsonb not null default '{}'::jsonb,
  add column if not exists agency_default_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists consumer_property_answers jsonb not null default '{}'::jsonb,
  add column if not exists quote_profile_version text not null default 'legacy-v1',
  add column if not exists assumptions jsonb not null default '[]'::jsonb;

-- Older releases could store every carrier response. Keep only the first
-- three already-ranked positive results before enforcing the new contract.
update insurance_quote_cache
set quotes = coalesce((
  select jsonb_agg(quote)
  from (
    select quote
    from jsonb_array_elements(coalesce(quotes, '[]'::jsonb)) as quote
    where jsonb_typeof(quote->'annualPremium') = 'number'
      and (quote->>'annualPremium')::numeric > 0
    order by coalesce((quote->>'rank')::integer, 2147483647),
             (quote->>'annualPremium')::numeric
    limit 3
  ) ranked_quotes
), '[]'::jsonb);

alter table insurance_quote_cache
  drop constraint if exists insurance_quote_cache_address_normalized_unique;

alter table insurance_quote_cache
  add constraint insurance_quote_cache_address_policy_unique
  unique (address_normalized, policy_type);

create index if not exists insurance_quote_cache_expires_at_idx
  on insurance_quote_cache (expires_at);

commit;