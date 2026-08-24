-- Persist the current existing-servicer escrow balance extracted from a
-- mortgage statement. This is separate from the monthly escrow payment.
alter table public.tracked_loans
  add column if not exists current_escrow_balance numeric;