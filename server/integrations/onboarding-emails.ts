// ============================================================================
// Onboarding drip campaign (onboarding_v1) — 5-email sequence sent after a
// user creates a Havo account.
//
// Step 1 (immediate welcome) is already sent at signup by sendWelcomeEmail
// in property-alert-emails.ts; this module handles steps 2–5 only:
//   Step 2 — Day 3   · real monthly payment
//   Step 3 — Day 7   · buying vs renting
//   Step 4 — Day 14  · schedule a showing
//   Step 5 — Day 30  · market snapshot / talk to an agent
//
// Provider: Resend, same pattern as property-alert-emails.ts. Best-effort:
// every function catches and logs, never throws.
//
// Scheduling: setTimeout per step at signup, PLUS a catch-up pass on server
// start (resumeOnboardingCampaigns) that re-schedules pending steps for
// users created in the last 31 days — a plain setTimeout would otherwise be
// lost on restart and the emails would silently never send. The
// email_campaign_log table in Supabase is the source of truth for what was
// already sent, so overlapping schedules can never double-send.
// ============================================================================

import { Resend } from "resend";
import { supabaseAdmin } from "../supabase";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

const HAVO_NAVY = "#13294b";
const APP_URL = process.env.APP_URL ?? "https://havofl.com";
const CAMPAIGN_ID = "onboarding_v1";
const REPLY_TO = "christian@havo.com";

// {{UNSUB_URL}} is replaced with a per-user unsubscribe link at send time.
const FOOTER_HTML = `
        <p style="font-size:12px;color:#888;margin:0">
          Havo · Every Step Home ·
          Tateo Insurance Corp ·
          License #L132640<br/>
          Tampa Bay, Florida ·
          <a href="{{UNSUB_URL}}" style="color:#888">Unsubscribe</a>
        </p>`;

function ctaHtml(label: string): string {
  return `
        <p style="margin:0 0 28px">
          <a href="${APP_URL}/estimate"
            style="display:inline-block;background:${HAVO_NAVY};color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 24px;border-radius:6px">
            ${label} →
          </a>
        </p>`;
}

function wrapHtml(inner: string): string {
  return `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
        <p style="font-size:22px;font-weight:bold;color:${HAVO_NAVY};margin:0 0 16px">Havo</p>
${inner}
${FOOTER_HTML}
      </div>`;
}

interface CampaignStep {
  stepNumber: number;
  delayMs: number; // delay after signup
  subject: (name: string) => string;
  html: (name: string) => string;
  text: (name: string) => string;
}

const DAY = 24 * 60 * 60 * 1000;

