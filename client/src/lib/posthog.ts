import posthog from "posthog-js";

let _initialized = false;

export function initPosthog() {
  if (_initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) {
    if (import.meta.env.DEV) {
      console.debug("[posthog] VITE_POSTHOG_KEY not set — analytics disabled");
    }
    return;
  }
  try {
    posthog.init(key, {
      api_host: "https://us.i.posthog.com",
      capture_pageview: true,
      person_profiles: "identified_only",
    });
    _initialized = true;
  } catch (err) {
    console.warn("[posthog] init failed", err);
  }
}

export { posthog };
