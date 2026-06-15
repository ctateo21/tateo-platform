---
name: Seller mortgage payoff resolution
description: How Sell-Your-Home Mortgage Payoff is resolved and the invariants that must hold.
---

# Seller Mortgage Payoff resolution

Mortgage Payoff for a Sell-Your-Home scenario is resolved by a strict source
priority (highest wins): **manual → statement → refinance match → amortized
estimate → existing → zero**.

**Invariant (do not break):** a `manual` or `statement` value is NEVER
auto-overwritten by the refinance/amortization auto-resolution. Only an
explicit user action overrides it — a new statement upload, a manual edit, or
the "Reset / Recalculate" button (which passes `ignoreManualLock: true`).
**Why:** users enter a payoff they trust; silently replacing it with an
estimate destroys confidence and corrupts net-proceeds.
**How to apply:** the pure resolver enforces the lock, AND the React state
updater re-checks `prev.mortgagePayoffSource` as a second guard before writing.
Keep both guards — the effect can fire mid-hydration before the lock is loaded.

**Refinance match → payoff** uses the matching Refinance tracked-loan's current
balance field. Property matching is normalized_property_key first, then exact
lowercased full-address fallback (same matcher as insurance).

**Amortized estimate defaults:** 6.5% annual / 30-year term, original loan
amount = last *recorded sale price* (not Zestimate/list), clock from last sale
date. Estimate-only; always shows a disclaimer.

**Don't downgrade:** a refinance-sourced value must not be replaced by an
amortized estimate when the loans list is briefly empty during hydration.
