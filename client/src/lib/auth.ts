import { supabase, supabaseReady } from "./supabase";

const NOT_CONFIGURED = {
  ok: false as const,
  error: "Sign-in is temporarily unavailable. Please try again in a moment.",
};

// ── Agents (matches FUB_AGENT_IDS on the server) ───────────────────
export const AGENTS = [
  { id: "christian", name: "Christian Tateo", initials: "CT" },
  { id: "omar",      name: "Omar Andujar",    initials: "OA" },
  { id: "kyle",      name: "Kyle Schweinitz", initials: "KS" },
  { id: "team",      name: "Team",            initials: "TM", isTeam: true },
] as const;

export type AgentId = typeof AGENTS[number]["id"];

export interface InvitedUser {
  name: string;
  email: string;
  invitedAt: string;
}

export interface AuthUser {
  name: string;
  email: string;
  phone?: string;
  agent?: string;
  invitedUser?: InvitedUser;
  createdAt: string;
}

export interface PurchaseScenario {
  id: string;
  address: string;
  savedAt: string;
  price?: number;
  monthlyPayment?: number;
  downPayment?: number;
  interestRate?: number;
  cashToClose?: number;
  dti?: number;
  qualifies?: boolean;
  downPaymentPct?: number;
  loanType?: string;
}

export interface InsuranceScenario {
  id: string;
  address: string;
  savedAt: string;
  annualPremium?: number;
  coverageType?: string;
}

export type TrackedLoanPropertyType = "primary" | "secondary" | "investment";

export interface TrackedLoan {
  id: string;
  propertyAddress: string;
  lender: string;
  loanBalance: number;
  currentRate: number;
  currentPI: number;
  monthlyPayment: number;
  estimatedHomeValue: number;
  estimatedRemainingYears: number;
  propertyType: TrackedLoanPropertyType;
  addedAt: string;
  balanceAsOf?: string;
}

// ── In-memory caches (kept in sync with Supabase) ──────────────────
let _session: AuthUser | null = null;
let _purchaseScenarios: PurchaseScenario[] = [];
let _insuranceScenarios: InsuranceScenario[] = [];
let _trackedLoans: TrackedLoan[] = [];
const _listeners = new Set<() => void>();

function notify() { _listeners.forEach(fn => { try { fn(); } catch {} }); }

export function subscribeAuthChange(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function getSession(): AuthUser | null { return _session; }

function rowToProfile(row: any): AuthUser {
  return {
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    agent: row.agent ?? undefined,
    invitedUser: row.invited_user ?? undefined,
    createdAt: row.created_at,
  };
}

function rowToPurchase(row: any): PurchaseScenario {
  return {
    id: row.id,
    address: row.address,
    savedAt: row.saved_at,
    price: row.price ?? undefined,
    monthlyPayment: row.monthly_payment ?? undefined,
    downPayment: row.down_payment ?? undefined,
    interestRate: row.interest_rate ?? undefined,
    cashToClose: row.cash_to_close ?? undefined,
    dti: row.dti ?? undefined,
    qualifies: row.qualifies ?? undefined,
    downPaymentPct: row.down_payment_pct ?? undefined,
    loanType: row.loan_type ?? undefined,
  };
}
function purchaseToRow(s: PurchaseScenario, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    address: s.address,
    saved_at: s.savedAt,
    price: s.price ?? null,
    monthly_payment: s.monthlyPayment ?? null,
    down_payment: s.downPayment ?? null,
    interest_rate: s.interestRate ?? null,
    cash_to_close: s.cashToClose ?? null,
    dti: s.dti ?? null,
    qualifies: s.qualifies ?? null,
    down_payment_pct: s.downPaymentPct ?? null,
    loan_type: s.loanType ?? null,
  };
}
function rowToInsurance(row: any): InsuranceScenario {
  return {
    id: row.id,
    address: row.address,
    savedAt: row.saved_at,
    annualPremium: row.annual_premium ?? undefined,
    coverageType: row.coverage_type ?? undefined,
  };
}
function insuranceToRow(s: InsuranceScenario, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    address: s.address,
    saved_at: s.savedAt,
    annual_premium: s.annualPremium ?? null,
    coverage_type: s.coverageType ?? null,
  };
}
function rowToTrackedLoan(row: any): TrackedLoan {
  return {
    id: row.id,
    propertyAddress: row.property_address,
    lender: row.lender ?? "",
    loanBalance: Number(row.loan_balance),
    currentRate: Number(row.current_rate),
    currentPI: Number(row.current_pi),
    monthlyPayment: Number(row.monthly_payment),
    estimatedHomeValue: Number(row.estimated_home_value),
    estimatedRemainingYears: Number(row.estimated_remaining_years),
    propertyType: (row.property_type ?? "primary") as TrackedLoanPropertyType,
    addedAt: row.added_at,
    balanceAsOf: row.balance_as_of ?? undefined,
  };
}
function trackedLoanToRow(l: TrackedLoan, userId: string) {
  return {
    id: l.id,
    user_id: userId,
    property_address: l.propertyAddress,
    lender: l.lender || null,
    loan_balance: l.loanBalance,
    current_rate: l.currentRate,
    current_pi: l.currentPI,
    monthly_payment: l.monthlyPayment,
    estimated_home_value: l.estimatedHomeValue,
    estimated_remaining_years: l.estimatedRemainingYears,
    property_type: l.propertyType ?? "primary",
    added_at: l.addedAt,
    balance_as_of: l.balanceAsOf ?? null,
  };
}

