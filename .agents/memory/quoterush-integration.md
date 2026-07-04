---
name: QuoteRUSH live carrier quoting
description: How Havo's live insurance quoting talks to QuoteRUSH, including the secret-name mismatch and the lead-ownership authz guard.
---

# QuoteRUSH integration

Live carrier home-insurance quoting on the insurance page. Flow:
enrich property data → import lead (importer.quoterush.com) → extract
LeadId → SubmitQuoteRequest (triggers QuoteBot) → client polls
GetQuotes every 30s (QuoteCounter=0 means still processing; quotes
arrive over 2–10 min).

## Secret-name mismatch (important)
The original spec referenced `QUOTERUSH_WEBPASSWORD` and
`QUOTERUSH_AGENCY`, but the **actual stored Replit secrets** are
`QUOTERUSH_WEBID_PASSWORD` and `QUOTERUSH_AGENCY_ID`.
`server/integrations/quoterush.ts` reads the real names first with the
spec names as fallback. Also uses `QUOTERUSH_WEBID`,
`QUOTERUSH_ENDPOINT_KEY`, and `QUOTERUSH_ASSIGNED_EMAIL` (defaults to a
Tateo agent email when unset).
**Why:** if a future change "follows the spec literally" it will read
empty env vars and silently fail with "QuoteRUSH env vars not set".

## Lead-ownership authz guard
`/api/insurance/qr-quotes` takes a raw `leadId`. QuoteRUSH LeadIds are
sequential integers, so without a guard any logged-in user could
enumerate other users' quote data (IDOR). A module-level
`Map<leadId, userId>` in registerRoutes binds each lead at qr-start and
qr-quotes rejects mismatches (403).
**Why:** the spec omitted this; it was added during code review.
**How to apply:** the map is in-process only — a server restart
mid-poll invalidates bindings by design (fail-closed). If this needs to
survive restarts/multi-instance, persist ownership instead.

## Address parsing
qr-start splits the formatted address on commas and scans segments
**from the end** for a `ST 12345` pattern (not just the last segment),
so a trailing country segment like ", USA" from Google doesn't swallow
the state/zip.
