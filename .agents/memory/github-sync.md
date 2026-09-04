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

## Resolve the base tree through the branch commit
Do not assume the `sha` returned by `/git/trees/main?recursive=1` is safe to reuse as `base_tree`; resolve the branch ref, fetch its commit, and use `commit.tree.sha`.

**Why:** the branch-name tree lookup returned the branch commit SHA in `sha`, causing a false concurrent-change check even though `main` had not moved.

**How to apply:** GET the branch ref for the parent commit SHA, GET `/git/commits/{parent}`, use `commit.tree.sha` for recursive comparison and `base_tree`, then update the ref with `force: false`.

## Fallback when connector/API ref updates are blocked
If the installed connector cannot see the target private repository, or a configured publishing credential can create Git objects but cannot update the branch ref through the Git Data API, use an authenticated temporary clone and a normal non-force Git push.

**Why:** Repository permissions can differ between connector proxy calls, Git Data API operations, and the Git transport. A credential that failed with a misleading API 404 successfully performed a standard fast-forward push.

**How to apply:** Clone the current remote branch into `/tmp`, copy only the intended task files into that clone, commit there, and push without force. This preserves remote-only history and avoids merging Replit checkpoint commits into GitHub.

## Canonical GitHub repository
Use `ctateo21/Havo-ai` as the canonical GitHub repository.

**Why:** GitHub permanently redirects the older `ctateo21/tateo-platform` location after the repository move.

**How to apply:** Use the canonical URL for future API calls, temporary clones, commit links, and repository syncs so permission errors and redirect ambiguity are easier to diagnose.
