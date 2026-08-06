-- Onboarding drip-campaign send log (onboarding_v1).
-- One row per user × campaign × step actually sent; the scheduler checks
-- this table before sending so steps are never double-sent across
-- server restarts.
--
-- Run this in the Supabase SQL editor (agent cannot ALTER the user's
-- Supabase directly).

create table if not exists public.email_campaign_log (
  id            serial primary key,
  user_id       text not null,
  email         text not null,
  campaign_id   text not null default 'onboarding_v1',
  step_number   integer not null,
  sent_at       timestamptz not null default now(),
  status        text not null default 'sent'
);

-- UNIQUE: this is the atomic claim that makes double-sends impossible —
-- concurrent schedulers (signup timer + boot resume, or two server
-- processes) both try to insert; only one wins and only the winner sends.
create unique index if not exists email_campaign_log_user_idx
  on public.email_campaign_log (user_id, campaign_id, step_number);