const STEPS: CampaignStep[] = [
  // Step 2 — Day 3
  {
    stepNumber: 2,
    delayMs: 3 * DAY,
    subject: (n) => `${n ? n + ", see" : "See"} what your real monthly payment looks like`,
    html: (n) => wrapHtml(`
        <h1 style="font-size:20px;color:${HAVO_NAVY};margin:0 0 12px">
          ${n ? `${n}, beyond` : "Beyond"} the listing price
        </h1>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 16px">
          Most buyers focus on the sale price. But the number that actually
          matters is your real monthly payment — principal, interest,
          property taxes, insurance, HOA, and CDD fees all rolled together.
        </p>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px">
          Havo calculates all of it for any Florida home, in seconds, with
          no login required.
        </p>
${ctaHtml("Run a home estimate")}`),
    text: (n) =>
      `${n ? n + ", beyond" : "Beyond"} the listing price\n\n` +
      `Most buyers focus on the sale price. But the number ` +
      `that actually matters is your real monthly payment — ` +
      `principal, interest, taxes, insurance, HOA, and CDD ` +
      `fees combined.\n\n` +
      `Run a home estimate: ${APP_URL}/estimate\n\n` +
      `Havo · Every Step Home`,
  },

  // Step 3 — Day 7
  {
    stepNumber: 3,
    delayMs: 7 * DAY,
    subject: () => `Buying vs. renting in Tampa Bay right now`,
    html: () => wrapHtml(`
        <h1 style="font-size:20px;color:${HAVO_NAVY};margin:0 0 12px">
          Is buying smarter than renting right now?
        </h1>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 16px">
          In Tampa Bay, rents have climbed steadily while mortgage rates have
          started to settle. For many buyers, ownership now costs the same —
          or less — than renting a comparable home.
        </p>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 16px">
          The real question isn't whether to buy. It's whether you know your
          actual number — and whether that number works for your life.
        </p>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px">
          Havo shows you both scenarios side by side, for any home, in any
          Florida market.
        </p>
${ctaHtml("See your number")}`),
    text: () =>
      `Is buying smarter than renting right now?\n\n` +
      `In Tampa Bay, rents have climbed while mortgage rates ` +
      `have started to settle. For many buyers, ownership now ` +
      `costs the same or less than renting a comparable home.\n\n` +
      `See your number: ${APP_URL}/estimate\n\n` +
      `Havo · Every Step Home`,
  },

  // Step 4 — Day 14
  {
    stepNumber: 4,
    delayMs: 14 * DAY,
    subject: () => `Found a home you like? Schedule a showing through Havo`,
    html: () => wrapHtml(`
        <h1 style="font-size:20px;color:${HAVO_NAVY};margin:0 0 12px">
          Ready to see it in person?
        </h1>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 16px">
          When you find a home worth a closer look, you shouldn't have to
          chase down an agent or navigate another app. Havo connects you
          directly to a Tateo &amp; Co. agent who knows Tampa Bay, St. Pete,
          and Sarasota — and can get you in the door fast.
        </p>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px">
          One conversation. Every home solution.
        </p>
${ctaHtml("Schedule a showing")}`),
    text: () =>
      `Ready to see it in person?\n\n` +
      `Havo connects you directly to a Tateo & Co. agent ` +
      `who knows Tampa Bay, St. Pete, and Sarasota.\n\n` +
      `Schedule a showing: ${APP_URL}/estimate\n\n` +
      `Havo · Every Step Home`,
  },

  // Step 5 — Day 30
  {
    stepNumber: 5,
    delayMs: 30 * DAY,
    subject: (n) => `${n ? n + " — a" : "A"} quick Tampa Bay market snapshot`,
    html: () => wrapHtml(`
        <h1 style="font-size:20px;color:${HAVO_NAVY};margin:0 0 12px">
          Where things stand in Tampa Bay
        </h1>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 16px">
          The Tampa Bay market keeps moving. Inventory is shifting, insurance
          costs are changing, and rate locks matter more than ever. If you're
          still looking, now might be the right time to have a real
          conversation.
        </p>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 16px">
          Christian Tateo at Tateo &amp; Co. is your single point of contact
          for real estate, mortgage, and insurance — no referral runaround,
          no handoffs.
        </p>
${ctaHtml("Talk to an agent")}`),
    text: () =>
      `Where things stand in Tampa Bay\n\n` +
      `Inventory is shifting, insurance costs are changing, ` +
      `and rate locks matter more than ever. If you're still ` +
      `looking, let's talk.\n\n` +
      `Christian Tateo · Tateo & Co.\n` +
      `Real estate, mortgage, and insurance —\n` +
      `one conversation, every home solution.\n\n` +
      `${APP_URL}/estimate\n\n` +
      `Havo · Every Step Home`,
  },
];

// ── Exported functions ──────────────────────────────────────────────────────

/**
 * Called once at account_created time. Schedules steps 2–5 with setTimeout
 * (step 1 is the welcome email sent directly at signup). If the server
 * restarts before a step fires, resumeOnboardingCampaigns() re-schedules it
 * on boot; the email_campaign_log check inside sendCampaignStep prevents
 * any double-send.
 */
export async function startOnboardingCampaign(args: {
  userId: string;
  email: string;
  firstName?: string;
  /** For resumed campaigns: ms already elapsed since signup. */
  elapsedMs?: number;
}): Promise<void> {
  // Internal team accounts never get the drip campaign.
  if (args.email.trim().toLowerCase().endsWith("@tateoco.com")) {
    console.log(`[onboarding] skipping internal account ${args.email}`);
    return;
  }
  const elapsed = Math.max(0, args.elapsedMs ?? 0);
  for (const step of STEPS) {
    const remaining = step.delayMs - elapsed;
    if (remaining <= 0 && args.elapsedMs === undefined) continue; // fresh signups always wait
    const timer = setTimeout(() => {
      void sendCampaignStep({ step, userId: args.userId, email: args.email, firstName: args.firstName });
    }, Math.max(remaining, 5_000));
    // Never keep the process alive just for a drip email.
    timer.unref?.();
  }
  console.log(`[onboarding] campaign scheduled for ${args.email}` + (elapsed ? ` (resumed, ${Math.round(elapsed / DAY)}d elapsed)` : ""));
}

/**
 * Server-start catch-up: re-schedules pending steps for accounts created in
 * the last 31 days. Overdue steps fire shortly after boot; already-sent
 * steps are skipped via email_campaign_log.
 */
export async function resumeOnboardingCampaigns(): Promise<void> {
  try {
    if (!supabaseAdmin) return;
    const cutoff = Date.now() - 31 * DAY;
    let page = 1;
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        const createdAt = Date.parse(u.created_at);
        if (!u.email || !Number.isFinite(createdAt) || createdAt < cutoff) continue;
        const name = String((u.user_metadata as any)?.name || "").trim().split(/\s+/)[0] || undefined;
        void startOnboardingCampaign({
          userId: u.id,
          email: u.email,
          firstName: name,
          elapsedMs: Date.now() - createdAt,
        });
      }
      if (data.users.length < 200) break;
      page += 1;
    }
  } catch (err: any) {
    console.error("[onboarding] resume failed:", err?.message);
  }
}

