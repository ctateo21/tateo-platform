import posthog from "posthog-js";

export type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

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

/** Send the same privacy-safe event to both analytics providers.
 * Analytics failures must never interrupt a user flow. */
export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    if (_initialized) posthog.capture(name, data);
  } catch {
    // Analytics must never break the app.
  }

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never break the app.
  }
}

export { posthog };
