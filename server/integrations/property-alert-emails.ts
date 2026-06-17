// ============================================================================
// Property alert emails — sends rate/price-drop notifications to (a) the
// subscribed user and (b) my Follow Up Boss inbound-email address so a
// new lead/activity is created in FUB the moment the alert fires.
// ============================================================================
// Provider: Resend (https://resend.com). Pick because the user already has
// FOLLOWUPBOSS_API_KEY but nothing for email; Resend has the smallest setup.
//
// Required env vars (server-side only):
//   RESEND_API_KEY     — Resend API key
//   ALERT_FROM_EMAIL   — "from" address (must be on a Resend-verified domain)
//   FUB_ALERT_EMAIL    — Follow Up Boss inbound/lead-parsing email address
//
// Each helper is best-effort: failures are caught, logged on the event row,
// and *never* throw — the calling check job must keep processing.
// ============================================================================

import { Resend } from "resend";
import { supabaseAdmin } from "../supabase";

type SendStatus = "sent" | "failed" | "skipped";

interface SubscriptionLike {
  id: string;
  user_id: string;
  scenario_id: string;
  scenario_type: string;
  alert_type: "rate_drop" | "price_drop";
  property_address: string | null;
  target_rate: number | null;
  loan_type: string | null;
  occupancy_type: string | null;
  credit_score: number | null;
}

interface AlertEventLike {
  id: string;
  event_type: "rate_drop" | "price_drop";
  property_address: string | null;
  old_value: number | null;
  new_value: number | null;
}

interface UserContact {
  email: string | null;
  name: string | null;
  phone: string | null;
}

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

/** Fetch the user's name/email/phone for personalizing the alert. Falls
 *  back to auth.users.email when there's no profile row yet. */
export async function loadUserContact(userId: string): Promise<UserContact> {
  if (!supabaseAdmin) return { email: null, name: null, phone: null };
  let email: string | null = null;
  let name: string | null = null;
  let phone: string | null = null;

  try {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("name, email, phone")
      .eq("id", userId)
      .maybeSingle();
    if (prof) {
      email = prof.email ?? null;
      name = prof.name ?? null;
      phone = prof.phone ?? null;
    }
  } catch (e: any) {
    console.warn("[alert-emails] profile lookup failed:", e?.message);
  }

  if (!email) {
    try {
      const { data: au } = await supabaseAdmin.auth.admin.getUserById(userId);
      email = au?.user?.email ?? null;
    } catch (e: any) {
      console.warn("[alert-emails] auth.admin lookup failed:", e?.message);
    }
  }
  return { email, name, phone };
}

const SCENARIO_LABEL: Record<string, string> = {
  purchase: "Purchase",
  refinance: "Refinance",
  cash_buy: "Cash Buy",
  seller: "For Sale",
};

