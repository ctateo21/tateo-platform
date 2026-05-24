-- ============================================================================
-- Property alert events — email delivery status columns
-- ============================================================================
-- Phase 1 wrote events with status='pending' but had no email send. This
-- migration extends the row so the send helper can record per-recipient
-- delivery results (user email + Follow Up Boss lead email). The old
-- `status` / `sent_at` columns are kept for backward compatibility and
-- now reflect the *overall* event status (succeeds if either send works,
-- failed only if both fail).
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.property_alert_events
  add column if not exists user_email            text,
  add column if not exists fub_email             text,
  add column if not exists user_email_status     text not null default 'pending'
    check (user_email_status in ('pending','sent','failed','skipped')),
  add column if not exists fub_email_status      text not null default 'pending'
    check (fub_email_status in ('pending','sent','failed','skipped')),
  add column if not exists user_email_sent_at    timestamptz,
  add column if not exists fub_email_sent_at     timestamptz,
  add column if not exists email_error_message   text,
  add column if not exists fub_error_message     text;

-- Index helps the (future) retry worker pull pending/failed events quickly.
create index if not exists property_alert_events_email_status_idx
  on public.property_alert_events(user_email_status, fub_email_status, created_at);
