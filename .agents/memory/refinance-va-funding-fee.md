---
name: Refinance VA funding fee
description: VA disability question and subsequent-use funding-fee rule for refinance proposals.
---

For every VA refinance, require an explicit VA disability Yes/No answer before displaying proposal figures. Yes means the borrower is exempt and the funding fee is $0. No means a 3.30% subsequent-use funding fee.

**Why:** The user treats a refinance borrower with a current VA loan as subsequent use and does not want unanswered loans silently calculated as exempt.

**How to apply:** Persist the per-loan answer. Finance any nonzero fee into the proposed note and include it in funded balance, P&I, LTV limits, cash-out availability, IFW itemization/reconciliation, break-even, and savings.