function esc(s: string | number | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtRate(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(3)}%`;
}

function buildUserEmail(
  evt: AlertEventLike, sub: SubscriptionLike, user: UserContact,
): { subject: string; html: string; text: string } {
  const address = evt.property_address ?? sub.property_address ?? "your saved property";
  const greeting = user.name ? `Hi ${user.name.split(" ")[0]},` : "Hi there,";

  if (evt.event_type === "rate_drop") {
    const subject = `Rate Alert: ${address} hit ${fmtRate(evt.new_value)}`;
    const reason =
      sub.target_rate != null
        ? `the market rate dropped to ${fmtRate(evt.new_value)}, at or below your ${fmtRate(sub.target_rate)} target.`
        : `the market rate moved to ${fmtRate(evt.new_value)}.`;
    const text =
      `${greeting}\n\n` +
      `Good news on ${address} — ${reason}\n\n` +
      `Open your saved estimate to see how this changes your monthly payment, ` +
      `then chat with our team if you'd like to lock or refinance.\n\n` +
      `— Havo\n\n` +
      `Note: live rates change throughout the day and depend on credit, loan ` +
      `program, and property details. Please verify the final rate before locking.`;
    const html =
      `<p>${esc(greeting)}</p>` +
      `<p>Good news on <strong>${esc(address)}</strong> — ${esc(reason)}</p>` +
      `<p>Open your saved estimate to see how this changes your monthly payment, ` +
      `then chat with our team if you'd like to lock or refinance.</p>` +
      `<p>— Havo</p>` +
      `<p style="color:#666;font-size:12px">Live rates change throughout the day ` +
      `and depend on credit, loan program, and property details. Please verify the ` +
      `final rate before locking.</p>`;
    return { subject, html, text };
  }

  // price_drop
  const subject = `Price Drop Alert: ${address} dropped to ${fmtMoney(evt.new_value)}`;
  const reason =
    evt.old_value != null && evt.new_value != null
      ? `the listing price dropped from ${fmtMoney(evt.old_value)} to ${fmtMoney(evt.new_value)}.`
      : `the listing price changed.`;
  const text =
    `${greeting}\n\n` +
    `Heads up on ${address} — ${reason}\n\n` +
    `Open your saved property to revisit your numbers or run a fresh estimate.\n\n` +
    `— Havo\n\n` +
    `Note: listing prices change frequently and our cache may lag the MLS by up ` +
    `to a day. Please verify the current asking price before acting.`;
  const html =
    `<p>${esc(greeting)}</p>` +
    `<p>Heads up on <strong>${esc(address)}</strong> — ${esc(reason)}</p>` +
    `<p>Open your saved property to revisit your numbers or run a fresh estimate.</p>` +
    `<p>— Havo</p>` +
    `<p style="color:#666;font-size:12px">Listing prices change frequently and our ` +
    `cache may lag the MLS by up to a day. Please verify the current asking price ` +
    `before acting.</p>`;
  return { subject, html, text };
}

function buildFubEmail(
  evt: AlertEventLike, sub: SubscriptionLike, user: UserContact,
): { subject: string; html: string; text: string } {
  const address = evt.property_address ?? sub.property_address ?? "(no address)";
  const who = user.name || user.email || "Unknown user";
  const scenarioLabel = SCENARIO_LABEL[sub.scenario_type] ?? sub.scenario_type;
  const alertTypeLabel = evt.event_type === "rate_drop" ? "Rate Drop" : "Price Drop";

  const subject =
    evt.event_type === "rate_drop"
      ? `Rate Alert from ${who} / ${address}`
      : `Price Drop Alert from ${who} / ${address}`;

  const lines: Array<[string, string]> = [
    ["User name", user.name || ""],
    ["User email", user.email || ""],
    ["User phone", user.phone || ""],
    ["Property address", address],
    ["Scenario type", scenarioLabel],
    ["Alert type", alertTypeLabel],
  ];
  if (evt.event_type === "rate_drop") {
    lines.push(["Target rate", fmtRate(sub.target_rate)]);
    lines.push(["Current rate", fmtRate(evt.new_value)]);
  } else {
    lines.push(["Prior price", fmtMoney(evt.old_value)]);
    lines.push(["New price", fmtMoney(evt.new_value)]);
  }
  lines.push(["Loan type", sub.loan_type || ""]);
  lines.push(["Credit score", sub.credit_score != null ? String(sub.credit_score) : ""]);
  lines.push(["Occupancy / use", sub.occupancy_type || ""]);
  lines.push(["Time triggered", new Date().toISOString()]);

  const text = lines.map(([k, v]) => `${k}: ${v || "(n/a)"}`).join("\n");
  const html =
    `<h3>${esc(alertTypeLabel)} — ${esc(address)}</h3>` +
    `<table cellpadding="4" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">` +
    lines
      .map(
        ([k, v]) =>
          `<tr><td style="color:#666;padding-right:12px;vertical-align:top"><strong>${esc(k)}</strong></td>` +
          `<td>${esc(v || "(n/a)")}</td></tr>`,
      )
      .join("") +
    `</table>`;
  return { subject, html, text };
}

// Verified Resend sending identity. ALERT_FROM_EMAIL should be set to this, but
// we also default to it so emails never fall back to an unverified domain.
const DEFAULT_FROM = "Havo Showing Alerts <alerts@updates.tateoco.com>";

