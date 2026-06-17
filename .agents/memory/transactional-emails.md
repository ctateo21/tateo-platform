---
name: Transactional emails & scenario-save hook
description: Where account/scenario emails live, the Resend config they need, and the one server-side scenario-save hook.
---

# Transactional emails (Resend)

All emails live in `server/integrations/property-alert-emails.ts` and share one
pattern: `getResend()` + `sendOne()`. Every sender is best-effort — it returns
`{status, error}` and never throws, so call sites fire-and-forget with `.catch()`.

**Config gotcha:** emails silently `skip` (status `"skipped"`, no send) unless
both `RESEND_API_KEY` and `ALERT_FROM_EMAIL` secrets are set.

**Internal-alert recipient gotcha:** `sendInternalAlert` needs a TO address.
`INTERNAL_ALERT_EMAIL` is NOT set in this project (only `ALERT_FROM_EMAIL` is),
which silently dropped showing-request alerts. Recipient now falls back
`INTERNAL_ALERT_EMAIL → FUB_ALERT_EMAIL → ALERT_FROM_EMAIL`, so alerts reach the
verified sender mailbox by default. To route to a dedicated ops inbox, set
`INTERNAL_ALERT_EMAIL`. **Why:** a "no email arrived" report usually means the
recipient var, not the send path, is missing — check which TO vars are actually
set before touching send logic.

# Scenario-save hook (non-obvious)

Scenarios are persisted **client-side directly to Supabase** (purchase/refinance/
seller/cash_buy each save from their own page). There is **no per-type server-side
save endpoint**. The only server-side "a scenario was saved" signal is
`POST /api/leads/notify-new-scenario`, and currently only the purchase page
(`estimate.tsx`) calls it. Any server logic that must run on scenario save
(FUB contact, internal alert) hangs off that one route — and the client must
pass `scenarioType` for it to be meaningful (server defaults to `"Scenario"`).

**Why:** future requests like "email/track on every scenario save" will look for
server save handlers that don't exist; route them through notify-new-scenario and
ensure each scenario page sends the call with a concrete `scenarioType`.
