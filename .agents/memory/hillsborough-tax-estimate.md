---
name: Hillsborough property tax estimate
description: How Havo reproduces the HCPA Tax Estimator exactly (per-parcel rates endpoint, decoy gotcha, 85% ratio)
---

**Rule:** Don't hardcode Hillsborough millage. HCPA exposes the same JSON endpoint its own Tax Estimator uses: `https://gis.hcpafl.org/CommonServices/property/search/TaxEstimator?pin=<strap>` — returns the parcel's actual `schoolTaxRate`, `nonschoolTaxRate`, `nonAdValoremTaxes` (CDD etc.), taxDistrict.

**Gotchas:**
- The `pin` MUST be the internal `strap` from the ArcGIS parcel layer (e.g. `203229C89000000001470U`). Passing the folio (or any unrecognized pin) returns plausible-looking **obfuscated decoy JSON** that changes every request. Validate by checking `parcelID === strap` in the response.
- School millage varies by district (e.g. 6.34 unincorporated vs 7.336 assumed) — a flat county-wide school rate is wrong.
- HCPA's lower-bound formula (from their taxEstimatorVM.js): taxable T = 85% of price; homestead: school (T−25k)×schoolRate, non-school (T−50k)×nonschoolRate with a phase-in between 50–75k (taxable capped at 25k there); plus nonAdValoremTaxes flat.
- `tsx` dev server does NOT hot-reload server files — restart the workflow after editing server integrations or you'll test stale code.

**Why:** User compared Havo against the HCPA estimator twice; with per-parcel rates Havo matches HCPA's lower bound to the dollar ($6,613 Wimauma, $11,413 Tampa).

**How to apply:** If a Hillsborough tax figure is challenged, compare against HCPA's LOWER bound at the exact price entered; check the server log line `[hcpa-tax]` to confirm the live path ran, and remember the client only shows the live figure once the async sync effect writes it into stored inputs.
