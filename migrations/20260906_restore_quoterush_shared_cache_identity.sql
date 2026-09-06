-- Restore the business-critical QuoteRUSH paid-cache identity to normalized
-- address + policy type only. Run the duplicate-group audit before applying.
-- The physical scope columns remain inert to avoid destructive migration risk.
begin;

do $$
begin
  if exists (
    select 1
    from insurance_quote_cache
    group by address_normalized, policy_type
    having count(*) > 1
  ) then
    raise exception
      'QuoteRUSH shared-cache identity migration blocked: duplicate address/policy rows require review';
  end if;
end
$$;

alter table insurance_quote_cache
  drop constraint if exists insurance_quote_cache_address_policy_scope_unique;

alter table insurance_quote_cache
  drop constraint if exists insurance_quote_cache_address_policy_unique;

alter table insurance_quote_cache
  add constraint insurance_quote_cache_address_policy_unique
  unique (address_normalized, policy_type);

alter table private_insurance_properties
  alter column quote_cache_scope set default 'unused';

commit;