-- Refinance tab: 4 entry methods for a new loan
--   1. statement            — mortgage statement upload (existing flow)
--   2. closing_disclosure   — Final CD upload, parsed via Anthropic
--   3. manual               — user types origination details; we verify
--                             the stated balance against an amortization table
--   4. free_and_clear       — no existing lien; 1st-lien cash-out modeling
-- All columns are additive + idempotent. Existing rows are untouched
-- (entry_method backfills to 'statement' via the default on read).

alter table public.tracked_loans
  -- how this loan was entered: statement | closing_disclosure | manual | free_and_clear
  add column if not exists entry_method            text default 'statement',
  -- origination details (options 2 & 3; also extracted from the CD)
  add column if not exists purchase_date           date,
  add column if not exists original_purchase_price numeric,
  add column if not exists original_loan_amount    numeric,
  add column if not exists original_rate           numeric,   -- note rate at origination (%)
  add column if not exists original_term_months    integer,   -- e.g. 360
  -- amortization verification (option 3): the balance the schedule
  -- predicts for today, and whether the user confirmed the match
  add column if not exists amortized_balance_check numeric,
  add column if not exists balance_confirmed       boolean,
  -- option 4: property owned outright (loan_balance/current_rate/etc.
  -- are written as 0 for these rows — no NOT NULL changes needed)
  add column if not exists free_and_clear          boolean default false;
