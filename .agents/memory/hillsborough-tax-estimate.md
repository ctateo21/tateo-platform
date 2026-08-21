---
name: Hillsborough property tax estimate
description: Durable accuracy constraints for HCPA parcel matching and caching
---

**Rule:** Treat HCPA address search as fuzzy, not authoritative. Use parcel rates only after exact normalized house, full street, unit, and postal-city identity; otherwise fall back safely. Cache parcel identity/rates rather than a final scenario tax, and bind assessments to the same PIN/folio.

**Why:** Live investigation found that a truncated multi-word street search returned a different real parcel with plausible tax data. ZIPs can also cross county lines, and cached final taxes become wrong when price, homestead, or parcel identity changes.

**How to apply:** Never relax matching to city-only or a street substring. Recalculate from current scenario inputs on every cache hit, preserve folio/assessment metadata only for the same PIN, and allow a rejected shared-ZIP HCPA lookup to continue to a supported neighboring county.
