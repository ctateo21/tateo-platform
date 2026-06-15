-- Seller estimated capital-gains tax inputs + result.
-- Additive + idempotent: safe to run on an existing seller_scenarios table.
-- The client persistence layer (persistSellerScenarios in client/src/lib/auth.ts)
-- treats every column below as optional and will strip-and-retry if it is
-- missing, so existing saves keep working until this migration is applied.
--
--   primary_residence_2_of_5  : true | false | null (unanswered)
--   filing_status             : 'single' | 'married' | null
--   assume_1031_exchange      : run numbers assuming a qualifying 1031 exchange
--   capital_improvements      : added to cost basis (reduces taxable gain)
--   prior_purchase_price      : basis source (Zillow/cache or manual)
--   prior_purchase_price_source: 'zillow' | 'property_cache' | 'manual' | 'unknown'
--   estimated_taxes_due       : derived snapshot (UI always recomputes)
alter table public.seller_scenarios
  add column if not exists primary_residence_2_of_5    boolean,
  add column if not exists filing_status               text,
  add column if not exists assume_1031_exchange         boolean default false,
  add column if not exists capital_improvements         numeric default 0,
  add column if not exists prior_purchase_price         numeric,
  add column if not exists prior_purchase_price_source  text,
  add column if not exists estimated_taxes_due          numeric default 0;

-- filing_status may only be null / 'single' / 'married'.
alter table public.seller_scenarios
  drop constraint if exists seller_scenarios_filing_status_chk;
alter table public.seller_scenarios
  add constraint seller_scenarios_filing_status_chk
  check (filing_status is null or filing_status in ('single', 'married'));
