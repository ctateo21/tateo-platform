---
name: Refinance escrow-refund estimate
description: Product rule for estimating and disclosing a possible refund from the borrower’s existing servicer escrow account.
---

Use the current escrow-account balance when it is explicitly available from an uploaded mortgage statement. For a Closing Disclosure or manual entry, estimate the possible refund as two months of the current monthly escrow payment. If a statement lacks an explicit balance, the approved unavailable-balance fallback is also two monthly escrow payments.

**Why:** The user confirmed this hierarchy and fallback. A current-servicer escrow refund is possible but not guaranteed and may arrive separately after payoff.

**How to apply:** Show the estimate after cash due/cash to borrower with prominent “MAY” language. Never add it to cash-to-close, cash-to-borrower, loan proceeds, or savings calculations.