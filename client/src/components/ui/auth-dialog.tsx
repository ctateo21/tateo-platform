import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { login, register, AGENTS, type AgentId } from "@/lib/auth";
import { useAuth } from "@/context/auth-context";
import { Users } from "lucide-react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "signin" | "register";
}

export default function AuthDialog({ open, onOpenChange, defaultTab = "signin" }: AuthDialogProps) {
  const { refresh } = useAuth();

  // Sign-in state
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siError, setSiError] = useState("");
  const [siLoading, setSiLoading] = useState(false);

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regAgent, setRegAgent] = useState<AgentId | null>(null);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  function formatPhone(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSiError("");
    setSiLoading(true);
    const result = login(siEmail, siPassword);
    setSiLoading(false);
    if (!result.ok) { setSiError(result.error || "Login failed."); return; }
    refresh();
    onOpenChange(false);
    // reset
    setSiEmail(""); setSiPassword("");
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    if (!regName.trim()) { setRegError("Please enter your name."); return; }
    const phoneDigits = regPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10) { setRegError("Please enter a valid 10-digit cell number."); return; }
    if (regPassword.length < 6) { setRegError("Password must be at least 6 characters."); return; }
    if (regPassword !== regConfirm) { setRegError("Passwords do not match."); return; }
    if (!regAgent) { setRegError("Please pick the agent you want to work with."); return; }
    const agentName = AGENTS.find(a => a.id === regAgent)?.name ?? "Team";
    setRegLoading(true);
    const result = register(regName, regEmail, regPassword, { phone: phoneDigits, agent: agentName });
    setRegLoading(false);
    if (!result.ok) { setRegError(result.error || "Registration failed."); return; }
    refresh();
    onOpenChange(false);
    // reset
    setRegName(""); setRegEmail(""); setRegPhone(""); setRegPassword(""); setRegConfirm(""); setRegAgent(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Tateo & Co</DialogTitle>
          <DialogDescription>
            Save and revisit your property scenarios anytime.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="register">Create Account</TabsTrigger>
          </TabsList>

          {/* ── Sign In ── */}
          <TabsContent value="signin" className="mt-4">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="si-email">Email</Label>
                <Input
                  id="si-email"
                  type="email"
                  placeholder="you@example.com"
                  value={siEmail}
                  onChange={e => setSiEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="si-password">Password</Label>
                <Input
                  id="si-password"
                  type="password"
                  placeholder="••••••••"
                  value={siPassword}
                  onChange={e => setSiPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {siError && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription>{siError}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={siLoading}>
                {siLoading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          {/* ── Create Account ── */}
          <TabsContent value="register" className="mt-4">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="reg-name">Full Name</Label>
                <Input
                  id="reg-name"
                  type="text"
                  placeholder="Jane Smith"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-phone">Cell Phone</Label>
                <Input
                  id="reg-phone"
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={regPhone}
                  onChange={e => setRegPhone(formatPhone(e.target.value))}
                  required
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-confirm">Confirm Password</Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Which agent would you like to work with?</Label>
                <p className="text-xs text-muted-foreground">You'll be assigned to them — we won't ask again.</p>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {AGENTS.map(agent => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setRegAgent(agent.id)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
                        regAgent === agent.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                        agent.id === "team" ? "bg-secondary" : "bg-primary"
                      }`}>
                        {agent.id === "team"
                          ? <Users className="h-4 w-4" />
                          : <span>{agent.initials}</span>
                        }
                      </div>
                      <span className="text-[10px] font-medium text-center leading-tight">{agent.name.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
              {regError && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription>{regError}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={regLoading}>
                {regLoading ? "Creating account…" : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
