---
name: Google Places autocomplete sessions
description: Race-safety and billing-session rules for the current Google Place Autocomplete Data API.
---

Treat prediction requests and selected-place detail requests as two independent asynchronous generations. Invalidate prediction results whenever the query changes or a selection starts, and invalidate selected-place details whenever the user edits, abandons, or makes another selection.

**Why:** Slow responses can otherwise reopen stale suggestions or commit an older address after the user has moved on, which can navigate to or auto-create the wrong property.

**How to apply:** Keep one lazy Google autocomplete session token while the user refines a query. Clear it when selection starts and abandon it on clear, blur, or Escape. Preserve the selected prediction's original token association through its place-details fetch.