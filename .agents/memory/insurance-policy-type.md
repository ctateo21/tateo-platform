---
name: Insurance policy type & property-type resolution
description: How insurance policy type (HO3/HO6/DP3) is derived from property type + occupancy, and the gotchas around it.
---

## Policy-type rule
- Condo/townhome (any variant) → HO6 regardless of occupancy.
- Else Investment → DP3; Primary/Secondary → HO3.
- `getDefaultInsurancePolicyType` already returns HO6 first for condo/townhome;
  `isCondoOrTownhomePropertyType` covers all variants. The hard part is
  resolving the *property type* for an address, not the rule itself.

## Property-type resolution priority (for an address)
`resolveInsurancePropertyTypeForAddress` (client/src/lib/insurance-policy-type.ts):
manual insurance pick → Zillow/property_cache → source scenario
(Purchase/Cash/Refi for same key) → existing insurance snapshot →
"Single Family Residence" fallback. A condo/townhome signal from ANY
non-manual source must win over a stale/default Single Family.

**Why:** stored policy types were never re-corrected to HO6 once set, and a
purchase scenario always defaults `propertyType` to "Single Family Residence",
so a condo could be masked unless another source's Zillow type is preferred.

## Where the Zillow type reaches the client
There is NO standing client property_cache query. The Zillow/property_cache
physical type arrives as the Purchase / Cash-Buy scenario `propertyType`
(normalized homeType from POST /api/zillow-property-lookup, mapped via
`zillowToPhysicalPropertyType`). Treat the source-scenario `propertyType`
as the cache-derived value on the client.

## GOTCHA: two different `TrackedLoan` types
- `client/src/lib/auth.ts` `TrackedLoan` HAS `physicalPropertyType` (physical
  structure) separate from `propertyType` (which holds OCCUPANCY).
- `client/src/components/refi/loan-tracker.tsx` `TrackedLoan` has ONLY
  `propertyType: PropertyType` (occupancy) — NO physical type.
- `dashboard.tsx` imports the loan-tracker one (so dashboard refiMatches
  cannot supply a physical property type); `insurance.tsx` uses the auth one
  (so it CAN read `loan.physicalPropertyType`). Check which `TrackedLoan` is
  in scope before reading `physicalPropertyType`.

## Cross-tab address matching
Match scenarios by normalized property key (`normalizePropertyKey(addr).key`)
with exact trimmed/lowercased address as fallback — never collapse onto an
empty key. Differently formatted strings for the same property must correlate.

## Manual locks
`policy_type_source === "manual"` must never be overwritten anywhere; manual
`property_type` still drives HO6. Guard every compute/display/sync path.
