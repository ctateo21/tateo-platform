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
