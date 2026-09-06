# QuoteRUSH `GetPropertyData` field inventory

This inventory is deliberately limited to fields confirmed in the current
integration fixtures/code. A successful response is stored as complete JSON in
the server-only `insurance_quote_cache.raw_quoterush_property_data` column so
future mapping work can inspect additional provider fields without making them
public.

| Observed field | Classification | Current handling |
| --- | --- | --- |
| `SquareFeet` | Mapped and used | Parsed only when no trusted square-foot answer is already available; sent through the existing verified `HO.SquareFeet` importer mapping. |
| `YearBuilt` | Available but not used for enrichment | Parsed for inspection only. A manual/existing quote answer remains authoritative, and no new override was added. |
| `ConstructionType` | Available but ambiguous | Parsed for inspection only; not mapped to an importer value. |
| `MasonryConstruction` | Available but ambiguous | Parsed for inspection only; not mapped to an importer value. |

`sqFt`, `square_feet`, `yearBuilt`, `constructionType`, and `masonry` appear
only as compatibility aliases in the parser; they are not confirmed provider
fixture fields and are not additional documented QuoteRUSH fields.

All other response fields are retained unchanged in the server-only raw JSON.
Because the provider schema is open-ended, this payload may contain sensitive
or personal data. It is not claimed to be PII-free, must never be logged, and
must never be returned by a public route. These fields deliberately are not
sent to QuoteRUSH Home import until an importer key
and the field semantics have been verified. No admin inspection endpoint was
added: this application has no QuoteRUSH-specific trustworthy authorization
mechanism for exposing raw provider data. Inspection is database/server-side
pending such an authorization mechanism.

The current source plumbing does not provide verified listing dates/prices,
prior sold dates/prices, or current-policy expiration dates to this
integration. Those values remain unavailable rather than being invented.