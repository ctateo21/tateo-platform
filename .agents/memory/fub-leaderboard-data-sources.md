---
name: FUB leaderboard data sources
description: Which Follow Up Boss endpoints actually hold agent activity, and their attribution-field quirks.
---

- Calls live in `/v1/calls` (each record has `userId` + `userName`), NOT in notes or events. Appointments/showings in `/v1/appointments` — but they carry `createdById` (not `userId`), and system records use `-1`, so agent resolution must check `createdById` with a `> 0` guard.
- `/v1/textMessages` and `/v1/emails` cannot be listed globally or by `userId` — FUB returns 400 requiring personId/thread/phone params. Text/email counts stay 0 by design (graceful skip with warnings).
- `/v1/activities`, `/v1/texts`, `/v1/sms` don't exist (404).
- Texts/emails ARE countable via per-person fetches (`personId` param) for people active (updated) in period, batched ~10 concurrent — but the burst exhausts FUB's rate window; fubGet must retry on 429 honoring Retry-After or later fetches (closed deals) silently fall back to wrong numbers.
- People `created` = lead creation date; using it as the period timestamp makes "closed this period" ≈ 0 for old leads. `updated` reflects stage-change recency (v4 behavior showed closed-this-month > 0 via `updated`).
- **Why:** two full leaderboard rewrites returned zeros before the debug probe revealed calls were in a dedicated endpoint; attribution fields differ per endpoint (userId / assignedUserId / createdById / name strings).
- **How to apply:** any new FUB metric — first check which id/name field the endpoint's records carry (debug probe route exists) before wiring resolution.

## v9: Deals + verbatim-spec regression pattern
- Deal pipeline sources from `/v1/deals` (83 deals): price=volume, agentCommission, pipelineName (Mortgage/Real Estate), stageName (Active Listing / Under Contract / 2026), customRealEstateTransaction (Buy/Sell), users[] = agent attribution. Active stages always shown; "2026" stages filtered by projectedCloseDate within period. Other deal-ish endpoints (transactions, closings, opportunities…) are 404 in FUB.
- **Recurring gotcha:** user's pasted spec files predate my minimal additions and silently drop them. After every verbatim apply, re-add: (1) `LEADERBOARD_VIEWERS` export (routes.ts imports it — server won't boot without), (2) the extra viewer entry in frontend TEAM_EMAILS (compare with routes.ts allowlist), (3) `< endMs` upper bound on all six in-period filters (calls/showings/texts/emails/newLeads/closedThisPeriod) or Yesterday counts today's activity, (4) 429 retry in fubGet if absent.
- Client render crashes on payloads missing new fields (stale 5-min server cache spans deploys) — keep the post-fetch normalize guard that defaults missing sections to zeros.

## Actual FUB deal stage names (debug-confirmed)
- RE stages encode Buy/Sell in the stage name itself: "Under Contract - Buy", "Under Contract - Sell", "2026 - Buy", "2026 - Sell" (customRealEstateTransaction is NOT the discriminator). Also "Active Listing" and "2025" (both pipelines have 2025 closed stages). Mortgage: "Under Contract", "2026", "2025".
- v9 classifyDeal matched bare "under contract"/"2026" + custom field, so it missed most RE deals — any classifier must match the suffixed stage names.
- FUB commission fields: `commissionValue` is authoritative (82/83 deals populated); `agentCommission` is often 0 even when commissionValue set (32/83). Where both exist, commissionValue = agentCommission + teamCommission. Leaderboard summing agentCommission undercounts.

## Rate-limit degradation rule
- Preserve the last complete leaderboard snapshot when a refresh is rate-limited; never promote a zero-filled partial refresh over known-good data. Exact duplicate source reads should share one request, and all callers must honor one cooldown.
- **Why:** independent per-person retries amplify a single 429 into a burst, while caching their partial result makes a temporary upstream limit look like real zero activity.
- **How to apply:** new leaderboard sources must use the shared request/cooldown path and surface cached or partial status explicitly instead of silently substituting zeros.
