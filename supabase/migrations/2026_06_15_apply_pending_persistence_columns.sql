-- ============================================================================
-- Pending persistence columns — consolidated, idempotent migration
-- ============================================================================
-- Run this once in the Supabase SQL editor. It is additive and safe to run
-- more than once (every statement is `add column if not exists`). It does
-- NOT touch RLS, drop anything, or create duplicate tables.
--
-- Why this exists: the app's persistence layer (client/src/lib/auth.ts)
-- already WRITES every column below, but treats them as "optional" — if a
-- column is missing on the live database it strips it and retries so saves
-- never hard-fail. The side effect is that the values are silently dropped
-- instead of saved. Applying this migration lets those already-wired saves
-- actually persist. No code changes are required.
--
-- Tables intentionally NOT listed here because they are already complete:
--   purchase_scenarios   — all editable fields + user_answer_sources present
--   cash_buy_scenarios   — all editable fields + user_answer_sources present
--   insurance_scenarios  — all editable fields + user_answer_sources present
-- ============================================================================

-- ── tracked_loans (Refinance) ───────────────────────────────────────────────
-- Occupancy + physical structure for the Policy-Type / qualification rules.
-- The legacy `property_type` column historically stores occupancy
-- (primary/secondary/investment); these two clean columns are read by newer
-- code paths and fall back to the legacy value when null.
alter table public.tracked_loans
  add column if not exists occupancy_type         text,
  add column if not exists physical_property_type text;

-- ── seller_scenarios (Sell Your Home): estimated capital-gains tax inputs ────
--   primary_residence_2_of_5  : true | false | null (unanswered)
--   filing_status             : 'single' | 'married' | null
--   assume_1031_exchange      : run numbers assuming a qualifying 1031 exchange
--   capital_improvements      : added to cost basis (reduces taxable gain)
--   prior_purchase_price      : basis source (Zillow/cache or manual)
--   prior_purchase_price_source: 'zillow' | 'property_cache' | 'manual' | 'unknown'
--   estimated_taxes_due       : derived snapshot (UI always recomputes)
alter table public.seller_scenarios
  add column if not exists primary_residence_2_of_5     boolean,
  add column if not exists filing_status                text,
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

-- ── seller_scenarios: multi-source Mortgage Payoff supporting metadata ───────
alter table public.seller_scenarios
  add column if not exists mortgage_payoff_estimate_inputs jsonb default '{}'::jsonb,
  add column if not exists mortgage_statement_metadata     jsonb default '{}'::jsonb;
