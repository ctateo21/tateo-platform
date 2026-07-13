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
