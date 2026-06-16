---
name: Link-share preview (Open Graph) gotcha
description: Why iMessage/social previews can show the wrong title/image even when index.html OG tags are correct.
---

# Link-share previews (iMessage, Slack, social unfurls)

Static OG/Twitter tags live in `client/index.html` (og:title, og:image → `https://havofl.com/havo-og-v1.png`, etc.). The OG image asset lives at `client/public/havo-og-v1.png` (Vite copies `public/` to the served root, so it resolves at `/havo-og-v1.png` in prod).

**Gotcha:** Apple's iMessage link-preview crawler EXECUTES JavaScript. So a per-page `react-helmet` `<title>`/meta override (e.g. the homepage) will hijack the share preview, overriding the branded static tags. Symptom seen: preview showed a stale per-page title with no logo while `index.html` was correct.

**How to apply:** Any page that is commonly shared (especially the homepage `/`) must keep its Helmet title/OG consistent with `index.html` — set og:title/og:description/og:image in that page's Helmet too, not just `<title>`. Don't let a page Helmet set a non-brand `<title>` alone.

**Also:** Apple caches previews per-URL for a long time. After fixing + republishing, an already-cached link may still show the old preview; test with a fresh URL (or a `?v=` query) to force a re-crawl. Production must be republished for any of these changes to reach havofl.com.