// ── Serialized write queues (one per table) ────────────────────────
// Prevents the race where two overlapping saves cause an older request
// to finish last and wipe newer rows via the delete-then-upsert pass.
const _writeChains: Record<string, Promise<void>> = {};
function enqueueWrite(key: string, fn: () => Promise<void>): Promise<void> {
  const prev = _writeChains[key] ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  _writeChains[key] = next;
  return next;
}

async function loadProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) { console.warn("[auth] loadProfile error:", error.message); return null; }
  return data ? rowToProfile(data) : null;
}

async function loadScenarios(userId: string) {
  const [pRes, iRes, lRes] = await Promise.all([
    supabase.from("purchase_scenarios").select("*").eq("user_id", userId).order("saved_at", { ascending: false }),
    supabase.from("insurance_scenarios").select("*").eq("user_id", userId).order("saved_at", { ascending: false }),
    supabase.from("tracked_loans").select("*").eq("user_id", userId).order("added_at", { ascending: false }),
  ]);
  _purchaseScenarios = (pRes.data ?? []).map(rowToPurchase);
  _insuranceScenarios = (iRes.data ?? []).map(rowToInsurance);
  _trackedLoans      = (lRes.data ?? []).map(rowToTrackedLoan);
}

// One-time migration of pre-existing localStorage data into Supabase the
// first time a user signs in on this browser. Reads from both legacy keys
// that the codebase historically used, dedupes by id, then clears them.
const MIGRATED_FLAG = "tateo_localstorage_migrated_v1";
const LEGACY_LOAN_KEYS = ["refinance-tracked-loans", "tateo_tracked_loans"];

async function migrateLocalStorageOnce(userId: string) {
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
  } catch { return; }

  const collected: TrackedLoan[] = [];
  for (const key of LEGACY_LOAN_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<TrackedLoan>[];
      if (!Array.isArray(parsed)) continue;
      for (const l of parsed) {
        if (!l || !l.id || !l.propertyAddress) continue;
        collected.push({
          id: String(l.id),
          propertyAddress: l.propertyAddress,
          lender: l.lender || "",
          loanBalance: Number(l.loanBalance ?? 0),
          currentRate: Number(l.currentRate ?? 0),
          currentPI: Number(l.currentPI ?? 0),
          monthlyPayment: Number(l.monthlyPayment ?? 0),
          estimatedHomeValue: Number(l.estimatedHomeValue ?? 0),
          estimatedRemainingYears: Number(l.estimatedRemainingYears ?? 30),
          propertyType: (l.propertyType ?? "primary") as TrackedLoanPropertyType,
          addedAt: l.addedAt || new Date().toISOString(),
          balanceAsOf: l.balanceAsOf,
        });
      }
    } catch { /* ignore corrupt entries */ }
  }

  // Dedupe by id (later keys win — but they're effectively the same data).
  const byId = new Map<string, TrackedLoan>();
  for (const l of collected) byId.set(l.id, l);
  const all = Array.from(byId.values());

  if (all.length > 0) {
    const { error } = await supabase
      .from("tracked_loans")
      .upsert(all.map(l => trackedLoanToRow(l, userId)), { onConflict: "id" });
    if (error) {
      console.warn("[auth] tracked-loan migration failed:", error.message);
      return; // don't set the flag — let it retry next session
    }
  }

  try {
    for (const key of LEGACY_LOAN_KEYS) localStorage.removeItem(key);
    localStorage.setItem(MIGRATED_FLAG, "1");
  } catch {}
}

