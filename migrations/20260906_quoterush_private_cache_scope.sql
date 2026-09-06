-- Keep ordinary address/policy quotes shareable while isolating quote runs
-- that depend on a private, user-owned policy expiration date.
begin;

alter table private_insurance_properties
  add column if not exists quote_cache_scope text;

update private_insurance_properties
set quote_cache_scope = md5(random()::text || clock_timestamp()::text)
where quote_cache_scope is null;

alter table private_insurance_properties
  alter column quote_cache_scope set not null;

alter table insurance_quote_cache
  add column if not exists cache_scope text not null default 'shared';

alter table insurance_quote_cache
  drop constraint if exists insurance_quote_cache_address_policy_unique;

alter table insurance_quote_cache
  add constraint insurance_quote_cache_address_policy_scope_unique
  unique (address_normalized, policy_type, cache_scope);

commit;