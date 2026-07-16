/**
 * leaderboard.tsx — v8
 * Added: New Leads column (🌱) showing leads created in the selected period.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { authedFetch } from "@/lib/authed-fetch";

type Period = "today" | "yesterday" | "week" | "month" | "quarter" | "year";

interface AgentRow {
  email: string;
  name: string;
  initials: string;
  isAdmin: boolean;
  calls: number;
  texts: number;
  emails: number;
  showings: number;
  closedDeals: number;
  underContract: number;
  pipeline: Record<string, number>;
  totalActivity: number;
  totalLeads: number;
  newLeads: number;
}

interface LeaderboardData {
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

const TEAM_EMAILS = new Set([
  "christian@tateoco.com",
  "omar@tateoco.com",
  "kyle@tateoco.com",
  "alex@tateoco.com",
]);

const PERIOD_LABELS: Record<Period, string> = {
  today:     "Today",
  yesterday: "Yesterday",
  week:    "Last 7 Days",
  month:   "Last 30 Days",
  quarter: "This Quarter",
  year:    "This Year",
};

const HIGHLIGHT_STAGES = [
  "Lead",
  "Attempted Contact",
  "Appointment Set",
  "Showing Homes",
  "Submitting Offers",
  "Under Contract",
  "Closed",
];

const AUTO_REFRESH_MS = 5 * 60 * 1000;

function StatBadge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return (
    <span className="h-8 w-8 rounded-full bg-gray-700 text-gray-300 text-sm font-bold flex items-center justify-center">
      {rank}
    </span>
  );
}

function PipelineBar({ pipeline }: { pipeline: Record<string, number> }) {
  return (
    <div className="text-xs space-y-0.5">
      {HIGHLIGHT_STAGES.map((stage) => {
        const count = pipeline[stage] ?? 0;
        if (count === 0) return null;
        return (
          <div key={stage} className="flex items-center gap-1.5">
            <span className="text-gray-400 w-28 truncate">{stage}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-teal-900/50 text-teal-300">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AgentCard({ agent, rank }: { agent: AgentRow; rank: number }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
      <div className="flex items-center gap-3">
        <RankBadge rank={rank} />
        <div className="h-10 w-10 rounded-full bg-[#0D9488] flex items-center justify-center font-bold text-white text-sm shrink-0">
          {agent.initials}
        </div>
        <div>
          <p className="font-semibold text-white">{agent.name}</p>
          <p className="text-xs text-gray-400">{agent.email}</p>
        </div>
        {agent.closedDeals > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-900/60 text-green-300 text-xs font-semibold">
            🏆 {agent.closedDeals} Closed
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 pt-1">
        <StatBadge value={agent.calls}    label="Calls"    color="text-blue-400" />
        <StatBadge value={agent.texts}    label="Texts"    color="text-purple-400" />
        <StatBadge value={agent.emails}   label="Emails"   color="text-orange-400" />
        <StatBadge value={agent.showings} label="Showings" color="text-teal-400" />
      </div>
      <div className="flex gap-4">
        {agent.underContract > 0 && (
          <p className="text-xs text-yellow-400 font-medium">🔑 {agent.underContract} Under Contract</p>
        )}
        {agent.newLeads > 0 && (
          <p className="text-xs text-emerald-400 font-medium">
            🌱 {agent.newLeads} New {agent.newLeads === 1 ? "Lead" : "Leads"}
          </p>
        )}
      </div>
      <div className="border-t border-gray-700 pt-2">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pipeline</p>
        <PipelineBar pipeline={agent.pipeline} />
      </div>
    </div>
  );
}

function AgentTableRow({ agent, rank }: { agent: AgentRow; rank: number }) {
  return (
    <tr className="border-b border-gray-700 hover:bg-gray-800/60 transition-colors">
      <td className="px-4 py-4 text-center"><RankBadge rank={rank} /></td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[#0D9488] flex items-center justify-center font-bold text-white text-sm shrink-0">
            {agent.initials}
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{agent.name}</p>
            <p className="text-xs text-gray-400">{agent.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center"><span className="text-lg font-bold text-blue-400">{agent.calls}</span></td>
      <td className="px-4 py-4 text-center"><span className="text-lg font-bold text-purple-400">{agent.texts}</span></td>
      <td className="px-4 py-4 text-center"><span className="text-lg font-bold text-orange-400">{agent.emails}</span></td>
      <td className="px-4 py-4 text-center"><span className="text-lg font-bold text-teal-400">{agent.showings}</span></td>
      <td className="px-4 py-4 text-center"><span className="text-lg font-bold text-yellow-400">{agent.underContract}</span></td>
      <td className="px-4 py-4 text-center">
        {agent.closedDeals > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-900/60 text-green-300 text-sm font-bold">
            🏆 {agent.closedDeals}
          </span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="px-4 py-4 text-center"><span className="text-lg font-bold text-white">{agent.totalActivity}</span></td>
      <td className="px-4 py-4 text-center"><span className="text-lg font-bold text-emerald-400">{agent.newLeads}</span></td>
      <td className="px-4 py-4"><PipelineBar pipeline={agent.pipeline} /></td>
    </tr>
  );
}

export default function Leaderboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !TEAM_EMAILS.has((user.email ?? "").toLowerCase()))) {
      setLocation("/dashboard");
    }
  }, [user, authLoading, setLocation]);

  const fetchData = useCallback(async (p: Period, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/fub/leaderboard?period=${p}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      const json: LeaderboardData = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message ?? "Failed to load leaderboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && TEAM_EMAILS.has((user.email ?? "").toLowerCase())) {
      fetchData(period);
    }
  }, [period, user, fetchData]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (user && TEAM_EMAILS.has((user.email ?? "").toLowerCase())) {
        fetchData(period, true);
      }
    }, AUTO_REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [period, user, fetchData]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-400" />
      </div>
    );
  }

  if (!user || !TEAM_EMAILS.has((user.email ?? "").toLowerCase())) return null;

  const totals = data?.teamTotals;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="bg-[#0F172A] border-b border-gray-800 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Team Leaderboard</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Live activity from FollowUpBoss · Auto-refreshes every 5 min
                {lastRefresh && (
                  <span className="ml-2 text-gray-500">
                    · Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => fetchData(period)}
              disabled={loading}
              className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors disabled:opacity-50"
            >
              <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582M20 20v-5h-.581M4.582 9A8 8 0 0120 15M19.418 15A8 8 0 014 9" />
              </svg>
              Refresh
            </button>
          </div>

          <div className="flex gap-1 mt-5 overflow-x-auto">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  period === p
                    ? "bg-[#0D9488] text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {totals && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "📞 Calls",     value: totals.calls,         color: "text-blue-400" },
              { label: "💬 Texts",     value: totals.texts,         color: "text-purple-400" },
              { label: "📧 Emails",    value: totals.emails,        color: "text-orange-400" },
              { label: "🏠 Showings",  value: totals.showings,      color: "text-teal-400" },
              { label: "🔑 Contract",  value: totals.underContract, color: "text-yellow-400" },
              { label: "🏆 Closed",    value: totals.closedDeals,   color: "text-green-400" },
              { label: "⚡ Total",      value: totals.totalActivity, color: "text-white" },
              { label: "🌱 New Leads", value: totals.newLeads,      color: "text-emerald-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
            <strong>Error loading leaderboard:</strong> {error}
            <br />
            <span className="text-red-400/70 text-xs">
              Make sure FOLLOWUPBOSS_API_KEY is set in your Replit Secrets.
            </span>
          </div>
        )}

        {loading && !data && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-800 rounded-xl h-24 animate-pulse border border-gray-700" />
            ))}
          </div>
        )}

        {data && (
          <div className="hidden md:block">
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900/60 border-b border-gray-700">
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide w-12">#</th>
                    <th className="px-4 py-3 text-left   text-xs font-semibold text-gray-400   uppercase tracking-wide">Agent</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-blue-400   uppercase tracking-wide">📞 Calls</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-purple-400 uppercase tracking-wide">💬 Texts</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-orange-400 uppercase tracking-wide">📧 Emails</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-teal-400   uppercase tracking-wide">🏠 Showings</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-yellow-400 uppercase tracking-wide">🔑 Contract</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-green-400  uppercase tracking-wide">🏆 Closed</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white      uppercase tracking-wide">⚡ Total</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-400 uppercase tracking-wide">🌱 New Leads</th>
                    <th className="px-4 py-3 text-left   text-xs font-semibold text-gray-400   uppercase tracking-wide">Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agents.map((agent, i) => (
                    <AgentTableRow key={agent.email} agent={agent} rank={i + 1} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && (
          <div className="md:hidden space-y-3">
            {data.agents.map((agent, i) => (
              <AgentCard key={agent.email} agent={agent} rank={i + 1} />
            ))}
          </div>
        )}

        {data && (
          <p className="text-center text-xs text-gray-600">
            Period: <strong className="text-gray-500">{PERIOD_LABELS[period as Period]}</strong>
            {" · "}New Leads = FUB person.created in period · Pipeline = current stage snapshot
            {" · "}Data generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}