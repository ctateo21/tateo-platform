// Central access-mode flag. The app is free to use with a free account —
// no Stripe checkout, payment method, or subscription is required for any
// logged-in user. This is intentionally hard-coded to true so that no
// environment variable can accidentally re-enable payments. The Stripe
// code stays in place; to restore paid mode in the future, change this
// constant back to an env-driven value.
export const FREE_ACCESS_MODE = true;

if (FREE_ACCESS_MODE && typeof window !== "undefined") {
}
