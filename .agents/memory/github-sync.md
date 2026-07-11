---
name: GitHub sync method & checkpoint gotcha
description: How to push code to the user's GitHub repo (connector proxy, no raw tokens) and why the diff must be against the remote tree.
---

# GitHub sync (standing preference: push after every code change)

## Method: connector SDK proxy — raw tokens no longer served
The GitHub connector no longer exposes an access token via `listConnections('github')` or the raw connectors API (items come back empty / token missing). Use the proxy instead:

```js
const { ReplitConnectors } = await import('@replit/connectors-sdk'); // npm pkg, keep installed
const connectors = new ReplitConnectors();
const res = await connectors.proxy('github', '/repos/{owner}/{repo}/...', { method, body, headers });
const json = await res.json(); // returns raw Response
```

Push pattern: create blobs (base64) → create tree with `base_tree` = remote tree → create commit with parent = remote HEAD → PATCH `refs/heads/main`. Exclude `.local/` and `dist/`.

## Gotcha: diff against the REMOTE tree, never `git diff HEAD`
**Why:** Replit checkpoints auto-commit locally, so committed-but-unpushed files are invisible to `git diff --name-only HEAD` — a sync once silently omitted four feature files while pushing only package.json.

**How to apply:** fetch the remote tree recursively (`/git/trees/{sha}?recursive=1`), map path→blob sha, then compare each local file (`git ls-files` + untracked) via `git hash-object`; push every path whose sha differs.
