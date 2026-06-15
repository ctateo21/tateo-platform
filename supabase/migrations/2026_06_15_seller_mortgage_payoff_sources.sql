-- Sell-Your-Home: multi-source Mortgage Payoff resolution.
--
-- The seller flow now resolves Mortgage Payoff from several sources with
-- a strict priority (manual > statement > refinance match > amortized
-- estimate > existing > $0). This migration adds the two optional jsonb
-- columns that store the supporting metadata. The existing
-- `mortgage_payoff_source` text column is reused — it simply takes new
-- values ('refinance', 'statement', 'amortized_estimate') in addition to
-- the legacy 'refinance_statement' | 'manual'.
--
-- Idempotent + additive. Safe to run more than once. Run this in the
-- Supabase SQL editor; the app strips these columns and warns until the
-- migration is applied (see SELLER_OPTIONAL_COLUMNS in client/src/lib/auth.ts).

alter table public.seller_scenarios
  add column if not exists mortgage_payoff_estimate_inputs jsonb default '{}'::jsonb,
  add column if not exists mortgage_statement_metadata     jsonb default '{}'::jsonb;