async function hydrateFromSupabase() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    _session = null;
    _purchaseScenarios = [];
    _insuranceScenarios = [];
    try { localStorage.removeItem("tateo_auth"); } catch {}
    notify();
    return;
  }
  try { localStorage.setItem("tateo_auth", "1"); } catch {}

  // Build a safe fallback from the Supabase auth record so the UI can show
  // "signed in" even if the profiles table isn't reachable yet (e.g. schema
  // not yet applied, transient network error, or profile row missing).
  const meta = session.user.user_metadata || {};
  const fallback: AuthUser = {
    name: meta.name || session.user.email?.split("@")[0] || "User",
    email: session.user.email || "",
    phone: meta.phone ?? undefined,
    agent: meta.agent ?? undefined,
    createdAt: session.user.created_at ?? new Date().toISOString(),
  };

  let profile = await loadProfile(session.user.id);
  if (!profile) {
    // Try to create the row (first sign-in, or trigger not yet installed).
    const { error: upsertErr } = await supabase.from("profiles").upsert({
      id: session.user.id,
      name: fallback.name,
      email: fallback.email,
      phone: fallback.phone ?? null,
      agent: fallback.agent ?? null,
    });
    if (!upsertErr) profile = await loadProfile(session.user.id);
  }
  _session = profile ?? fallback;

  // Scenarios depend on their own tables; ignore errors so a missing schema
  // doesn't break the auth UI.
  try {
    await migrateLocalStorageOnce(session.user.id);
    await loadScenarios(session.user.id);
  } catch (e) {
    console.warn("[auth] loadScenarios skipped:", e);
  }
  notify();
}

// React to Supabase auth lifecycle (sign-in, sign-out, token refresh).
if (supabaseReady) {
  supabase.auth.onAuthStateChange((_event, _session) => { void hydrateFromSupabase(); });
  // Initial hydration on app load.
  void hydrateFromSupabase();
}

// ── Auth actions ──────────────────────────────────────────────────
export async function register(
  name: string,
  email: string,
  password: string,
  opts?: { phone?: string; agent?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseReady) return NOT_CONFIGURED;
  const cleanEmail = email.toLowerCase().trim();
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        name: name.trim(),
        phone: opts?.phone?.trim() || null,
        agent: opts?.agent?.trim() || null,
      },
    },
  });
  if (error) return { ok: false, error: error.message };
  // Some Supabase projects require email confirmation — in that case there's no session yet.
  if (!data.session) {
    return { ok: false, error: "Check your email to confirm your account, then sign in." };
  }
  await hydrateFromSupabase();
  return { ok: true };
}

export async function login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseReady) return NOT_CONFIGURED;
  const { error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });
  if (error) return { ok: false, error: error.message };
  await hydrateFromSupabase();
  return { ok: true };
}

export async function logout(): Promise<void> {
  if (supabaseReady) await supabase.auth.signOut();
  _session = null;
  _purchaseScenarios = [];
  _insuranceScenarios = [];
  _trackedLoans = [];
  notify();
}

export async function updateProfile(
  _currentEmail: string,
  updates: { name?: string; email?: string; phone?: string }
): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const targetEmail = updates.email?.toLowerCase().trim();
  if (targetEmail && targetEmail !== user.email) {
    if (!targetEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return { ok: false, error: "Please enter a valid email address." };
    }
    const { error: emailErr } = await supabase.auth.updateUser({ email: targetEmail });
    if (emailErr) return { ok: false, error: emailErr.message };
  }

  let phone: string | null | undefined = undefined;
  if (updates.phone !== undefined) {
    const digits = updates.phone.replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 10) {
      return { ok: false, error: "Please enter a valid 10-digit phone number." };
    }
    phone = digits || null;
  }

  const patch: Record<string, any> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (targetEmail) patch.email = targetEmail;
  if (phone !== undefined) patch.phone = phone;

  if (Object.keys(patch).length > 0) {
    const { error: pErr } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (pErr) return { ok: false, error: pErr.message };
  }

  await hydrateFromSupabase();
  return { ok: true };
}

