---
name: Tax Collector bill scraping (non-ad valorem)
description: Why/how CDD & assessment data is scraped via Apify, which actor gets past Cloudflare, and timing gotchas.
---

# Hillsborough non-ad valorem (CDD) data

- HCPA TaxEstimator's `nonAdValoremTaxes` is 0 for **every** parcel — dead field. Real CDD/solid-waste/stormwater lines exist only on the Tax Collector site (hillsborough.county-taxes.com), Cloudflare-protected.
- **Actor choice matters:** `apify/web-scraper` and puppeteer (Chrome) get 403-blocked even with RESIDENTIAL proxies; `apify/website-content-crawler` with `crawlerType: playwright:firefox` + RESIDENTIAL proxies gets HTTP 200 and ran without the full-permission approval that the official scraper actors demand.
- The site is a slow SPA (redirects to county-taxes.net token URLs): needs `dynamicContentWaitSecs: 60`, and even then a run can finish before bill links render → parse comes back empty. Always retry once on empty parse; a run takes ~2–4 min.
- Bill pages are markdown-parseable: `### Non-Ad Valorem Assessments` table rows `| NAME | | $x.xx |` + `Total Non-Ad Valorem Assessments`; year from `## 2025\u200d Annual bill` (zero-width joiner after year!).
- Because scrapes take minutes, the tax route returns `nonAdValoremPending` and the client re-polls every 45s; results cached per folio (success 180d, failure 10min) in local Neon `non_ad_valorem_cache` (db:push pattern). Estimate = HCPA ad valorem (at purchase price) + actual bill non-ad valorem.
- **Gotcha:** `process.env` is undefined in the code_execution sandbox — test Apify/API calls via bash `curl` where secrets are real env vars.

# Multi-county notes (Tyler TaxSys `<county>.county-taxes.com`)

- Scraper is county-generic; only Hillsborough uses `A`-prefixed accounts. Cache keys for non-Hillsborough counties are namespaced `county:folio` (Hillsborough stays bare for old rows); the scrape account must stay un-prefixed.
- **Pinellas:** direct `/public/real_estate/parcels/<acct>` 404s regardless of format. Only the search URL works — `/public/search/property_tax?search_query=<DISPLAY_STRAP_NOHYPHEN>` (19-31-17 display order from the PAO ArcGIS layer, NOT INTERNAL_STRAP 17-31-19 order, which returns "no bills matched"). Bill links live on county-taxes.net and are session-bound — must be reached by depth-1 crawl from the search page, never fetched standalone.
- Some bills legitimately state "No Non-Ad Valorem assessments." — parser treats that as a valid cached $0 (`noAssessments`), not a failure; otherwise every zero-NAV parcel re-scrapes forever on the 10-min failure TTL.
- **Manatee:** PAO ArcGIS (gis.manateepao.com WebLayers/0) exposes NAV_* fields directly (CDD name + amounts) — no scrape needed, instant response.
- **Pasco:** search.pascopa.com GET returns only the form → formula fallback; other counties (sarasota/hernando/lee/collier/polk) are formula-only via COUNTY_MILLAGE.
