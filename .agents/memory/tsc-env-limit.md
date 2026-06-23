---
name: Full-project tsc time/resource limit
description: Why `npx tsc --noEmit` won't finish in this sandbox and how to verify types instead
---

Running `npx tsc --noEmit` over the whole project does NOT complete within the agent
sandbox's time/resource budget — it runs many minutes and either times out at the
2-minute tool wall or gets killed. Backgrounding it (nohup + poll a `.done` file)
also fails to finish in a reasonable window because some page files are very large
(e.g. estimate.tsx is several thousand lines).

**Why:** the codebase is large and tsc is single-threaded/heavy; the sandbox caps
CPU/time.

**How to apply:** don't rely on a clean full `tsc` run as the gate. For small,
provably type-safe edits, verify via the running Vite dev server instead — refresh
logs and confirm the changed files show `[vite] hot updated: /src/...` with no
`Transform failed` / `Pre-transform error` / `Failed to compile`. That is the
practical compiler check here. Reserve full tsc for when you truly suspect a
type regression and can afford the wait.

**tsconfig fact (matters for deletions):** `tsconfig.json` sets `strict: true` but
NOT `noUnusedLocals` / `noUnusedParameters`. So removing code (e.g. stripping
`console.log` lines) cannot create "declared but never read" errors — a variable
left unused by a deletion is fine. To prove a removal-only change is type-clean
without a full tsc, parse each changed file with the TS API
(`ts.createSourceFile(..., true)` and check `sf.parseDiagnostics`) — that catches
the only real risk (syntax breakage like a dangling braceless `else`).
