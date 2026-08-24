---
name: Refinance financing defaults
description: Default fee and escrow-reserve financing behavior for refinance loans with existing escrows.
---

When a current refinance loan has a positive monthly escrow payment and no saved preference yet, default both financing closing costs and including the new escrow reserve to enabled.

**Why:** The user expects an escrowed borrower to refinance both costs and escrows by default, minimizing estimated out-of-pocket funds.

**How to apply:** Persist the inferred defaults on first use. Treat any previously saved true or false value as an explicit user choice and never overwrite it during hydration or recalculation.