-- Private, user-owned policy details are property-specific and must remain
-- separate from the shared QuoteRUSH address cache.
create table if not exists private_insurance_properties (
  user_id text not null,
  address_normalized text not null,
  current_policy_expiration_date date,
  quote_cache_scope text not null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  primary key (user_id, address_normalized)
);