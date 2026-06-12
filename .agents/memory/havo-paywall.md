---
name: Havo Pro paywall & trial model
description: How tool access is gated (subscription + 7-day trial + one free anonymous quote) and the deliberate simplicity tradeoffs behind it.
---

# Havo Pro paywall

Single plan "Havo Pro" $20/month, no annual. Stripe sandbox ("Havo LLC").

## Stripe approach
- Raw fetch, NO SDK. Managed Payments requires the **preview** API version header (`Stripe-Version: 2026-02-25.preview`) on checkout/subscription/session calls.
- One idempotent price via `lookup_key havo_pro_monthly`.
- **No webhooks.** Activation = confirm-on-return (`/subscribe/success` posts the session id) + live status re-check against Stripe. No public URL / webhook secret needed.
- 7-day trial: checkout sets `subscription_data.trial_period_days=7` + `payment_method_collection=always` so the card is captured up front and auto-charged after the trial. `trialing` counts as active.

**Why:** Managed Payments only works on the preview version; webhooks add infra the owner didn't want.

## Access tiers (gating is CLIENT-SIDE)
- Signed-in + active sub (active|trialing) → full access.
- Signed-in, no active sub → redirect `/subscribe` (start trial; card required first — interpretation B, not a no-card reverse trial).
- Anonymous → ONE free home: first `?address=` opened in any tool is stored in `localStorage` (`havo_free_address`); any other home → "create account" prompt. Save/Send/Download/Dashboard already gated for logged-out users by `ScenarioActions` (AuthDialog).
- `ToolGate` wraps the 5 tools; `select-service` public; `dashboard` behind account+sub `ProtectedRoute`.

### Comped / free-access accounts
`GET /api/subscription/status` short-circuits to `{active:true, status:"comped"}` for allowlisted emails via `hasFreeAccess()` — `admin@tateoco.com` is hardcoded; extra emails via `COMP_ACCESS_EMAILS` env (comma-separated). Status is the single gate source for both ToolGate and ProtectedRoute, so this one check grants full no-paywall access everywhere.

**Why:** owner explicitly preferred simplicity over server-side enforcement.
**Accepted limitations (do not re-litigate without owner ask):** backend tool APIs are NOT subscription-gated (direct API calls bypass), and the anonymous limit is resettable by clearing localStorage. The free-home gate relies on in-page address changes keeping `?address` in sync (true for estimate/insurance/refinance; cash-buy keeps address in internal state so its in-page property swap can evade the gate).
