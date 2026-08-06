-- Remember income & debts across sessions for the refi DTI check.
-- Borrower-level figures (monthly, dollars) live on the profile — they
-- are account-level, not loan- or scenario-level.
-- Additive + idempotent; safe to re-run.

alter table public.profiles
  add column if not exists monthly_income numeric,
  add column if not exists monthly_debts  numeric;
