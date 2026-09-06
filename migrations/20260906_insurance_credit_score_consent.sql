-- Persist the authenticated consumer's authorization for credit-based
-- insurance scoring. A null value means permission has not been granted or
-- has been withdrawn.
alter table private_user_profiles
  add column if not exists credit_score_consent_at timestamp;