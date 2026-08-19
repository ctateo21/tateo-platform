---
name: Private applicant date of birth
description: Privacy boundary for collecting and using applicant DOB in authenticated insurance quoting.
---

# Private applicant DOB

Store applicant DOB only in a server-owned private database table keyed by the authenticated user ID. Never place it in Supabase profile rows, auth metadata, app metadata, JWT/session payloads, or browser-readable API responses. The browser may receive only a boolean indicating whether DOB has already been saved. Resolve the raw value server-side immediately before building the QuoteRUSH request.

**Why:** Supabase profile and authentication metadata can be exposed to client code or embedded in browser session data. DOB is sensitive personal data and is not required by the client after submission.

**How to apply:** Any registration or quote-start flow may submit DOB to an authenticated server endpoint, but subsequent status checks must return only presence/absence. When changing the QuoteRUSH boundary, read DOB from the private server store and do not hydrate it into client state. Remove stale legacy DOB metadata when an authenticated user next saves DOB.