// Minimal fetch-based Stripe client for the Havo Pro subscription.
//
// We use raw fetch (no SDK) because the subscription checkout relies on
// Stripe Managed Payments, which currently requires the preview API
// version header `Stripe-Version: 2026-02-25.preview`. All money-moving
// calls go through here; the secret key never reaches the frontend.

const STRIPE_API = "https://api.stripe.com/v1";
const PREVIEW_VERSION = "2026-02-25.preview";

// Idempotency anchor for the single Havo Pro price. We look the price up
// by this key before creating it, so re-running on a fresh boot reuses
// the existing product/price instead of duplicating it.
const PRICE_LOOKUP_KEY = "havo_pro_monthly";
const PRODUCT_NAME = "Havo Pro";
const PRODUCT_DESCRIPTION = "Full access to Havo's real estate tools.";
const PRICE_UNIT_AMOUNT = 2000; // $20.00 in cents
const PRICE_CURRENCY = "usd";
// SaaS / general digital service tax code.
const TAX_CODE = "txcd_10103100";

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return key;
}

// Stripe expects form-encoded bodies with PHP-style nested keys. Arrays of
// objects use indexed brackets (line_items[0][price]); arrays of
// primitives use empty brackets (expand[], lookup_keys[]).
function encodeForm(
  obj: Record<string, any>,
  form: URLSearchParams = new URLSearchParams(),
  prefix = "",
): URLSearchParams {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === "object") {
          encodeForm(item, form, `${fullKey}[${i}]`);
        } else {
          form.append(`${fullKey}[]`, String(item));
        }
      });
    } else if (typeof value === "object") {
      encodeForm(value, form, fullKey);
    } else {
      form.append(fullKey, String(value));
    }
  }
  return form;
}

interface StripeRequestOptions {
  preview?: boolean;
}

async function stripeRequest(
  path: string,
  method: "GET" | "POST",
  params?: Record<string, any> | null,
  opts: StripeRequestOptions = {},
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey()}`,
  };
  if (opts.preview) headers["Stripe-Version"] = PREVIEW_VERSION;

  let url = `${STRIPE_API}${path}`;
  let body: string | undefined;

  if (method === "GET") {
    if (params) {
      const qs = encodeForm(params).toString();
      if (qs) url += `?${qs}`;
    }
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = encodeForm(params ?? {}).toString();
  }

  const res = await fetch(url, { method, headers, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    const msg = json?.error?.message || json?.error?.type || `HTTP ${res.status}`;
    throw new Error(`Stripe ${method} ${path}: ${msg}`);
  }
  return json;
}

// ── Price ────────────────────────────────────────────────────────────
let cachedPriceId: string | null = null;

export async function ensureHavoProPriceId(): Promise<string> {
  if (cachedPriceId) return cachedPriceId;

  // Look up an existing active price by lookup_key (idempotent).
  const list = await stripeRequest(
    "/prices",
    "GET",
    { lookup_keys: [PRICE_LOOKUP_KEY], active: true, limit: 1 },
  );
  if (Array.isArray(list?.data) && list.data.length > 0) {
    cachedPriceId = list.data[0].id as string;
    return cachedPriceId;
  }

  // Create the product, then the recurring monthly price with the
  // lookup_key so subsequent boots find it.
  const product = await stripeRequest("/products", "POST", {
    name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    tax_code: TAX_CODE,
  });
  const price = await stripeRequest("/prices", "POST", {
    product: product.id,
    unit_amount: PRICE_UNIT_AMOUNT,
    currency: PRICE_CURRENCY,
    recurring: { interval: "month" },
    lookup_key: PRICE_LOOKUP_KEY,
  });
  cachedPriceId = price.id as string;
  return cachedPriceId;
}

// ── Checkout ─────────────────────────────────────────────────────────
export interface CreateCheckoutArgs {
  userId: string;
  email?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export async function createSubscriptionCheckout(
  args: CreateCheckoutArgs,
): Promise<{ url: string; sessionId: string }> {
  const priceId = await ensureHavoProPriceId();
  const params: Record<string, any> = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    managed_payments: { enabled: true },
    client_reference_id: args.userId,
    metadata: { userId: args.userId },
    subscription_data: { metadata: { userId: args.userId } },
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  };
  if (args.email) params.customer_email = args.email;

  const session = await stripeRequest(
    "/checkout/sessions",
    "POST",
    params,
    { preview: true },
  );
  return { url: session.url as string, sessionId: session.id as string };
}

export async function retrieveCheckoutSession(sessionId: string): Promise<any> {
  return stripeRequest(
    `/checkout/sessions/${sessionId}`,
    "GET",
    { expand: ["subscription", "customer"] },
    { preview: true },
  );
}

// ── Subscription ─────────────────────────────────────────────────────
export interface SubscriptionSnapshot {
  status: string;
  currentPeriodEnd: number | null; // unix seconds
}

export async function getSubscriptionStatus(
  subscriptionId: string,
): Promise<SubscriptionSnapshot> {
  const sub = await stripeRequest(
    `/subscriptions/${subscriptionId}`,
    "GET",
    null,
    { preview: true },
  );
  return {
    status: sub.status as string,
    currentPeriodEnd:
      typeof sub.current_period_end === "number" ? sub.current_period_end : null,
  };
}

export function isActiveStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}
