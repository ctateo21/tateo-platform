---
name: GitHub workflow publishing permissions
description: Permission constraint when publishing files under .github/workflows.
---

The installed GitHub connector's repository access is not sufficient to create
or update files in `.github/workflows`; GitHub rejects those API writes even
when other repository and Actions-secret operations work. Use a classic GitHub
personal access token with both `repo` and `workflow` scopes when publishing
workflow files.

**Why:** GitHub separately guards workflow-file changes so an OAuth
authorization with ordinary repository access cannot introduce automation.

**How to apply:** Store the token only in Replit Secrets, never print it or
commit it. Use it solely for GitHub API or Git operations that add, edit, or
remove workflow definitions.