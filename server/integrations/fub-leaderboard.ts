/**
 * fub-leaderboard.ts — FIXED v2
 *
 * Root bugs fixed vs v1:
 *   1. Events have `userId` (number), not `assignedTo.email`. Build fubIdToEmail
 *      reverse map and use ev.userId for attribution.
 *   2. People have `assignedUserId` (number), not `assignedTo.email`. Same fix.
 *   3. FUB events date filter is `since` (ISO string), not `created[gte]`.
 *   4. Pipeline stages reflect *current* state — removed date filter from people
 *      so pipeline always shows the live snapshot. Closed-this-period is counted
 *      via a dedicated stage=Closed people query filtered by updated date.
 */

const FUB_BASE = "https://api.followupboss.com/v1";

const _cache = new Map<string, { data: LeaderboardPayload; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Team ─────────────────────────────────────────────────────────────────────
export const LEADERBOARD_TEAM = [
  { email: "christian@tateoco.com", name: "Christian Tateo", initials: "CT", isAdmin: true  },
  { email: "omar@tateoco.com",      name: "Omar Andujar",    initials: "OA", isAdmin: false },
  { email: "kyle@tateoco.com",      name: "Kyle Schweinitz", initials: "KS", isAdmin: false },
  { email: "alex@tateoco.com",      name: "Alex",            initials: "AL", isAdmin: false },
] as const;

export type TeamEmail = typeof LEADERBOARD_TEAM[number]["email"];

// ── Pipeline stages ───────────────────────────────────────────────────────────
export const PIPELINE_STAGES = [
  "Lead",
  "Attempted Contact",
  "Spoke with Customer",
  "Appointment Set",
  "Met with Customer",
  "Showing Homes",
  "Listing Agreement",
  "Active Listing",
  "Submitting Offers",
  "Under Contract",
  "Nurture",
  "Closed",
  "Trash",
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AgentRow {
  email: string;
  name: string;
  initials: string;
  isAdmin: boolean;
  fubUserId: number | null;
  calls: number;
  texts: number;
  emails: number;
  showings: number;
  closedDeals: number;       // leads with stage=Closed, updated in period
  closedDealsAllTime: number;// leads with stage=Closed, any time (for reference)
  underContract: number;
  pipeline: Record<string, number>; // current live pipeline snapshot
  totalActivity: number;
}

export interface LeaderboardPayload {
  period: string;
  generatedAt: string;
  agents: AgentRow[];
  teamTotals: {
    calls: number;
    texts: number;
    emails: number;
    showings: number;
    closedDeals: number;
    underContract: number;
    totalActivity: number;
  };
}

export type Period = "today" | "week" | "month" | "quarter" | "year";

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function fubHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": "Basic " + Buffer.from(`${apiKey}:`).toString("base64"),
  };
}

