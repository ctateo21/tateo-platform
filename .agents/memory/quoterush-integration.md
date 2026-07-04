---
name: QuoteRUSH live carrier quoting
description: How Havo's live insurance quoting talks to QuoteRUSH — secret-name mismatch, DB-backed shared-address cache, lead authz, and the auto-trigger/lost-race flow.
---

# QuoteRUSH integration

Live carrier home-insurance quoting on the insurance page. Flow:
enrich property data → import lead (importer.quoterush.com) → extract
LeadId → SubmitQuoteRequest (triggers QuoteBot) → client polls
GetQuotes every 30s (QuoteCounter=0 means still processing; quotes
arrive over 2–10 min). There is **no manual "Get Quotes" button** —
entering an address auto-triggers a quote after consulting the cache.

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

## Shared address-keyed cache (supersedes per-user lead map)
Quotes are cached in the `insurance_quote_cache` Postgres table (Neon
`db`, not Supabase) keyed by `addressNormalized` (which is `.unique()`),
NOT per user. The cache is **shared across all users** with a 30-day
TTL — the first searcher of an address pays; everyone else reads the
cached top-3 free. This replaced the old in-process `Map<leadId,
userId>` IDOR guard entirely.
**Authz now:** IDOR is prevented by `qrLeadIsKnown()` which checks the
leadId exists in the cache table before serving GetQuotes. A raw
enumerated leadId that isn't in the table is rejected.
**Cache-poisoning rule (critical):** qr-quotes and qr-refresh MUST
persist results with `WHERE insuranceQuoteCache.leadId = leadId` — never
a caller-supplied address. A known leadId is bound to exactly one row;
trusting the caller's `address` would let a valid leadId overwrite a
different address's cached quotes.
**Why:** the poisoning vector and the shared-cache switch were both
found/added during code review.

## Concurrent claim race + lost-race client flow
qr-start claims the cache row atomically via `onConflictDoNothing`.
Pending rows are **never deleted** (returning them lets late arrivals
attach to the in-flight lead). If a caller loses the claim race it gets
`{leadId:null, fromCache:true, status:"pending"}` — it must NOT fire a
second (paid) submission.
**Client rule:** every pending-without-leadId entry point (startQuoteRush,
the auto-hydrate effect's local+server branches, and quoterush-auto.ts's
qr-start handler) funnels into `pollCacheForLead(addr)` which polls
qr-cache every 5s (24-attempt cap) until a leadId/success appears, then
hands off to `startPolling`. Treat `{status:"pending"}` as pending, not
error. `qrWaitRef` holds that timer and is cleared on address change.

## Poll-until-stable (fixes "only 1 carrier")
Client GetQuotes polling waits for **3 consecutive stable polls**
(unchanging QuoteCounter) before declaring success, so it doesn't stop
at the first carrier while others are still arriving.

## 30-day PolicyEffectiveDate
The HO payload in `quoterush.ts` sets PolicyEffectiveDate to today+30d.

## Top-3 for 30 days then expired
Cache stores the top-3 ranked quotes; after the 30-day TTL the entry is
served with an `expired` flag → UI shows stale top-3 plus a re-run
prompt (Refresh = GetQuotes only, no re-submit, no cost).

## Address parsing
qr-start splits the formatted address on commas and scans segments
**from the end** for a `ST 12345` pattern (not just the last segment),
so a trailing country segment like ", USA" from Google doesn't swallow
the state/zip.

## Auto-hydrate effect must not bail permanently on missing rebuild
The insurance-page auto-quote effect must NOT include `!rebuild` in its
early-return guard. `rebuild` is computed asynchronously; if the guard
bails when it's absent the effect never starts a quote even after rebuild
arrives. Correct shape: early-return only on `!isAuthenticated || !address`,
then check `if (!rebuild) return;` as a fallthrough right before starting —
with `rebuild` in the dep array so the effect re-runs once it's ready.

## Per-page QR display polling: tear down on address change
Any page that shows live QR quotes with its own poll (e.g. estimate page)
must, on active-address change, clear the interval AND reset leadId, gate
"start poll" on `!pollRef.current` (not `!leadIdRef.current`), and inside
the poll callback ignore results when unmounted or `addrRef.current !== addr`.
**Why:** cached pending/success for a new address otherwise leaves the old
interval running and a stale leadId ref blocking the new poll → wrong quotes.
