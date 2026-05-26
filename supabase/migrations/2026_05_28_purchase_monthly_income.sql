-- ============================================================================
-- Purchase-with-Loan monthly income persistence
-- ============================================================================
-- Adds the two columns the borrower-income save/load round-trip needs:
--
--   purchase_scenarios.monthly_income          numeric — user-entered gross
--                                                       monthly income (NOT
--                                                       the county AMI).
--   purchase_scenarios.monthly_income_source   text    — "manual" once the
--                                                       user has typed a
--                                                       value; "ami_default"
--                                                       when seeded from the
--                                                       AMI lookup; "default"
--                                                       on a brand-new row.
--                                                       The AMI-prefill
--                                                       effect skips writing
--                                                       when source="manual"
--                                                       so user input wins
--                                                       across refresh /
--                                                       login / address
--                                                       changes.
--
-- Both columns are nullable; code paths that read them treat NULL as legacy
-- (no recorded income) and fall back to the in-memory default. Safe to run
-- repeatedly; every statement is `add column if not exists`.
-- ============================================================================

alter table public.purchase_scenarios
  add column if not exists monthly_income        numeric,
  add column if not exists monthly_income_source text;