async function fubGet(
  apiKey: string,
  path: string,
  params: Record<string, string> = {},
): Promise<any> {
  const url = new URL(`${FUB_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: fubHeaders(apiKey) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FUB ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Paginate any FUB list endpoint. Finds the first top-level array key that
 *  isn't `_metadata` and collects all pages. */
async function fetchAllPages(
  apiKey: string,
  path: string,
  params: Record<string, string> = {},
): Promise<any[]> {
  const LIMIT = 200;
  let offset = 0;
  const all: any[] = [];

  while (true) {
    const data = await fubGet(apiKey, path, {
      ...params,
      limit: String(LIMIT),
      offset: String(offset),
    });
    const key = Object.keys(data).find(
      (k) => k !== "_metadata" && Array.isArray(data[k]),
    );
    const items: any[] = key ? data[key] : [];
    all.push(...items);
    const total: number = data._metadata?.total ?? items.length;
    offset += LIMIT;
    if (offset >= total || items.length === 0) break;
  }

  return all;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function getPeriodDates(period: Period): { start: string; end: string } {
  const now = new Date();
  let start: Date;

  switch (period) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week": {
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Sunday
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  return { start: start.toISOString(), end: now.toISOString() };
}

// ── Main fetch ────────────────────────────────────────────────────────────────
export async function getLeaderboardData(
  apiKey: string,
  period: Period,
): Promise<LeaderboardPayload> {
  const cached = _cache.get(period);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[fub-lb] cache hit: ${period}`);
    return cached.data;
  }

  console.log(`[fub-lb] fetching fresh: ${period}`);
  const { start } = getPeriodDates(period);

  // ── Step 1: Resolve user IDs ─────────────────────────────────────────────
  // FIX: Build *both* maps so we can go id→email when reading events/people.
  const emailToFubId = new Map<string, number>(); // email → numeric FUB id
  const fubIdToEmail = new Map<number, string>(); // numeric FUB id → email  ← KEY FIX
  const fubNameToEmail = new Map<string, string>(); // "Christian Tateo" → email (fallback)

  try {
    const { users = [] } = await fubGet(apiKey, "/users");
    for (const u of users) {
      if (!u.email || !u.id) continue;
      const email = u.email.toLowerCase();
      const id = Number(u.id);
      emailToFubId.set(email, id);
      fubIdToEmail.set(id, email);          // ← the reverse map we were missing
      if (u.name) fubNameToEmail.set(u.name.toLowerCase(), email);
    }
    console.log(`[fub-lb] resolved ${fubIdToEmail.size} FUB users`);
  } catch (err: any) {
    console.error("[fub-lb] /users failed:", err.message);
  }

  // Helper: resolve the agent email from any FUB event or person object.
  // Events carry `userId` (number). People carry `assignedUserId` (number).
  // Fallback to name-string for people that predate the numeric field.
  function resolveEmail(obj: any): string | undefined {
    // ① Numeric userId (events)
    if (obj.userId != null) {
      const e = fubIdToEmail.get(Number(obj.userId));
      if (e) return e;
    }
    // ② Numeric assignedUserId (people)  ← FIX: was reading assignedTo.email which doesn't exist
    if (obj.assignedUserId != null) {
      const e = fubIdToEmail.get(Number(obj.assignedUserId));
      if (e) return e;
    }
    // ③ Name string fallback (people.assignedTo is sometimes a display name)
    if (typeof obj.assignedTo === "string" && obj.assignedTo) {
      const e = fubNameToEmail.get(obj.assignedTo.toLowerCase());
      if (e) return e;
    }
    return undefined;
  }

  // ── Step 2: Activity events (time-filtered by period) ─────────────────────
  // FIX: FUB events API uses `since` not `created[gte]`.
  // FUB event types: "Call", "Text Message", "Email", "Note", "Appointment"
  const EVENT_TYPE_MAP = [
    { fubType: "Call",         key: "calls"    },
    { fubType: "Text Message", key: "texts"    },
    { fubType: "Email",        key: "emails"   },
    { fubType: "Appointment",  key: "showings" },
  ] as const;

  type ActivityKey = typeof EVENT_TYPE_MAP[number]["key"];

  const activityCounts: Record<string, Record<ActivityKey, number>> = {};
  for (const m of LEADERBOARD_TEAM) {
    activityCounts[m.email] = { calls: 0, texts: 0, emails: 0, showings: 0 };
  }

  for (const { fubType, key } of EVENT_TYPE_MAP) {
    try {
      // FIX: use `since` (ISO string) — the correct FUB date filter param
      const events = await fetchAllPages(apiKey, "/events", {
        type:  fubType,
        since: start,     // ← was `created[gte]` which FUB ignores
      });

      let matched = 0;
      for (const ev of events) {
        // FIX: ev.userId (number) not ev.assignedTo?.email (doesn't exist on GET)
        const email = resolveEmail(ev);
        if (email && activityCounts[email]) {
          activityCounts[email][key]++;
          matched++;
        }
      }

      console.log(`[fub-lb] ${fubType}: ${events.length} events, ${matched} matched team`);
    } catch (err: any) {
      console.error(`[fub-lb] ${fubType} events error:`, err.message);
    }
  }

  // ── Step 3: Pipeline — current live snapshot (no date filter) ────────────
  // FIX: Pipeline stages on people reflect *current* state, not historical.
  // Removing the date filter so we see the real pipeline regardless of period.
  // "This month/quarter" pipeline = who's in the pipeline right now.
  const pipeline: Record<string, Record<string, number>> = {};
  for (const m of LEADERBOARD_TEAM) {
    pipeline[m.email] = {};
    for (const s of PIPELINE_STAGES) pipeline[m.email][s] = 0;
  }

  try {
    // Fetch all people — no date filter on pipeline (see FIX note above)
    const people = await fetchAllPages(apiKey, "/people", {
      sort:      "updated",
      direction: "desc",
    });

    let matched = 0;
    for (const person of people) {
      const stage = person.stage as string | undefined;
      // FIX: use assignedUserId (number) not assignedTo.email (wrong field)
      const email = resolveEmail(person);

      if (stage && email && pipeline[email] && pipeline[email][stage] !== undefined) {
        pipeline[email][stage]++;
        matched++;
      }
    }

    console.log(`[fub-lb] pipeline: ${people.length} people, ${matched} matched team`);
  } catch (err: any) {
    console.error("[fub-lb] people error:", err.message);
  }

  // ── Step 4: Closed-this-period count ─────────────────────────────────────
  // FIX: query people whose stage=Closed AND were updated within the period.
  // This gives "deals closed this week/month/quarter" as a true time-filtered number.
  const closedThisPeriod: Record<string, number> = {};
  const closedAllTime: Record<string, number>    = {};
  for (const m of LEADERBOARD_TEAM) {
    closedThisPeriod[m.email] = 0;
    closedAllTime[m.email]    = 0;
  }

  try {
    // All people currently staged as Closed
    const closedPeople = await fetchAllPages(apiKey, "/people", {
      stage: "Closed",
    });

    const startMs = new Date(start).getTime();

    for (const person of closedPeople) {
      const email = resolveEmail(person);
      if (!email || closedAllTime[email] === undefined) continue;
      closedAllTime[email]++;

      // Count as "closed this period" if the record was last updated in range
      const updatedAt = person.updated ? new Date(person.updated).getTime() : 0;
      if (email && updatedAt >= startMs && closedThisPeriod[email] !== undefined) {
        closedThisPeriod[email]++;
      }
    }

    console.log(`[fub-lb] closed all-time: ${closedPeople.length} leads`);
  } catch (err: any) {
    console.error("[fub-lb] closed people error:", err.message);
  }

  // ── Step 5: Build rows ────────────────────────────────────────────────────
  const agents: AgentRow[] = LEADERBOARD_TEAM.map((m) => {
    const a = activityCounts[m.email];
    const p = pipeline[m.email] ?? {};
    const totalActivity = a.calls + a.texts + a.emails;

    return {
      email:              m.email,
      name:               m.name,
      initials:           m.initials,
      isAdmin:            m.isAdmin,
      fubUserId:          emailToFubId.get(m.email) ?? null,
      calls:              a.calls,
      texts:              a.texts,
      emails:             a.emails,
      showings:           a.showings,
      closedDeals:        closedThisPeriod[m.email] ?? 0,
      closedDealsAllTime: closedAllTime[m.email]    ?? 0,
      underContract:      p["Under Contract"] ?? 0,
      pipeline:           p,
      totalActivity,
    };
  });

  agents.sort((a, b) =>
    b.totalActivity !== a.totalActivity
      ? b.totalActivity - a.totalActivity
      : b.closedDeals - a.closedDeals,
  );

  const teamTotals = {
    calls:         agents.reduce((s, r) => s + r.calls, 0),
    texts:         agents.reduce((s, r) => s + r.texts, 0),
    emails:        agents.reduce((s, r) => s + r.emails, 0),
    showings:      agents.reduce((s, r) => s + r.showings, 0),
    closedDeals:   agents.reduce((s, r) => s + r.closedDeals, 0),
    underContract: agents.reduce((s, r) => s + r.underContract, 0),
    totalActivity: agents.reduce((s, r) => s + r.totalActivity, 0),
  };

  const payload: LeaderboardPayload = {
    period,
    generatedAt: new Date().toISOString(),
    agents,
    teamTotals,
  };

  _cache.set(period, { data: payload, ts: Date.now() });
  return payload;
}

export function bustLeaderboardCache(period?: Period): void {
  if (period) _cache.delete(period);
  else _cache.clear();
}