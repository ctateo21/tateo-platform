---
name: TypeScript incremental config changes
description: How to handle stale diagnostics after changing compiler options
---

After a compiler-option change, TypeScript's incremental cache can preserve
diagnostics produced under the previous options even though `--showConfig` reports
the new configuration. A clean non-incremental run can pass while the cached run
still reports the old errors.

**Why:** incremental compilation stores diagnostics generated under its prior
compiler options, and TypeScript may not re-evaluate unchanged source files when
those options change.

**How to apply:** if diagnostics survive a compiler-option change unexpectedly,
run once without incremental mode to confirm the configuration, remove the
generated build-info cache, then rerun the normal project check. Do not disable
incremental checking permanently.
