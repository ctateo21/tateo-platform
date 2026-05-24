-- ============================================================================
-- Property alert subscriptions + alert events
-- ============================================================================
-- Lets a logged-in user subscribe to "rate drop" or "price drop" alerts on
-- a saved scenario (purchase / refinance / cash_buy / seller). The bell on
-- the dashboard row reflects whether at least one is_active subscription
-- exists for that scenario.
--
-- Subscriptions are keyed by (user_id, scenario_id, scenario_type, alert_type)
-- so a user gets at most one active rate alert and one active price alert
-- per scenario.
--
-- Alert events store the audit trail (one row per notification the system
-- decided to send) and double as a dedupe ledger so the scheduled jobs
-- don't spam the user for the same threshold.
--
-- Run once in the Supabase SQL editor. Idempotent.
-- ============================================================================

create table if not exists public.property_alert_subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  scenario_id               text not null,
  scenario_type             text not null check (scenario_type in ('purchase','refinance','cash_buy','seller')),
  alert_type                text not null check (alert_type in ('rate_drop','price_drop')),
  is_active                 boolean not null default true,

  -- Denormalized property identity (helps the scheduled jobs match against
  -- property_cache without re-joining to the canonical scenario tables).
  normalized_property_key   text,
  property_address          text,
  zpid                      text,
  zillow_url                text,

  -- Rate-drop fields.
  target_rate               numeric(6,3),
  loan_type                 text,
  loan_term_years           integer,
  occupancy_type            text,
  credit_score              integer,
  ltv                       numeric(6,3),
  last_alerted_rate         numeric(6,3),

  -- Price-drop fields.
  initial_watched_price     numeric(14,2),
  last_seen_price           numeric(14,2),
  last_alerted_price        numeric(14,2),

  last_checked_at           timestamptz,
  last_notified_at          timestamptz,
  notification_channel      text not null default 'email',

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- One active row per (user, scenario, alert_type). A user can re-subscribe
-- after unsubscribing because we flip is_active rather than delete.
create unique index if not exists property_alert_subscriptions_unique_active_idx
  on public.property_alert_subscriptions(user_id, scenario_id, scenario_type, alert_type);

create index if not exists property_alert_subscriptions_active_type_idx
  on public.property_alert_subscriptions(alert_type, is_active);

create index if not exists property_alert_subscriptions_property_key_idx
  on public.property_alert_subscriptions(normalized_property_key);

alter table public.property_alert_subscriptions enable row level security;

drop policy if exists "alerts: owner read"   on public.property_alert_subscriptions;
drop policy if exists "alerts: owner insert" on public.property_alert_subscriptions;
drop policy if exists "alerts: owner update" on public.property_alert_subscriptions;
drop policy if exists "alerts: owner delete" on public.property_alert_subscriptions;

create policy "alerts: owner read"
  on public.property_alert_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

create policy "alerts: owner insert"
  on public.property_alert_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "alerts: owner update"
  on public.property_alert_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "alerts: owner delete"
  on public.property_alert_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- Alert event audit log
-- ----------------------------------------------------------------------------
create table if not exists public.property_alert_events (
  id                uuid primary key default gen_random_uuid(),
  subscription_id   uuid not null references public.property_alert_subscriptions(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  event_type        text not null check (event_type in ('rate_drop','price_drop')),
  property_address  text,
  old_value         numeric(14,3),
  new_value         numeric(14,3),
  message           text,
  status            text not null default 'pending' check (status in ('pending','sent','failed')),
  created_at        timestamptz not null default now(),
  sent_at           timestamptz
);

create index if not exists property_alert_events_subscription_idx
  on public.property_alert_events(subscription_id, created_at desc);

create index if not exists property_alert_events_user_idx
  on public.property_alert_events(user_id, created_at desc);

alter table public.property_alert_events enable row level security;

drop policy if exists "alert events: owner read" on public.property_alert_events;

create policy "alert events: owner read"
  on public.property_alert_events
  for select to authenticated
  using (user_id = auth.uid());

-- Writes happen only through the service-role server, so no insert/update
-- policy for the authenticated role.
