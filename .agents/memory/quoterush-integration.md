---
name: QuoteRUSH live carrier quoting
description: How Havo's live insurance quoting talks to QuoteRUSH — manual trigger, address+policy cache, property provenance, lead authz, privacy, and duplicate-spend protection.
---

# QuoteRUSH integration

Live carrier home-insurance quoting on the insurance page. Flow:
enrich property data → import lead (importer.quoterush.com) → extract
LeadId → SubmitQuoteRequest (triggers QuoteBot) → client polls
GetQuotes every 30s (QuoteCounter=0 means still processing; quotes
arrive over 2–10 min).

## Quoting is MANUAL-only (no auto-trigger anywhere)
Per product decision, a new (paid) QuoteRUSH quote fires **only** when
the user clicks "Get Live Quotes" in the insurance page's detailed view
(`startQuoteRush`). All automatic triggering is disabled:
- The background pre-warm `triggerAutoQuote(...)` calls were removed from
  the estimate, refinance, seller-estimate, and cash-buy pages.
- The insurance-page auto-hydrate effect no longer calls `startQuoteRush()`
  when the cache is empty; it now only *reads* cache to display existing
  results and otherwise leaves `qrStatus` "idle" so the button shows.
**Why:** the owner wanted to stop spending on quotes for every address
that merely gets viewed. Cache display is preserved everywhere; only the
paid submission is gated behind the explicit click.
**How to apply:** if asked to "auto-quote" or "warm the cache" again,
re-add `triggerAutoQuote` and/or restore the `startQuoteRush()` fallthrough
— but confirm intent first, this was deliberately turned off.

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

## Shared address + policy cache
Paid quotes are shared for 30 days by normalized property address plus
policy type (HO3/HO6/DP3), not by user and not by address alone. The first
searcher pays; later searchers receive only the three lowest positive
carrier results and the original non-private property/default context.

**Privacy rule:** shared snapshots may contain property facts, provenance,
coverage/default assumptions, and manual-lock flags. They must never contain
DOB, identity/contact data, user IDs, claim history/count/details, or reusable
personal underwriting data.

**Authorization rule:** polling and refresh require authentication and must
bind lead ID, normalized address, and policy type before any QuoteRUSH call or
cache write. Never authorize on an enumerable lead ID alone.

**Why:** address-only identity mixed policy forms; unbound lead polling enabled
enumeration/cache poisoning; applicant-specific fields are unsafe to share.

**How to apply:** keep the Neon composite uniqueness constraint, client cache
key, server lookup, atomic claim, polling request, and update predicate in
lockstep whenever the cache identity changes.

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

If QuoteRUSH has already created a lead but submit status is ambiguous (HTTP
error, timeout, or connection reset), preserve that lead and keep the cache
pending for reconciliation/polling. Never mark it retryable and re-import,
because the first submit may have succeeded and a retry can duplicate spend.

## Poll-until-stable (fixes "only 1 carrier")
Client GetQuotes polling waits for **3 consecutive stable polls**
(unchanging QuoteCounter) before declaring success, so it doesn't stop
at the first carrier while others are still arriving.

## 30-day PolicyEffectiveDate
The HO payload in `quoterush.ts` sets PolicyEffectiveDate to today+30d.

## Explicit property answers always win
When a user provides exact property answers for a live quote, send those
answers unchanged and do not let QuoteRUSH property enrichment replace
the year built or construction. Any client capable of starting a paid
quote must require the exact year, roof, opening-protection, roof-shape,
SWR, construction, and deductible inputs rather than silently filling
legacy bucket defaults. Values the UI does not collect must be disclosed
as carrier assumptions that need confirmation.
**Why:** the general estimate collects exact details, and grouped or
enriched substitutes can materially change a carrier result while the
address+policy cache preserves that first result for 30 days.
**How to apply:** keep exact fields first-priority at the quote boundary;
use enrichment only for missing ancillary data such as square footage,
and retain the shared cache/race protections rather than re-quoting when
answers change.

## Property characteristics and no-fabrication boundary
Automated factual precedence is manual confirmation → county/parcel →
QuoteRUSH property data → FEMA/government → Zillow/Havo cache → disclosed
agency default. A manual lock always wins.

The shared property-characteristics cache lives in Supabase with a one-year
TTL; the paid quote cache lives in Neon. Hillsborough and Collier intentionally
cache null county-building data because no reliable source is available.

Never fabricate square footage, unknown FEMA zone X, claim records, a flood
policy, mortgage status, or framing subtype. Stucco is an exterior finish, not
a framing value. Unknown values are omitted or explicitly collected. Claims
are user-owned/private and require complete actual details before submission.

**Why:** invented rating inputs can materially misprice a quote and are then
amplified by the 30-day shared cache.

**How to apply:** verified enrichment may fill only missing unlocked values;
cache/public responses must preserve provenance without exposing private
underwriting answers.

## QuoteRUSH Apply Defaults is emulated in the importer

Havo cannot click the Apply Defaults control inside the QuoteRUSH desktop
application. Policy-specific defaults must be resolved in Havo and sent as
explicit importer fields so a new lead arrives in the same intended state.
The current property-information rules are HO3 → Primary, DP3 → Investment,
HO6 → user-selected Primary/Secondary/Investment with a required rental term
for Investment, and 9 months or more occupied for every policy. QuoteRUSH
purchase price is the Havo rebuild cost for HO3/DP3 and twice that cost for
HO6.

**Why:** the integration has only the JSON importer and quote-submission API;
it has no control channel into the desktop UI.

**How to apply:** future QuoteRUSH phases should add equivalent importer
fields rather than attempting UI automation, and should resolve material
policy defaults at the server boundary before the address cache is claimed.

## Top-3 for 30 days then expired
Cache stores the top-3 ranked quotes; after the 30-day TTL the entry is
served with an `expired` flag → UI shows stale top-3 plus a re-run
prompt (Refresh = GetQuotes only, no re-submit, no cost).

## Address parsing
qr-start splits the formatted address on commas and scans segments
**from the end** for a `ST 12345` pattern (not just the last segment),
so a trailing country segment like ", USA" from Google doesn't swallow
the state/zip.

## Auto-hydrate effect + rebuild guard (historical — auto-fire now removed)
The insurance-page effect used to auto-start a quote once `rebuild`
(Coverage A) was ready, and the gotcha was to NOT bail permanently on
missing `rebuild` (it's async — bailing early meant the quote never fired).
That auto-fire is now removed (see "Quoting is MANUAL-only"), so the effect
only hydrates cache. **If auto-quoting is ever re-enabled**, restore the
fallthrough shape: early-return only on `!isAuthenticated || !address`,
then `if (!rebuild) return;` right before starting, with `rebuild` in the
dep array so it re-runs once ready — never put `!rebuild` in the top guard.

## Per-page QR display polling: tear down on address change
Any page that shows live QR quotes with its own poll (e.g. estimate page)
must, on active-address change, clear the interval AND reset leadId, gate
"start poll" on `!pollRef.current` (not `!leadIdRef.current`), and inside
the poll callback ignore results when unmounted or `addrRef.current !== addr`.
**Why:** cached pending/success for a new address otherwise leaves the old
interval running and a stale leadId ref blocking the new poll → wrong quotes.
