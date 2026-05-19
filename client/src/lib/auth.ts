// ── Agents (matches FUB_AGENT_IDS on the server) ───────────────────
export const AGENTS = [
  { id: "christian", name: "Christian Tateo", initials: "CT" },
  { id: "omar",      name: "Omar Andujar",    initials: "OA" },
  { id: "kyle",      name: "Kyle Schweinitz", initials: "KS" },
  { id: "team",      name: "Team",            initials: "TM", isTeam: true },
] as const;

export type AgentId = typeof AGENTS[number]["id"];

export interface AuthUser {
  name: string;
  email: string;
  phone?: string;
  agent?: string;  // display name e.g. "Christian Tateo"
  createdAt: string;
}

interface StoredUser extends AuthUser {
  password: string;
}

const USERS_KEY = "tateo_users";
const SESSION_KEY = "tateo_session";

function getStoredUsers(): Record<string, StoredUser> {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); }
  catch { return {}; }
}

function saveStoredUsers(users: Record<string, StoredUser>) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch {}
}

export function getSession(): AuthUser | null {
  try {
    const s = localStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function writeSession(user: StoredUser) {
  const session: AuthUser = {
    name: user.name, email: user.email,
    phone: user.phone, agent: user.agent,
    createdAt: user.createdAt,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Legacy flag kept for older components that check it
  try { localStorage.setItem("tateo_auth", "1"); } catch {}
}

export function register(
  name: string,
  email: string,
  password: string,
  opts?: { phone?: string; agent?: string }
): { ok: boolean; error?: string } {
  const users = getStoredUsers();
  const key = email.toLowerCase().trim();
  if (users[key]) return { ok: false, error: "An account with this email already exists." };
  const user: StoredUser = {
    name: name.trim(), email: key, password,
    phone: opts?.phone?.trim() || undefined,
    agent: opts?.agent?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  users[key] = user;
  saveStoredUsers(users);
  writeSession(user);
  return { ok: true };
}

export function login(email: string, password: string): { ok: boolean; error?: string } {
  const users = getStoredUsers();
  const key = email.toLowerCase().trim();
  const user = users[key];
  if (!user) return { ok: false, error: "No account found with this email." };
  if (user.password !== password) return { ok: false, error: "Incorrect password." };
  writeSession(user);
  return { ok: true };
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  try { localStorage.removeItem("tateo_auth"); } catch {}
}

// ── Purchase scenarios ────────────────────────────────────────────
export interface PurchaseScenario {
  id: string;
  address: string;
  savedAt: string;
  price?: number;
  monthlyPayment?: number;
  downPayment?: number;
  interestRate?: number;
}

export function getPurchaseScenarios(): PurchaseScenario[] {
  try { return JSON.parse(localStorage.getItem("tateo_purchase_scenarios") || "[]"); }
  catch { return []; }
}

export function savePurchaseScenarios(s: PurchaseScenario[]) {
  try { localStorage.setItem("tateo_purchase_scenarios", JSON.stringify(s)); } catch {}
}

// ── Insurance scenarios ───────────────────────────────────────────
export interface InsuranceScenario {
  id: string;
  address: string;
  savedAt: string;
  annualPremium?: number;
  coverageType?: string;
}

export function getInsuranceScenarios(): InsuranceScenario[] {
  try { return JSON.parse(localStorage.getItem("tateo_insurance_scenarios") || "[]"); }
  catch { return []; }
}

export function saveInsuranceScenarios(s: InsuranceScenario[]) {
  try { localStorage.setItem("tateo_insurance_scenarios", JSON.stringify(s)); } catch {}
}
