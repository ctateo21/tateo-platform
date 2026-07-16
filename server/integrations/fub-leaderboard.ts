/**
 * fub-leaderboard.ts — v8
 * Added: newLeads — people whose person.created falls within the period window.
 * Counted inside the existing people loop, zero extra API calls.
 */

const FUB_BASE = "https://api.followupboss.com/v1";

const _cache = new Map<string, { data: LeaderboardPayload; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export const LEADERBOARD_TEAM = [
  { email: "christian@tateoco.com", name: "Christian Tateo", initials: "CT", isAdmin: true  },
  { email: "omar@tateoco.com",      name: "Omar Andujar",    initials: "OA", isAdmin: false },
  { email: "kyle@tateoco.com",      name: "Kyle Schweinitz", initials: "KS", isAdmin: false },
  { email: "alex@tateoco.com",      name: "Alex Szabo",      initials: "AS", isAdmin: false },
] as const;

export type TeamEmail = typeof LEADERBOARD_TEAM[number]["email"];

// Emails allowed to VIEW the leaderboard without appearing as an agent row
export const LEADERBOARD_VIEWERS = ["courtney@tateoco.com"] as const;

const FUB_ID_TO_TEAM_EMAIL: Record<number, TeamEmail> = {
  1: "christian@tateoco.com",
  2: "omar@tateoco.com",
  5: "kyle@tateoco.com",
  6: "alex@tateoco.com",
};

const FUB_NAME_TO_TEAM_EMAIL: Record<string, TeamEmail> = {
  "christian tateo": "christian@tateoco.com",
  "omar andujar":    "omar@tateoco.com",
  "kyle schweinitz": "kyle@tateoco.com",
  "alex szabo":      "alex@tateoco.com",
};

export const PIPELINE_STAGES = [
  "Lead", "Attempted Contact", "Spoke with Customer", "Appointment Set",
  "Met with Customer", "Showing Homes", "Listing Agreement", "Active Listing",
  "Submitting Offers", "Under Contract", "Nurture", "Closed", "Trash",
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];

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
  closedDealsAllTime: number;
  underContract: number;
  pipeline: Record<string, number>;
  totalActivity: number;
  totalLeads: number;
  newLeads: number;
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
    totalLeads: number;
    newLeads: number;
  };
}

export type Period = "today" | "yesterday" | "week" | "month" | "quarter" | "year";

export function fubHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": "Basic " + Buffer.from(`${apiKey}:`).toString("base64"),
  };
}

