---
name: Tax Collector bill scraping (non-ad valorem)
description: Why/how CDD & assessment data is scraped via Apify, and the Apify actor-approval gotcha.
---

# Hillsborough non-ad valorem (CDD) data

- HCPA TaxEstimator's `nonAdValoremTaxes` is 0 for **every** parcel — dead field. Real CDD/solid-waste/stormwater lines exist only on the Tax Collector site (hillsborough.county-taxes.com), which Cloudflare-blocks plain server fetches.
- Solution: Apify `apify/web-scraper` (headless browser + RESIDENTIAL proxies) crawls the parcel account page → bill pages, parses the "Non-Ad Valorem Assessments" table; cached per folio (success 180d, failure 10min) in local Neon `non_ad_valorem_cache` (db:push pattern, no migrations dir).
- **Gotcha:** Apify official actors (web-scraper, puppeteer-scraper) require a one-time "full permission" approval in the user's Apify console before API runs succeed — error type `full-permission-actor-not-approved` with an approval URL. Code falls back gracefully (ad valorem only) until approved.
- **Gotcha:** `process.env` is undefined in the code_execution sandbox — test Apify/API calls via bash `curl` where secrets are real env vars.
- Fail closed: only bill parses with >0 lines and positive total are trusted/cached as success.
