/**
 * fub-leaderboard.ts
 * Fetches FollowUpBoss activity data (calls, texts, emails, pipeline stages,
 * closed deals) per team member for the Tateo & Co leaderboard dashboard.
 *
 * Env: FOLLOWUPBOSS_API_KEY (same key used by the rest of the FUB integration)
 */

const FUB_BASE = "https://api.followupboss.com/v1";

// 5-minute in-memory cache so the dashboard is fast for every team member
const _cache = new Map<string, { data: LeaderboardPayload; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// ── Team definition ──────────────────────────────────────────────────────────
export const LEADERBOARD_TEAM = [
  { email: "christian@tateoco.com", name: "Christian Tateo", initials: "CT", isAdmin: true },
  { email: "omar@tateoco.com",      name: "Omar Andujar",    initials: "OA", isAdmin: false },
  { email: "kyle@tateoco.com",      name: "Kyle Schweinitz", initials: "KS", isAdmin: false },
  { email: "alex@tateoco.com",      name: "Alex",            initials: "AL", isAdmin: false },
] as const;

export type TeamEmail = typeof LEADERBOARD_TEAM[number]["email"];

// ── Pipeline stages (exact FUB names) ───────────────────────────────────────
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

// ── Return types ─────────────────────────────────────────────────────────────
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
  closedDeals: number;
  underContract: number;
  pipeline: Record<string, number>;
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function fubHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": "Basic " + Buffer.from(`${apiKey}:`).toString("base64"),
  };
}

async function fubGet(apiKey: string, path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${FUB_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: fubHeaders(apiKey) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FUB ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllPages(
  apiKey: string,
  path: string,
  params: Record<string, string> = {},
): Promise<any[]> {
  const limit = 200;
  let offset = 0;
  const all: any[] = [];

  while (true) {
    const data = await fubGet(apiKey, path, { ...params, limit: String(limit), offset: String(offset) });
    const itemKey = Object.keys(data).find((k) => k !== "_metadata" && Array.isArray(data[k]));
    const items: any[] = itemKey ? data[itemKey] : [];
    all.push(...items);

    const total: number = data._metadata?.total ?? items.length;
    offset += limit;
    if (offset >= total || items.length === 0) break;
  }

  return all;
}

// ── Date range helpers ────────────────────────────────────────────────────────
export type Period = "today" | "week" | "month" | "quarter" | "year";

function getPeriodDates(period: Period): { start: string; end: string } {
  const now = new Date();
  let start: Date;

  switch (period) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    case "week": {
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      break;
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0, 0);
      break;
    }
    case "year":
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  return {
    start: start.toISOString(),
    end:   now.toISOString(),
  };
}

// ── Core data fetch ───────────────────────────────────────────────────────────
export async function getLeaderboardData(
  apiKey: string,
  period: Period,
): Promise<LeaderboardPayload> {
  const cacheKey = period;
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[fub-leaderboard] cache hit: period=${period}`);
    return cached.data;
  }

  console.log(`[fub-leaderboard] fetching: period=${period}`);
  const { start, end } = getPeriodDates(period);

  // Step 1: Resolve FUB user IDs
  const emailToFubId = new Map<string, number>();
  try {
    const usersData = await fubGet(apiKey, "/users");
    const users: any[] = usersData.users ?? [];
    for (const u of users) {
      if (u.email && u.id) emailToFubId.set(u.email.toLowerCase(), Number(u.id));
    }
    console.log(`[fub-leaderboard] resolved ${emailToFubId.size} FUB users`);
  } catch (err: any) {
    console.error("[fub-leaderboard] failed to fetch users:", err.message);
  }

  // Step 2: Fetch activity events
  const EVENT_TYPES = ["Call", "Text", "Email", "Appointment"] as const;
  type EventType = typeof EVENT_TYPES[number];

  const eventCounts: Record<string, Record<EventType, number>> = {};
  for (const m of LEADERBOARD_TEAM) {
    eventCounts[m.email] = { Call: 0, Text: 0, Email: 0, Appointment: 0 };
  }

  for (const eventType of EVENT_TYPES) {
    try {
      const events = await fetchAllPages(apiKey, "/events", {
        type:           eventType,
        "created[gte]": start,
        "created[lte]": end,
      });

      for (const ev of events) {
        const assignedEmail: string | undefined =
          ev.assignedTo?.email?.toLowerCase() ??
          ev.person?.assignedTo?.email?.toLowerCase();

        if (assignedEmail && eventCounts[assignedEmail]) {
          eventCounts[assignedEmail][eventType]++;
        }
      }

      console.log(`[fub-leaderboard] ${eventType}: ${events.length} events in period`);
    } catch (err: any) {
      console.error(`[fub-leaderboard] error fetching ${eventType} events:`, err.message);
    }
  }

  // Step 3: Fetch pipeline stage counts per agent
  const stageCounts: Record<string, Record<string, number>> = {};
  for (const m of LEADERBOARD_TEAM) {
    stageCounts[m.email] = {};
    for (const s of PIPELINE_STAGES) stageCounts[m.email][s] = 0;
  }

  try {
    const people = await fetchAllPages(apiKey, "/people", {
      "updated[gte]": start,
      "updated[lte]": end,
    });

    for (const person of people) {
      const stage: string | undefined = person.stage;
      const assignedEmail: string | undefined =
        person.assignedTo?.email?.toLowerCase() ??
        (typeof person.assignedTo === "string" ? person.assignedTo.toLowerCase() : undefined);

      if (
        stage &&
        assignedEmail &&
        stageCounts[assignedEmail] &&
        stageCounts[assignedEmail][stage] !== undefined
      ) {
        stageCounts[assignedEmail][stage]++;
      }
    }

    console.log(`[fub-leaderboard] pipeline: ${people.length} people updated in period`);
  } catch (err: any) {
    console.error("[fub-leaderboard] error fetching people:", err.message);
  }

  // Step 4: Build agent rows
  const agents: AgentRow[] = LEADERBOARD_TEAM.map((member) => {
    const calls    = eventCounts[member.email].Call;
    const texts    = eventCounts[member.email].Text;
    const emails   = eventCounts[member.email].Email;
    const showings = eventCounts[member.email].Appointment;
    const pipeline = stageCounts[member.email] ?? {};
    const closedDeals   = pipeline["Closed"] ?? 0;
    const underContract = pipeline["Under Contract"] ?? 0;
    const totalActivity = calls + texts + emails;

    return {
      email: member.email,
      name: member.name,
      initials: member.initials,
      isAdmin: member.isAdmin,
      fubUserId: emailToFubId.get(member.email) ?? null,
      calls,
      texts,
      emails,
      showings,
      closedDeals,
      underContract,
      pipeline,
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

  _cache.set(cacheKey, { data: payload, ts: Date.now() });
  console.log(`[fub-leaderboard] done: period=${period}, agents=${agents.length}`);
  return payload;
}

export function bustLeaderboardCache(period?: Period): void {
  if (period) {
    _cache.delete(period);
  } else {
    _cache.clear();
  }
}
