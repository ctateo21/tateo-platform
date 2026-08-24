-- Persist the refinance borrower's VA disability funding-fee exemption.
-- true = exempt ($0 funding fee); false = 3.30% subsequent-use fee.
alter table public.tracked_loans
  add column if not exists va_disability boolean;