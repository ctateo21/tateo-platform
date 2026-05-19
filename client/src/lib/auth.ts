import { supabase } from "./supabase";

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

// ── In-memory caches (kept in sync with Supabase) ──────────────────
let _session: AuthUser | null = null;
let _purchaseScenarios: PurchaseScenario[] = [];
let _insuranceScenarios: InsuranceScenario[] = [];
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
  const [pRes, iRes] = await Promise.all([
    supabase.from("purchase_scenarios").select("*").eq("user_id", userId).order("saved_at", { ascending: false }),
    supabase.from("insurance_scenarios").select("*").eq("user_id", userId).order("saved_at", { ascending: false }),
  ]);
  _purchaseScenarios = (pRes.data ?? []).map(rowToPurchase);
  _insuranceScenarios = (iRes.data ?? []).map(rowToInsurance);
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
  let profile = await loadProfile(session.user.id);
  // First-login safety: if the trigger hasn't created the profile yet, do it now.
  if (!profile) {
    const meta = session.user.user_metadata || {};
    await supabase.from("profiles").upsert({
      id: session.user.id,
      name: meta.name || session.user.email?.split("@")[0] || "User",
      email: session.user.email!,
      phone: meta.phone ?? null,
      agent: meta.agent ?? null,
    });
    profile = await loadProfile(session.user.id);
  }
  _session = profile;
  await loadScenarios(session.user.id);
  notify();
}

// React to Supabase auth lifecycle (sign-in, sign-out, token refresh).
supabase.auth.onAuthStateChange((_event, _session) => { void hydrateFromSupabase(); });
// Initial hydration on app load.
void hydrateFromSupabase();

// ── Auth actions ──────────────────────────────────────────────────
export async function register(
  name: string,
  email: string,
  password: string,
  opts?: { phone?: string; agent?: string }
): Promise<{ ok: boolean; error?: string }> {
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
  const { error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });
  if (error) return { ok: false, error: error.message };
  await hydrateFromSupabase();
  return { ok: true };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
  _session = null;
  _purchaseScenarios = [];
  _insuranceScenarios = [];
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

async function persistPurchaseScenarios(s: PurchaseScenario[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const keep = new Set(s.map(x => x.id));
  // Delete rows no longer present, then upsert the rest.
  const { data: existing } = await supabase
    .from("purchase_scenarios")
    .select("id")
    .eq("user_id", user.id);
  const toDelete = (existing ?? []).map(r => r.id).filter(id => !keep.has(id));
  if (toDelete.length > 0) {
    await supabase.from("purchase_scenarios").delete().in("id", toDelete);
  }
  if (s.length > 0) {
    await supabase
      .from("purchase_scenarios")
      .upsert(s.map(x => purchaseToRow(x, user.id)), { onConflict: "id" });
  }
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

async function persistInsuranceScenarios(s: InsuranceScenario[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const keep = new Set(s.map(x => x.id));
  const { data: existing } = await supabase
    .from("insurance_scenarios")
    .select("id")
    .eq("user_id", user.id);
  const toDelete = (existing ?? []).map(r => r.id).filter(id => !keep.has(id));
  if (toDelete.length > 0) {
    await supabase.from("insurance_scenarios").delete().in("id", toDelete);
  }
  if (s.length > 0) {
    await supabase
      .from("insurance_scenarios")
      .upsert(s.map(x => insuranceToRow(x, user.id)), { onConflict: "id" });
  }
}