async function sendOne(args: {
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
}): Promise<{ status: SendStatus; error: string | null; to: string; from: string }> {
  const from = process.env.ALERT_FROM_EMAIL || DEFAULT_FROM;
  const resend = getResend();
  if (!resend) return { status: "skipped", error: "RESEND_API_KEY not set", to: args.to, from };
  try {
    const payload: Record<string, unknown> = {
      from, to: args.to, subject: args.subject, html: args.html, text: args.text,
    };
    if (args.replyTo) payload.reply_to = args.replyTo;
    const { error } = await resend.emails.send(payload as any);
    if (error) return { status: "failed", error: error.message || String(error), to: args.to, from };
    return { status: "sent", error: null, to: args.to, from };
  } catch (e: any) {
    return { status: "failed", error: e?.message ?? String(e), to: args.to, from };
  }
}

/** Send user + FUB alert emails and update the event row with the outcome.
 *  Never throws — failures are recorded on the event so a future retry
 *  worker can pick them up. */
export async function sendPropertyAlertEmails(
  event: AlertEventLike,
  subscription: SubscriptionLike,
  user: UserContact,
): Promise<{ userStatus: SendStatus; fubStatus: SendStatus }> {
  if (!supabaseAdmin) return { userStatus: "skipped", fubStatus: "skipped" };
  const fubAddress = process.env.FUB_ALERT_EMAIL || null;

  // --- User email -----------------------------------------------------------
  let userResult: { status: SendStatus; error: string | null } =
    { status: "skipped", error: "no user email on file" };
  if (user.email) {
    const u = buildUserEmail(event, subscription, user);
    userResult = await sendOne({
      to: user.email,
      subject: u.subject, html: u.html, text: u.text,
    });
  }

  // --- FUB email ------------------------------------------------------------
  let fubResult: { status: SendStatus; error: string | null } =
    { status: "skipped", error: "FUB_ALERT_EMAIL not set" };
  if (fubAddress) {
    const f = buildFubEmail(event, subscription, user);
    fubResult = await sendOne({
      to: fubAddress,
      replyTo: user.email || undefined,
      subject: f.subject, html: f.html, text: f.text,
    });
  }

  const nowIso = new Date().toISOString();
  const overallStatus: "sent" | "failed" | "pending" =
    userResult.status === "sent" || fubResult.status === "sent"
      ? "sent"
      : userResult.status === "failed" || fubResult.status === "failed"
        ? "failed"
        : "pending"; // both skipped

  try {
    await supabaseAdmin
      .from("property_alert_events")
      .update({
        user_email: user.email,
        fub_email: fubAddress,
        user_email_status: userResult.status,
        fub_email_status: fubResult.status,
        user_email_sent_at: userResult.status === "sent" ? nowIso : null,
        fub_email_sent_at: fubResult.status === "sent" ? nowIso : null,
        email_error_message: userResult.error,
        fub_error_message: fubResult.error,
        status: overallStatus,
        sent_at: overallStatus === "sent" ? nowIso : null,
      })
      .eq("id", event.id);
  } catch (e: any) {
    console.warn("[alert-emails] event status update failed:", e?.message);
  }

  return { userStatus: userResult.status, fubStatus: fubResult.status };
}

// ============================================================================
// Transactional emails — account welcome + internal new-scenario alert.
// Both reuse the same Resend pattern (getResend + sendOne) and are best-effort:
// they return a SendStatus and never throw, so callers can fire-and-forget
// with .catch() without ever crashing the main request flow.
// ============================================================================

const HAVO_NAVY = "#13294b";

