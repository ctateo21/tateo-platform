# QuoteRUSH importer default inventory

Classification: **A** verified fact, **B** intentional agency quote configuration,
**C** preliminary underwriting assumption (private/not a confirmed fact), and
**D** unsafe and omitted until verified.

| Importer field/default | Class | Handling |
| --- | --- | --- |
| Client identity/contact/address, DOB | A | Sent from authenticated private profile; never cached publicly |
| EntityType Individual; Gender Male; MaritalStatus Single; Industry Business/Sales/Office; Occupation Account Executive | C | Sent for Tateo's approved low-friction preliminary model; private-only and never copied to shared snapshots |
| EPolicy, lead assignment/source/status, home LOB | B | Sent agency configuration |
| AssumedCreditScore Excellent | C | Always sent as a preliminary agent assumption; no consumer credit field or gate is collected |
| CreditPermission Yes | C | Always sent as a preliminary agent assumption; no consumer credit field or gate is collected |
| Form type, Coverage B/C/D/E/F, deductibles, Water Backup, roof-loss settlement, personal injury, identity theft, increased replacement cost | B | Sent Tateo quote configuration; non-personal values recorded in the server-only `agencyDefaultSnapshot` where snapshot applicable |
| NewPurchase, usage, rental term, purchase price, purchase date, effective date | A/C | Purchase price precedence is user-confirmed contract/value, exact Cash Buy listing, exact Cash Buy sold or tracked original purchase price, then current/market-value estimates. Confirmed/manual/listing/prior-sale values are facts; Zestimate/cache/default/coarse legacy Zillow and tracked estimated-home-value fallbacks are assumptions. Unknown remains empty and requires confirmation. No paid Zillow lookup is performed, and purchase price is never derived from Coverage A. `PurchaseDate` is separate transaction history: a new-purchase closing date may populate both dates, but a rewrite requested date, current-policy expiration, and +30 fallback populate only `PolicyEffectiveDate`. Unknown historical purchase dates are omitted. |
| MonthsOccupied 9 months or more | B | Sent and recorded in the server-only `agencyDefaultSnapshot` |
| Foundation Slab; masonry/concrete-block construction; composite-shingle roof; full roof update | C | Sent as approved preliminary property assumptions when not otherwise verified; visible in assumptions, never represented as inspection facts |
| SquareFeet | A | Sent only when user or trusted property data supplies it; otherwise omitted |
| Roof shape Gable | C | Preliminary value unless exact answer supplied |
| Opening protection/SWR | C | Shared year-built resolver supplies assumptions; manual answers win |
| Roof-to-wall/deck values | D | Not sent: QuoteRUSH field mapping is not verified; no inspection metadata invented |
| Flood zone | A | Sent only when known; no flood policy is synthesized |
| MilesToCoast | A | Sent to the HO importer as a two-decimal mile string only when calculated from the cached GSHHS level-1 ocean-shoreline proxy; provenance identifies the value as an approximation rather than surveyed mean high water |
| Current insurance for new purchase | C | Sent as CurrentlyInsured Yes, carrier/policy `New Purchase`, and no-lapse preliminary assumptions |
| Current insurance for existing home | A | Private user answer is sent when supplied; carrier/lapse/policy fields otherwise omitted and never put in shared cache |
| Claims | A | Completed private applicant answers sent; neither count nor records are in public cache |
| Mortgage | A | Sent only from a derived answer; otherwise omitted |
| Terrain Exposure B; burglar/fire alarm None; fire hydrant/station proximity | B | Sent agency/property quote configuration and documented as assumptions |
| Under construction, under renovation, business premises | D | No default is sent until verified |
| FloodPolicy false / flood LOB false | B | Explicitly prevents fabricated separate flood quotes |

## Cache and verification boundaries

- The paid QuoteRUSH cache identity is normalized address + policy type only and is shared for 30 days. Private carrier, claims, DOB, and policy-expiration answers do not rotate or enter that cache identity.
- A valid shared cache result is returned before first-run private fields are required.
- `agencyDefaultSnapshot` stays server-side. Its verification list is available only through the authenticated agent endpoint; ordinary consumer and public cache responses never include personal assumptions.