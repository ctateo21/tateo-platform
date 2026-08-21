# County tax live contract checks

The county integrations have an opt-in smoke command that calls the real
Pinellas and Manatee systems:

```sh
npm run test:live:county-tax
```

This command is intentionally separate from `npm test`, so normal local and CI
runs remain deterministic. It needs outbound network access and `APIFY_TOKEN`
because Pinellas TaxSys is protected by Cloudflare and must be reached through
the same browser-backed crawler used in production.

Run it on a low-frequency schedule, such as weekly. A successful run checks:

- Pinellas ArcGIS resolves the fixture to the exact expected street and city,
  returns a positive numeric parcel ID, and preserves the lookup response shape.
- Pinellas TaxSys resolves that parcel to the exact same street and city,
  reaches a bill page, and returns a parsed annual-bill shape.
- Manatee ArcGIS resolves the fixture to the exact expected street and city,
  returns a positive numeric parcel ID, and preserves all tax/NAV result fields.

Dollar totals are only checked for valid numeric shape where the fixture has a
bill. No volatile value is pinned.

## Scheduled monitoring

The repository includes an isolated GitHub Actions workflow at
`.github/workflows/county-tax-live-contract.yml`. It runs every Monday at
14:17 UTC and can also be started manually from the Actions tab. It is not
part of normal pull-request checks, because it calls live county providers and
can take several minutes.

Before its first scheduled run, add `APIFY_TOKEN` as a **repository Actions
secret**:

1. Open the repository's **Settings → Secrets and variables → Actions**.
2. Create a repository secret named `APIFY_TOKEN`.
3. Paste the token used by the production browser-backed TaxSys crawler.

The workflow passes this value only to the live test process; it never prints
the secret in workflow output. When the check fails, it retains
`county-tax-live-contract.log` as a downloadable Actions artifact for 90 days
and opens (or comments on) the tracked
`[Automated] County tax live contract check is failing` issue. The repository
owner is assigned to a newly created alert issue so the failure is visible to
the maintainer. Close that issue after a successful diagnosis or recovery; a
later failure will create a new alert.

## Public fixtures

The committed fixtures are public-facing, non-residential locations:

- Pinellas: `501 5th Ave NE, St Petersburg, FL 33701`
- Manatee: `1305 17th St W, Palmetto, FL 34221` (county-owned fairgrounds)

## Rotating a fixture

Rotate a fixture only when the county record itself has legitimately changed,
not merely because the provider is temporarily unavailable.

1. Choose a stable public civic or public-facing commercial property. Do not
   commit a private residence or a customer address.
2. Confirm the exact canonical situs street and city in the county ArcGIS
   response.
3. For Pinellas, also confirm TaxSys shows the same situs identity and exposes
   at least one rendered annual bill.
4. Update the fixture query and exact situs constants in
   `scripts/county-tax-live-contract.test.ts`. Do not pin its parcel ID or any
   tax dollar amount.
5. Run `npm run test:live:county-tax` twice. Both runs must resolve the exact
   identity, a positive parcel ID, and the expected response shapes.