export async function updatePassword(
  _email: string,
  _currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 6) return { ok: false, error: "New password must be at least 6 characters." };
  // Supabase doesn't require the current password when an active session exists;
  // the session itself proves identity.
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function inviteUser(
  _email: string,
  inviteeName: string,
  inviteeEmail: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!inviteeName.trim()) return { ok: false, error: "Please enter the invitee's full name." };
  const cleanEmail = inviteeEmail.toLowerCase().trim();
  if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return { ok: false, error: "Please enter a valid email address for the invitee." };
  }
  if (cleanEmail === user.email) return { ok: false, error: "You can't invite yourself." };

  const invited_user = {
    name: inviteeName.trim(),
    email: cleanEmail,
    invitedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("profiles").update({ invited_user }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  await hydrateFromSupabase();
  return { ok: true };
}

export async function removeInvitedUser(_email: string): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("profiles").update({ invited_user: null }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  await hydrateFromSupabase();
  return { ok: true };
}

// ── Purchase scenarios ────────────────────────────────────────────
export function getPurchaseScenarios(): PurchaseScenario[] {
  return _purchaseScenarios;
}

export function savePurchaseScenarios(s: PurchaseScenario[]) {
  _purchaseScenarios = s;
  notify();
  void persistPurchaseScenarios(s);
}

function persistPurchaseScenarios(s: PurchaseScenario[]) {
  // Bind the userId at enqueue time so a logout+login between enqueue and
  // execution can never cause us to write Account A's data into Account B's
  // rows. If the user has changed by the time the queue drains, drop it.
  const userId = _session?.id;
  if (!userId) return Promise.resolve();
  return enqueueWrite("purchase_scenarios", async () => {
    if (_session?.id !== userId) return; // user changed; abort this stale job
    const keep = new Set(s.map(x => x.id));
    const { data: existing } = await supabase
      .from("purchase_scenarios")
      .select("id")
      .eq("user_id", userId);
    const toDelete = (existing ?? []).map(r => r.id).filter(id => !keep.has(id));
    if (toDelete.length > 0) {
      await supabase.from("purchase_scenarios").delete().in("id", toDelete).eq("user_id", userId);
    }
    if (s.length > 0) {
      await supabase
        .from("purchase_scenarios")
        .upsert(s.map(x => purchaseToRow(x, userId)), { onConflict: "id" });
    }
  });
}

// ── Insurance scenarios ───────────────────────────────────────────
export function getInsuranceScenarios(): InsuranceScenario[] {
  return _insuranceScenarios;
}

export function saveInsuranceScenarios(s: InsuranceScenario[]) {
  _insuranceScenarios = s;
  notify();
  void persistInsuranceScenarios(s);
}

function persistInsuranceScenarios(s: InsuranceScenario[]) {
  const userId = _session?.id;
  if (!userId) return Promise.resolve();
  return enqueueWrite("insurance_scenarios", async () => {
    if (_session?.id !== userId) return;
    const keep = new Set(s.map(x => x.id));
    const { data: existing } = await supabase
      .from("insurance_scenarios")
      .select("id")
      .eq("user_id", userId);
    const toDelete = (existing ?? []).map(r => r.id).filter(id => !keep.has(id));
    if (toDelete.length > 0) {
      await supabase.from("insurance_scenarios").delete().in("id", toDelete).eq("user_id", userId);
    }
    if (s.length > 0) {
      await supabase
        .from("insurance_scenarios")
        .upsert(s.map(x => insuranceToRow(x, userId)), { onConflict: "id" });
    }
  });
}

// ── Tracked refi loans ────────────────────────────────────────────
export function getTrackedLoans(): TrackedLoan[] {
  return _trackedLoans;
}

export function saveTrackedLoans(loans: TrackedLoan[]) {
  _trackedLoans = loans;
  notify();
  void persistTrackedLoans(loans);
}

function persistTrackedLoans(loans: TrackedLoan[]) {
  const userId = _session?.id;
  if (!userId) return Promise.resolve();
  return enqueueWrite("tracked_loans", async () => {
    if (_session?.id !== userId) return;
    const keep = new Set(loans.map(l => l.id));
    const { data: existing } = await supabase
      .from("tracked_loans")
      .select("id")
      .eq("user_id", userId);
    const toDelete = (existing ?? []).map(r => r.id).filter(id => !keep.has(id));
    if (toDelete.length > 0) {
      await supabase.from("tracked_loans").delete().in("id", toDelete).eq("user_id", userId);
    }
    if (loans.length > 0) {
      await supabase
        .from("tracked_loans")
        .upsert(loans.map(l => trackedLoanToRow(l, userId)), { onConflict: "id" });
    }
  });
}
