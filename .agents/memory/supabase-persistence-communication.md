---
name: Supabase persistence communication
description: User expectation for persistent inputs and explicit notification whenever Supabase SQL must be applied.
---

Treat user-entered values and settings as persistent by default so they survive refresh, logout/login, and return visits.

**Why:** The user explicitly wants changes users make to be saved and restored, and wants to know whenever code changes depend on new Supabase SQL.

**How to apply:** For every feature that adds or changes persisted data, verify the full save/load round trip. Explicitly state whether Supabase SQL is required, name the migration file, provide the SQL or application instructions, and explain what will not persist until it is applied. If no SQL is required, say so when persistence is relevant.