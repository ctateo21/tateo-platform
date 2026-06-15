// Central access-mode flag. While FREE_ACCESS_MODE is on, the app is free
// to use with a free account — no Stripe checkout, payment method, or
// subscription is required for any logged-in user. Stripe code stays in
// place and can be re-enabled later by setting VITE_FREE_ACCESS_MODE=false
// (and FREE_ACCESS_MODE=false on the server). Defaults to ON.
export const FREE_ACCESS_MODE =
  import.meta.env.VITE_FREE_ACCESS_MODE !== "false";

if (FREE_ACCESS_MODE && typeof window !== "undefined") {
  console.log("[access-mode] free access mode enabled");
}
