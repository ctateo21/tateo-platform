-- Shared, short-lived IFW notification claims. The per-user transaction lock
-- in server/integrations/ifw-activity-claims.ts makes the duplicate and rate
-- checks atomic across server instances.
create table if not exists ifw_activity_claims (
  dedupe_key text primary key,
  user_id text not null,
  created_at timestamp not null default now(),
  expires_at timestamp not null
);

create index if not exists ifw_activity_claims_user_created_at_idx
  on ifw_activity_claims (user_id, created_at);

create index if not exists ifw_activity_claims_expires_at_idx
  on ifw_activity_claims (expires_at);