/** Sent when a new account is created. Best-effort — never throws. */
export async function sendWelcomeEmail(args: {
  to: string;
  firstName?: string;
}): Promise<{ status: SendStatus; error: string | null }> {
  if (!args.to) return { status: "skipped", error: "no recipient" };

  const dashboardUrl = `${process.env.APP_URL ?? ""}/dashboard`;
  const name = args.firstName?.trim();
  const heading = name ? `Welcome, ${name}!` : "Welcome!";
  const subject = "Welcome to Havo — you're all set";

  const text =
    `${heading}\n\n` +
    `Your account is ready. Any scenario you saved is waiting in your dashboard.\n\n` +
    `Go to My Dashboard: ${dashboardUrl}\n\n` +
    `Havo · Every Step Home · Tateo Insurance Corp · License #L132640`;

  const html =
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">` +
    `<p style="font-size:22px;font-weight:bold;color:${HAVO_NAVY};margin:0 0 16px">Havo</p>` +
    `<h1 style="font-size:20px;color:${HAVO_NAVY};margin:0 0 12px">${esc(heading)}</h1>` +
    `<p style="font-size:15px;color:#333;line-height:1.5;margin:0 0 24px">` +
    `Your account is ready. Any scenario you saved is waiting in your dashboard.</p>` +
    `<p style="margin:0 0 28px">` +
    `<a href="${esc(dashboardUrl)}" style="display:inline-block;background:${HAVO_NAVY};` +
    `color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;` +
    `padding:12px 24px;border-radius:6px">Go to My Dashboard</a></p>` +
    `<p style="font-size:12px;color:#888;margin:0">Havo · Every Step Home · ` +
    `Tateo Insurance Corp · License #L132640</p>` +
    `</div>`;

  return sendOne({ to: args.to, subject, html, text });
}

/** Sent to the internal team whenever any scenario is saved. Best-effort.
 *  When `contact` is provided (e.g. showing requests) a Name/Email/Phone block
 *  is rendered near the top so the team always has full contact details. */
export async function sendInternalAlert(args: {
  scenarioType: string;
  userEmail: string;
  address: string;
  summary: string;
  contact?: { name?: string; email?: string; phone?: string };
}): Promise<{ status: SendStatus; error: string | null; to: string; from: string }> {
  // Recipient for internal team alerts. Prefer a dedicated INTERNAL_ALERT_EMAIL,
  // then the Follow Up Boss lead inbox, then fall back to the verified sender
  // address (always set when email is configured) so these alerts are never
  // silently dropped just because the dedicated var was never set.
  const to =
    process.env.INTERNAL_ALERT_EMAIL ||
    process.env.FUB_ALERT_EMAIL ||
    process.env.ALERT_FROM_EMAIL;
  if (!to) {
    return {
      status: "skipped",
      error: "Missing internal alert recipient email",
      to: "",
      from: process.env.ALERT_FROM_EMAIL || DEFAULT_FROM,
    };
  }

  const subject = `New ${args.scenarioType} — ${args.address}`;
  const fubSearchUrl =
    `https://app.followupboss.com/2/people?q=${encodeURIComponent(args.contact?.email || args.userEmail)}`;

  // Contact block (Name/Email/Phone) — only when caller supplies contact info,
  // so existing scenario-save alerts keep their original layout.
  const c = args.contact;
  const contactText = c
    ? `Contact:\n` +
      `Name: ${c.name?.trim() || "Not provided"}\n` +
      `Email: ${c.email?.trim() || args.userEmail || "Not provided"}\n` +
      `Phone: ${c.phone?.trim() || "Not provided"}\n\n`
    : "";
  const contactHtml = c
    ? `<p style="margin:0 0 4px"><strong>Contact:</strong></p>` +
      `<p style="margin:0 0 2px">Name: ${esc(c.name?.trim() || "Not provided")}</p>` +
      `<p style="margin:0 0 2px">Email: ${esc(c.email?.trim() || args.userEmail || "Not provided")}</p>` +
      `<p style="margin:0 0 12px">Phone: ${esc(c.phone?.trim() || "Not provided")}</p>`
    : "";

  const text =
    contactText +
    `User: ${args.userEmail}\n` +
    `Type: ${args.scenarioType}\n` +
    `Property: ${args.address}\n` +
    `Summary: ${args.summary}\n\n` +
    `Find contact in Follow Up Boss: ${fubSearchUrl}`;

  const html =
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">` +
    contactHtml +
    `<p><strong>User:</strong> ${esc(args.userEmail)}</p>` +
    `<p><strong>Type:</strong> ${esc(args.scenarioType)}</p>` +
    `<p><strong>Property:</strong> ${esc(args.address)}</p>` +
    `<p><strong>Summary:</strong> ${esc(args.summary)}</p>` +
    `<p><a href="${esc(fubSearchUrl)}">Find this contact in Follow Up Boss</a></p>` +
    `</div>`;

  return sendOne({ to, subject, html, text });
}
