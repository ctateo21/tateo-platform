---
name: Loan limits & Jumbo loan type
description: 2026 loan-limit enforcement, auto-flip FHA→Conventional→Jumbo, and how Jumbo is wired to mirror Conventional pricing.
---

## Rule
2026 limits (in `client/src/lib/loan-limits.ts`) are checked against the BASE loan amount (before financed FHA UFMIP / VA funding fee): FHA floor $541,287 (FL), conforming baseline $832,750. Over-limit auto-flips FHA→Conventional and Conventional→Jumbo with a popup; FHA over both limits jumps straight to Jumbo; Jumbo silently downgrades to Conventional when back under the limit (and clears the popup).

**Why:** loan programs are unavailable above their limits; the user asked for automatic flipping plus an explanatory popup rather than a hard error.

**How to apply:**
- Jumbo prices exactly like Conventional EXCEPT the AMI income discount — that program is capped at the conforming limit, so Jumbo is deliberately ineligible (architect flagged it; intentional).
- Sub-620 FICO cannot hold Conventional/Jumbo, so the limit effect warns WITHOUT switching (popup copy adapts via `switched: false`). Never force-switch to a product the selectors gate off.
- Adding a loan type means touching: the union type (sed-able string), FALLBACK_RATES + `rates` mirror (live rates have no jumbo key — mirrored from conventional), fullRate branches, buydown table, deferred-student factor, PMI gate, both Select dropdowns, label maps (3 places), validLoanTypes persistence arrays, fee-worksheet label.
- Watch for ping-pong with the purchase-loan-default effect (deps: occupancy/credit/veteran only — safe) and setCreditScore auto-switches.
- Update limits annually (FHFA/HUD publish in Nov/Dec, effective Jan 1).