/**
 * Records an unsubscribe (suppression) marker: a step_number 0 row with
 * status 'unsubscribed'. All future sends for this campaign check it first.
 * Returns true when the user is (now) unsubscribed.
 */
export async function unsubscribeFromCampaign(userId: string, campaignId?: string): Promise<boolean> {
  try {
    if (!supabaseAdmin) return false;
    const { error } = await supabaseAdmin.from("email_campaign_log").insert({
      user_id: userId,
      email: "",
      campaign_id: campaignId || CAMPAIGN_ID,
      step_number: 0,
      status: "unsubscribed",
    });
    // 23505 = already unsubscribed — that's still success.
    if (error && error.code !== "23505") {
      console.error("[onboarding] unsubscribe insert failed:", error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[onboarding] unsubscribe failed:", err?.message);
    return false;
  }
}

/** Per-user unsubscribe link (also used as the List-Unsubscribe target). */
export function unsubscribeUrlFor(userId: string, campaignId: string = CAMPAIGN_ID): string {
  return `${APP_URL}/api/email/unsubscribe?uid=${encodeURIComponent(userId)}&cid=${encodeURIComponent(campaignId)}`;
}

/**
 * Shared suppression check for ALL marketing-style emails (drip steps,
 * welcome email, property alerts). Returns:
 *   true  — user unsubscribed, do NOT send
 *   false — no suppression row, ok to send
 *   null  — could not verify (query error / no supabase) → treat as do NOT send
 */
export async function isUnsubscribed(
  userId: string,
  campaignId: string = CAMPAIGN_ID,
): Promise<boolean | null> {
  try {
    if (!supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin
      .from("email_campaign_log")
      .select("id")
      .eq("user_id", userId)
      .eq("campaign_id", campaignId)
      .eq("status", "unsubscribed")
      .limit(1);
    if (error) {
      console.error("[email] unsubscribe check failed:", error.message);
      return null;
    }
    return (data?.length ?? 0) > 0;
  } catch (err: any) {
    console.error("[email] unsubscribe check error:", err?.message);
    return null;
  }
}

async function sendCampaignStep(args: {
  step: CampaignStep;
  userId: string;
  email: string;
  firstName?: string;
}): Promise<void> {
  const { step, userId, email, firstName } = args;
  const name = firstName?.trim() ?? "";

  try {
    if (!supabaseAdmin) return;

    const resend = getResend();
    if (!resend) {
      console.warn("[onboarding] RESEND_API_KEY not set");
      return;
    }
    const from = process.env.ALERT_FROM_EMAIL;
    if (!from) {
      console.warn("[onboarding] ALERT_FROM_EMAIL not set");
      return;
    }

    // Unsubscribed? (step_number 0 row with status 'unsubscribed' is the
    // suppression marker written by /api/email/unsubscribe). Any query
    // error is treated as "can't verify" → do NOT send.
    const unsub = await isUnsubscribed(userId);
    if (unsub !== false) {
      console.log(`[onboarding] ${email} ${unsub === true ? "unsubscribed" : "unsub check failed"} — skip step ${step.stepNumber}`);
      return;
    }

    // Atomic claim: INSERT into a table with a UNIQUE index on
    // (user_id, campaign_id, step_number). Exactly one concurrent
    // scheduler (signup timer, boot resume, second server process) wins;
    // the losers get a unique-violation and skip. Claiming BEFORE the send
    // also means a crash mid-send can never double-send. Any other insert
    // error (missing table, etc.) is treated as failure — never send.
    const { error: insertError } = await supabaseAdmin.from("email_campaign_log").insert({
      user_id: userId,
      email,
      campaign_id: CAMPAIGN_ID,
      step_number: step.stepNumber,
      status: "sending",
    });
    if (insertError) {
      if (insertError.code === "23505") {
        console.log(`[onboarding] step ${step.stepNumber} already claimed for ${email} — skip`);
      } else {
        console.error(`[onboarding] step ${step.stepNumber} log insert failed:`, insertError.message);
      }
      return;
    }

    const unsubUrl = unsubscribeUrlFor(userId);
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: step.subject(name),
      html: step.html(name).replaceAll("{{UNSUB_URL}}", unsubUrl),
      text: step.text(name) + `\n\nUnsubscribe: ${unsubUrl}`,
      replyTo: REPLY_TO,
      headers: {
        "List-Unsubscribe": `<${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    } as any);

    await supabaseAdmin
      .from("email_campaign_log")
      .update({ status: error ? "failed" : "sent" })
      .eq("user_id", userId)
      .eq("campaign_id", CAMPAIGN_ID)
      .eq("step_number", step.stepNumber);

    if (error) {
      console.error(`[onboarding] step ${step.stepNumber} send error:`, error);
      return;
    }
    console.log(`[onboarding] step ${step.stepNumber} sent to ${email}`);
  } catch (err: any) {
    console.error(`[onboarding] step ${step.stepNumber} error:`, err?.message);
  }
}
