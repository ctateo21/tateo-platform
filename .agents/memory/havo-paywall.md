---
name: Havo Pro paywall & trial model
description: ACTIVE MODE is FREE_ACCESS (no payment anywhere); the paid Stripe/trial model below is dormant but retained for re-enable.
---

# CURRENT MODE: FREE_ACCESS (no payment screen)

The app is in free-access mode: free to use with a free account, NO credit card / Stripe checkout / subscription required anywhere. The paid model documented further down is intentionally kept in source but bypassed.

- Flag: client `FREE_ACCESS_MODE` (`client/src/lib/access.ts`) and server (`server/routes.ts`) are BOTH now hard-coded `= true` (no longer env-driven). **Why:** prod kept showing the Stripe paywall because a `VITE_FREE_ACCESS_MODE`/`FREE_ACCESS_MODE="false"` env could silently re-enable payments; owner wanted free-for-all permanently. To restore paid mode, change these constants back to env-driven values.
- `useSubscription()` short-circuits to `{active:true,status:"free_access"}` with NO Stripe call; server `/api/subscription/status` returns the same. Stripe code paths untouched.
- The `/subscribe` payment page early-returns `<Redirect to="/dashboard">` whenever the flag is on (covers guests + signed-in), so the paywall is unreachable. After a successful register, AuthDialog navigates straight to `/dashboard` so new users can run quotes immediately.
- FUB notify: client fires `account_created` (register) / `account_signed_in` (login) ONLY — never on session hydrate/refresh. Server `POST /api/leads/account-event` is auth-required (requireUser), derives email/name/phone from the verified Supabase session (ignores body identity), accepts only an `event` enum, and dedupes sign-ins per-user within 5 min.
- **Why:** owner wanted zero-friction free access while preserving the ability to flip paid back on. No SQL/migration was needed — `public.profiles` already had email/phone and the signup form already collected phone.

---

# Havo Pro paywall (DORMANT — only active when FREE_ACCESS_MODE is off)

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
`GET /api/subscription/status` short-circuits to `{active:true, status:"comped"}` for allowlisted emails via `hasFreeAccess()` — the owner's admin email is hardcoded (see the helper in `server/routes.ts`); extra emails via `COMP_ACCESS_EMAILS` env (comma-separated). Status is the single gate source for both ToolGate and ProtectedRoute, so this one check grants full no-paywall access everywhere.

**Why:** owner explicitly preferred simplicity over server-side enforcement.
**Accepted limitations (do not re-litigate without owner ask):** backend tool APIs are NOT subscription-gated (direct API calls bypass), and the anonymous limit is resettable by clearing localStorage. The free-home gate relies on in-page address changes keeping `?address` in sync (true for estimate/insurance/refinance; cash-buy keeps address in internal state so its in-page property swap can evade the gate).
