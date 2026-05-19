import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  updateProfile, updatePassword, inviteUser, removeInvitedUser,
} from "@/lib/auth";
import { User, Lock, UserPlus, Trash2, Loader2 } from "lucide-react";

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function Settings() {
  const { user, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) setLocation("/");
  }, [user, setLocation]);

  // ── Profile state ──────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(formatPhone(user?.phone ?? ""));
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Password state ─────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // ── Invite state ───────────────────────────────────────────────
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setPhone(formatPhone(user.phone ?? ""));
  }, [user]);

  if (!user) return null;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileSaving(true);
    const result = updateProfile(user!.email, { name, email, phone });
    setProfileSaving(false);
    if (!result.ok) { setProfileError(result.error || "Failed to update profile."); return; }
    refresh();
    toast({ title: "Profile updated", description: "Your account details are saved." });
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    setPwSaving(true);
    const result = updatePassword(user!.email, currentPw, newPw);
    setPwSaving(false);
    if (!result.ok) { setPwError(result.error || "Failed to update password."); return; }
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    toast({ title: "Password updated", description: "Use your new password next time you sign in." });
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSaving(true);

    // Push to FollowUpBoss first — only save locally if the server accepts it
    let fubOk = false;
    let fubError = "";
    try {
      const [first, ...rest] = (user!.name || "").trim().split(/\s+/);
      const inviterFirstName = first || user!.email.split("@")[0];
      const inviterLastName = rest.join(" ") || "-";
      const res = await fetch("/api/leads/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviterFirstName,
          inviterLastName,
          inviterEmail: user!.email,
          inviterPhone: user!.phone || "",
          agent: user!.agent || "Team",
          inviteeName: inviteeName.trim(),
          inviteeEmail: inviteeEmail.trim().toLowerCase(),
        }),
      });
      if (res.ok) {
        fubOk = true;
      } else {
        const data = await res.json().catch(() => ({}));
        fubError = data?.error || `Server error (${res.status}).`;
      }
    } catch (err: any) {
      fubError = err?.message || "Network error sending invite.";
    }

    if (!fubOk) {
      setInviteSaving(false);
      setInviteError(fubError || "Failed to send invite. Please try again.");
      return;
    }

    const result = inviteUser(user!.email, inviteeName, inviteeEmail);
    setInviteSaving(false);
    if (!result.ok) {
      setInviteError(result.error || "Failed to save invite locally.");
      return;
    }

    setInviteeName(""); setInviteeEmail("");
    refresh();
    toast({
      title: "Invite sent!",
      description: `${inviteeName.trim()} has been added to your account and your agent has been notified.`,
    });
  }

  function handleRemoveInvitee() {
    const result = removeInvitedUser(user!.email);
    if (!result.ok) {
      toast({ title: "Failed to remove", description: result.error, variant: "destructive" });
      return;
    }
    refresh();
    toast({ title: "Removed", description: "Shared user removed from your account." });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Helmet><title>Settings · Tateo & Co</title></Helmet>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account, password, and shared access.</p>
      </div>

      {/* ── Profile ── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5" /> Profile
          </CardTitle>
          <CardDescription>Update your name, email, and phone number.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-name">Full Name</Label>
              <Input id="set-name" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-email">Email Address</Label>
              <Input id="set-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-phone">Cell Phone</Label>
              <Input
                id="set-phone" type="tel" placeholder="(555) 000-0000"
                value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
              />
            </div>
            {user.agent && (
              <div className="text-xs text-muted-foreground">
                Working with <strong>{user.agent}</strong>
              </div>
            )}
            {profileError && (
              <Alert variant="destructive" className="py-2"><AlertDescription>{profileError}</AlertDescription></Alert>
            )}
            <Button type="submit" disabled={profileSaving}>
              {profileSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {profileSaving ? "Saving…" : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Password ── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Lock className="h-5 w-5" /> Password
          </CardTitle>
          <CardDescription>Change the password used to sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-current-pw">Current Password</Label>
              <Input id="set-current-pw" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-new-pw">New Password</Label>
              <Input id="set-new-pw" type="password" placeholder="At least 6 characters" value={newPw} onChange={e => setNewPw(e.target.value)} required autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-confirm-pw">Confirm New Password</Label>
              <Input id="set-confirm-pw" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required autoComplete="new-password" />
            </div>
            {pwError && (
              <Alert variant="destructive" className="py-2"><AlertDescription>{pwError}</AlertDescription></Alert>
            )}
            <Button type="submit" disabled={pwSaving}>
              {pwSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {pwSaving ? "Updating…" : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Shared Access ── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="h-5 w-5" /> Shared Account Access
          </CardTitle>
          <CardDescription>Invite one person (like a spouse or co-buyer) to share this account.</CardDescription>
        </CardHeader>
        <CardContent>
          {user.invitedUser ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div>
                  <p className="font-semibold">{user.invitedUser.name}</p>
                  <p className="text-sm text-muted-foreground">{user.invitedUser.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Invited {new Date(user.invitedUser.invitedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRemoveInvitee} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1.5" /> Remove
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Only one person can share your account. Remove this user to invite someone else.
              </p>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="set-invitee-name">Full Name</Label>
                <Input
                  id="set-invitee-name" placeholder="Jane Smith"
                  value={inviteeName} onChange={e => setInviteeName(e.target.value)} required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="set-invitee-email">Email Address</Label>
                <Input
                  id="set-invitee-email" type="email" placeholder="jane@example.com"
                  value={inviteeEmail} onChange={e => setInviteeEmail(e.target.value)} required
                />
              </div>
              {inviteError && (
                <Alert variant="destructive" className="py-2"><AlertDescription>{inviteError}</AlertDescription></Alert>
              )}
              <Button type="submit" disabled={inviteSaving}>
                {inviteSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                {inviteSaving ? "Sending invite…" : "Send Invite"}
              </Button>
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground">
                Your assigned agent will be notified and the invited person will be added to your agent's contact list.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
