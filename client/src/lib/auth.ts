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
  agent?: string;  // display name e.g. "Christian Tateo"
  invitedUser?: InvitedUser;
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
    invitedUser: user.invitedUser,
    createdAt: user.createdAt,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Legacy flag kept for older components that check it
  try { localStorage.setItem("tateo_auth", "1"); } catch {}
}

export function updateProfile(
  currentEmail: string,
  updates: { name?: string; email?: string; phone?: string }
): { ok: boolean; error?: string } {
  const users = getStoredUsers();
  const key = currentEmail.toLowerCase().trim();
  const user = users[key];
  if (!user) return { ok: false, error: "Not signed in." };

  let newKey = key;
  const targetEmail = updates.email?.toLowerCase().trim();
  if (targetEmail && targetEmail !== key) {
    if (!targetEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return { ok: false, error: "Please enter a valid email address." };
    }
    if (users[targetEmail]) return { ok: false, error: "Another account already uses this email." };
    newKey = targetEmail;
    delete users[key];
  }

  if (updates.phone !== undefined) {
    const digits = updates.phone.replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 10) {
      return { ok: false, error: "Please enter a valid 10-digit phone number." };
    }
  }

  const updated: StoredUser = {
    ...user,
    name: updates.name?.trim() || user.name,
    email: newKey,
    phone: updates.phone !== undefined
      ? (updates.phone.replace(/\D/g, "") || undefined)
      : user.phone,
  };
  users[newKey] = updated;
  saveStoredUsers(users);
  writeSession(updated);
  return { ok: true };
}

export function updatePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): { ok: boolean; error?: string } {
  const users = getStoredUsers();
  const key = email.toLowerCase().trim();
  const user = users[key];
  if (!user) return { ok: false, error: "Not signed in." };
  if (user.password !== currentPassword) return { ok: false, error: "Current password is incorrect." };
  if (newPassword.length < 6) return { ok: false, error: "New password must be at least 6 characters." };
  users[key] = { ...user, password: newPassword };
  saveStoredUsers(users);
  return { ok: true };
}

export function inviteUser(
  email: string,
  inviteeName: string,
  inviteeEmail: string
): { ok: boolean; error?: string } {
  const users = getStoredUsers();
  const key = email.toLowerCase().trim();
  const user = users[key];
  if (!user) return { ok: false, error: "Not signed in." };
  if (!inviteeName.trim()) return { ok: false, error: "Please enter the invitee's full name." };
  const cleanEmail = inviteeEmail.toLowerCase().trim();
  if (!cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return { ok: false, error: "Please enter a valid email address for the invitee." };
  }
  if (cleanEmail === key) {
    return { ok: false, error: "You can't invite yourself." };
  }
  const updated: StoredUser = {
    ...user,
    invitedUser: {
      name: inviteeName.trim(),
      email: cleanEmail,
      invitedAt: new Date().toISOString(),
    },
  };
  users[key] = updated;
  saveStoredUsers(users);
  writeSession(updated);
  return { ok: true };
}

export function removeInvitedUser(email: string): { ok: boolean; error?: string } {
  const users = getStoredUsers();
  const key = email.toLowerCase().trim();
  const user = users[key];
  if (!user) return { ok: false, error: "Not signed in." };
  const { invitedUser, ...rest } = user;
  void invitedUser;
  users[key] = rest as StoredUser;
  saveStoredUsers(users);
  writeSession(users[key]);
  return { ok: true };
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
  // Extended details captured from the estimate page
  cashToClose?: number;
  dti?: number;            // 0..1 (total housing+debt DTI)
  qualifies?: boolean;
  downPaymentPct?: number;
  loanType?: string;
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
