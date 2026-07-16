---
name: Hillsborough property tax estimate
description: Why the HCPA Tax Estimator range exists and how Havo matches its lower bound
---

**Rule:** The HCPA Tax Estimator's "range" is an assessed-value range, not an ad-valorem/non-ad-valorem split: the lower bound taxes ~85% of the purchase price (Florida appraisers assess below sale price), the upper bound taxes 100%. Havo intentionally returns the lower number, so the server-side calc multiplies purchase price by an 85% assessed ratio before applying millage and homestead exemptions.

**Why:** User compared Havo vs HCPA for a real Tampa address ($726,100 homestead): taxing the full price matched HCPA's UPPER bound ($13,574) while the user expected the lower ($11,413). With the 85% ratio Havo lands within ~0.25% of the HCPA lower bound.

**How to apply:** If tax estimates for Hillsborough are challenged again, compare against HCPA's lower bound, not the upper; don't remove the assessed ratio without recalibrating against the live HCPA estimator. Millage rates are per-municipality (resolved via the public HCPA ArcGIS parcel API) and change yearly — the 2026 rates are hardcoded.
