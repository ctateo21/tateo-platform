---
name: Auth & password reset (Supabase)
description: How Havo auth/forgot-password works and the Supabase config it depends on
---

Auth is 100% Supabase Auth. Passwords are NEVER stored in any public table — no
`password`/`saved_password` column exists or should ever be added. The `profiles`
table holds only account metadata (name, email, phone, agent, invited_user).

Login identifier is always email (no usernames). "Save password" is just the
browser/OS password manager: forms rely on `name` + `autoComplete` attributes
(login email = `autoComplete="username"`, password = `current-password`, signup
password fields = `new-password`). There is no custom "remember password" storage.

**Forgot/reset flow:** `requestPasswordReset` calls
`supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" })`
and always returns a generic success (anti-enumeration). The `/reset-password`
page (public route, outside ToolGate/ProtectedRoute) relies on the Supabase
client's `detectSessionInUrl: true` to exchange the recovery token for a session,
then calls `completePasswordReset` → `supabase.auth.updateUser({ password })`.

**Why / gotcha:** the reset email link only works if the redirect origin is on the
Supabase project's **Auth → URL Configuration** allowlist (Site URL + Redirect
URLs). Forgetting to add the prod/staging origin makes reset links silently fail.
**How to apply:** whenever the deployed domain changes, add `<origin>/reset-password`
(and the site URL) to that allowlist.