async function fubGet(apiKey: string, path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${FUB_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url.toString(), { headers: fubHeaders(apiKey) });
    if (res.status === 429 && attempt < 3) {
      const retryAfter = Number(res.headers.get("retry-after")) || 5;
      console.warn(`[fub-lb] 429 on ${path}, retrying in ${retryAfter}s (attempt ${attempt + 1}/3)`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`FUB ${path} → ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  }
}

async function fetchAllPages(apiKey: string, path: string, params: Record<string, string> = {}): Promise<any[]> {
  const LIMIT = 200;
  let offset = 0;
  const all: any[] = [];
  while (true) {
    const data = await fubGet(apiKey, path, { ...params, limit: String(LIMIT), offset: String(offset) });
    const key = Object.keys(data).find((k) => k !== "_metadata" && Array.isArray(data[k]));
    const items: any[] = key ? data[key] : [];
    all.push(...items);
    const total: number = data._metadata?.total ?? items.length;
    offset += LIMIT;
    if (offset >= total || items.length === 0) break;
  }
  return all;
}

async function runBatched<T>(tasks: (() => Promise<T>)[], concurrency = 10): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((t) => t()));
    results.push(...batchResults);
  }
  return results;
}

function getPeriodDates(period: Period): { startMs: number; endMs: number; startIso: string } {
  const now = new Date();
  let start: Date;
  let end: Date | null = null;
  switch (period) {
    case "today":   start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case "yesterday": {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      end   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    }
    case "week": {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "month": {
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case "year":    start = new Date(now.getFullYear(), 0, 1); break;
    default:        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return { startMs: start.getTime(), endMs: end ? end.getTime() : Date.now() + 60_000, startIso: start.toISOString() };
}

function getCreatedMs(record: any): number {
  const raw = record.created ?? record.createdAt ?? record.date ?? record.startTime ?? null;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return isNaN(ms) ? 0 : ms;
}

function getUpdatedMs(record: any): number {
  const raw = record.updated ?? record.updatedAt ?? null;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return isNaN(ms) ? 0 : ms;
}

function resolveEmail(obj: any, idMap: Map<number, TeamEmail>, nameMap: Map<string, TeamEmail>): TeamEmail | undefined {
  for (const field of ["userId", "assignedUserId", "createdById", "createdByUserId"]) {
    const raw = obj[field];
    if (raw != null && Number(raw) > 0) {
      const e = idMap.get(Number(raw));
      if (e) return e;
    }
  }
  const name = (obj.userName ?? obj.assignedTo ?? obj.createdBy ?? "").toLowerCase().trim();
  if (name) return nameMap.get(name);
  return undefined;
}

export async function getLeaderboardData(apiKey: string, period: Period): Promise<LeaderboardPayload> {
  const cached = _cache.get(period);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[fub-lb] cache hit: ${period}`);
    return cached.data;
  }

  console.log(`[fub-lb] fetching: period=${period}`);
  const { startMs, endMs, startIso } = getPeriodDates(period);

  const idMap = new Map<number, TeamEmail>(
    Object.entries(FUB_ID_TO_TEAM_EMAIL).map(([id, e]) => [Number(id), e as TeamEmail]),
  );
  const nameMap = new Map<string, TeamEmail>(
    Object.entries(FUB_NAME_TO_TEAM_EMAIL).map(([n, e]) => [n, e as TeamEmail]),
  );
  const teamEmailToFubId = new Map<TeamEmail, number>(
    Object.entries(FUB_ID_TO_TEAM_EMAIL).map(([id, e]) => [e as TeamEmail, Number(id)]),
  );

  const counts: Record<string, { calls: number; texts: number; emails: number; showings: number }> = {};
  for (const m of LEADERBOARD_TEAM) counts[m.email] = { calls: 0, texts: 0, emails: 0, showings: 0 };

  // ── CALLS ────────────────────────────────────────────────────────────────
  try {
    const calls = await fetchAllPages(apiKey, "/calls", { since: startIso });
    let matched = 0;
    for (const call of calls) {
      const callMs = getCreatedMs(call);
      if (callMs < startMs || callMs >= endMs) continue;
      const email = resolveEmail(call, idMap, nameMap);
      if (email && counts[email]) { counts[email].calls++; matched++; }
    }
    console.log(`[fub-lb] calls: ${calls.length} fetched, ${matched} matched team in period`);
  } catch (err: any) {
    console.error("[fub-lb] /calls error:", err.message);
  }

  // ── SHOWINGS ─────────────────────────────────────────────────────────────
  try {
    const appts = await fetchAllPages(apiKey, "/appointments", { since: startIso });
    let matched = 0;
    for (const appt of appts) {
      const apptMs = getCreatedMs(appt);
      if (apptMs < startMs || apptMs >= endMs) continue;
      const email = resolveEmail(appt, idMap, nameMap);
      if (email && counts[email]) { counts[email].showings++; matched++; }
    }
    console.log(`[fub-lb] appointments: ${appts.length} fetched, ${matched} matched team in period`);
  } catch (err: any) {
    console.error("[fub-lb] /appointments error:", err.message);
  }

  // ── PIPELINE + NEW LEADS (single people fetch, no extra API calls) ────────
  const pipeline: Record<string, Record<string, number>> = {};
  const newLeadCounts: Record<string, number> = {};
  for (const m of LEADERBOARD_TEAM) {
    pipeline[m.email] = {};
    for (const s of PIPELINE_STAGES) pipeline[m.email][s] = 0;
    newLeadCounts[m.email] = 0;
  }

  const activePeopleByEmail: Record<string, Array<{ id: number }>> = {};
  for (const m of LEADERBOARD_TEAM) activePeopleByEmail[m.email] = [];

  let peopleTotal = 0;
  let pipelineMatched = 0;
  let newLeadsTotal = 0;

  try {
    const people = await fetchAllPages(apiKey, "/people");
    peopleTotal = people.length;

    for (const person of people) {
      const stage = (person.stage ?? "") as string;
      const email = resolveEmail(person, idMap, nameMap);

      if (email) {
        // Pipeline — all people regardless of period
        if (stage && pipeline[email] && pipeline[email][stage] !== undefined) {
          pipeline[email][stage]++;
          pipelineMatched++;
        }
        // New leads — created within the period window
        const personCreatedMs = getCreatedMs(person);
        if (personCreatedMs >= startMs && personCreatedMs < endMs && newLeadCounts[email] !== undefined) {
          newLeadCounts[email]++;
          newLeadsTotal++;
        }
        // Active in period — for text/email per-person fetch
        if (getUpdatedMs(person) >= startMs) {
          activePeopleByEmail[email].push({ id: person.id });
        }
      }
    }

    const activeCount = Object.values(activePeopleByEmail).reduce((s, a) => s + a.length, 0);
    console.log(`[fub-lb] pipeline: ${peopleTotal} people, ${pipelineMatched} matched, ${activeCount} active in period, ${newLeadsTotal} new leads`);
  } catch (err: any) {
    console.error("[fub-lb] /people error:", err.message);
  }

  // ── TEXTS (per-person, batched) ──────────────────────────────────────────
  for (const m of LEADERBOARD_TEAM) {
    const activePeople = activePeopleByEmail[m.email];
    if (activePeople.length === 0) continue;
    const tasks = activePeople.map(({ id }) => async () => {
      try {
        const texts = await fetchAllPages(apiKey, "/textMessages", { personId: String(id) });
        return texts.filter((t) => { const ms = getCreatedMs(t); return ms >= startMs && ms < endMs; }).length;
      } catch { return 0; }
    });
    try {
      const results = await runBatched(tasks, 10);
      const total = results.reduce((s, n) => s + n, 0);
      counts[m.email].texts = total;
      if (total > 0) console.log(`[fub-lb] texts for ${m.name}: ${total} in period`);
    } catch (err: any) {
      console.warn(`[fub-lb] texts batch error for ${m.name}:`, err.message);
    }
  }

  // ── EMAILS (per-person, batched) ─────────────────────────────────────────
  for (const m of LEADERBOARD_TEAM) {
    const activePeople = activePeopleByEmail[m.email];
    if (activePeople.length === 0) continue;
    const tasks = activePeople.map(({ id }) => async () => {
      try {
        const emails = await fetchAllPages(apiKey, "/emails", { personId: String(id) });
        return emails.filter((e) => { const ms = getCreatedMs(e); return ms >= startMs && ms < endMs; }).length;
      } catch { return 0; }
    });
    try {
      const results = await runBatched(tasks, 10);
      const total = results.reduce((s, n) => s + n, 0);
      counts[m.email].emails = total;
      if (total > 0) console.log(`[fub-lb] emails for ${m.name}: ${total} in period`);
    } catch (err: any) {
      console.warn(`[fub-lb] emails batch error for ${m.name}:`, err.message);
    }
  }

  // ── CLOSED DEALS (updated date = when moved to Closed) ───────────────────
  const closedThisPeriod: Record<string, number> = {};
  const closedAllTime: Record<string, number>    = {};
  for (const m of LEADERBOARD_TEAM) { closedThisPeriod[m.email] = 0; closedAllTime[m.email] = 0; }

  try {
    const closedPeople = await fetchAllPages(apiKey, "/people", { stage: "Closed" });
    for (const person of closedPeople) {
      const email = resolveEmail(person, idMap, nameMap);
      if (!email) continue;
      if (closedAllTime[email] !== undefined) closedAllTime[email]++;
      const closedUpdatedMs = getUpdatedMs(person);
      if (closedUpdatedMs >= startMs && closedUpdatedMs < endMs && closedThisPeriod[email] !== undefined) {
        closedThisPeriod[email]++;
      }
    }
    console.log(`[fub-lb] closed: ${closedPeople.length} all-time, ${Object.values(closedThisPeriod).reduce((a, b) => a + b, 0)} this period`);
  } catch (err: any) {
    console.warn("[fub-lb] stage=Closed filter failed, using pipeline fallback:", err.message);
    for (const m of LEADERBOARD_TEAM) {
      closedAllTime[m.email]    = pipeline[m.email]?.["Closed"] ?? 0;
      closedThisPeriod[m.email] = closedAllTime[m.email];
    }
  }

  // ── Build rows ────────────────────────────────────────────────────────────
  const agents: AgentRow[] = LEADERBOARD_TEAM.map((m) => {
    const c = counts[m.email];
    const p = pipeline[m.email] ?? {};
    const totalActivity = c.calls + c.texts + c.emails;
    const totalLeads    = Object.values(p).reduce((sum, n) => sum + n, 0);

    return {
      email:              m.email,
      name:               m.name,
      initials:           m.initials,
      isAdmin:            m.isAdmin,
      fubUserId:          teamEmailToFubId.get(m.email) ?? null,
      calls:              c.calls,
      texts:              c.texts,
      emails:             c.emails,
      showings:           c.showings,
      closedDeals:        closedThisPeriod[m.email] ?? 0,
      closedDealsAllTime: closedAllTime[m.email]    ?? 0,
      underContract:      p["Under Contract"] ?? 0,
      pipeline:           p,
      totalActivity,
      totalLeads,
      newLeads:           newLeadCounts[m.email] ?? 0,
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
    totalLeads:    agents.reduce((s, r) => s + r.totalLeads, 0),
    newLeads:      agents.reduce((s, r) => s + r.newLeads, 0),
  };

  const payload: LeaderboardPayload = {
    period,
    generatedAt: new Date().toISOString(),
    agents,
    teamTotals,
  };

  _cache.set(period, { data: payload, ts: Date.now() });
  console.log(`[fub-lb] done — calls:${teamTotals.calls} texts:${teamTotals.texts} emails:${teamTotals.emails} showings:${teamTotals.showings} closed:${teamTotals.closedDeals} newLeads:${teamTotals.newLeads}`);
  return payload;
}

export function bustLeaderboardCache(period?: Period): void {
  if (period) _cache.delete(period);
  else _cache.clear();
}