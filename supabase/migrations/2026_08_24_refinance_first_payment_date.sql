-- Preserve the first scheduled mortgage-payment due date extracted or
-- inferred from a Closing Disclosure.
alter table public.tracked_loans
  add column if not exists first_payment_date date;