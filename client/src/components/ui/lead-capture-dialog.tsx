import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Phone, KeyRound, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "share" | "save";
  address?: string;
  onSuccess: () => void;
}

type Step = "credentials" | "phone" | "verify" | "done";

export default function LeadCaptureDialog({
  open,
  onOpenChange,
  action,
  address,
  onSuccess,
}: LeadCaptureDialogProps) {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("credentials");
      setEmail("");
      setPassword("");
      setPhone("");
      setCode("");
      setDevCode(null);
      setError("");
      setCountdown(0);
    }
  }, [open]);

  // Focus code input when we reach verify step
  useEffect(() => {
    if (step === "verify") {
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  }, [step]);

  function startCountdown() {
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  async function handleCredentialsNext() {
    setError("");
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setStep("phone");
  }

  async function handleSendCode() {
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/leads/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      if (data.devCode) setDevCode(data.devCode);
      setStep("verify");
      startCountdown();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setError("");
    setCode("");
    const digits = phone.replace(/\D/g, "");
    setSending(true);
    try {
      const res = await fetch("/api/leads/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend code");
      if (data.devCode) setDevCode(data.devCode);
      startCountdown();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    setError("");
    if (code.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/leads/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone: phone.replace(/\D/g, ""), code, address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setStep("done");
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 1800);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  }

  const title = action === "share" ? "Share Your Estimate" : "Save This Scenario";
  const subtitle =
    action === "share"
      ? "Create a free account to get a shareable link for this estimate."
      : "Create a free account to save and revisit this scenario anytime.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription className="text-sm">{subtitle}</DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-2">
          {(["credentials", "phone", "verify"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === "done" || (["credentials","phone","verify"].indexOf(step) > i)
                    ? "bg-primary text-white"
                    : step === s
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {(step === "done" || (["credentials","phone","verify"].indexOf(step) > i)) && step !== s ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && <div className={`flex-1 h-px w-8 ${["credentials","phone","verify"].indexOf(step) > i ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-1">
            {step === "credentials" && "Account Info"}
            {step === "phone" && "Phone Number"}
            {step === "verify" && "Verify Code"}
            {step === "done" && "Complete"}
          </span>
        </div>

        {/* ── Step 1: Email + Password ── */}
        {step === "credentials" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lc-email" className="text-sm">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lc-email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCredentialsNext()}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lc-password" className="text-sm">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lc-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  className="pl-9 pr-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCredentialsNext()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleCredentialsNext}>
              Continue
            </Button>
          </div>
        )}

        {/* ── Step 2: Phone Number ── */}
        {step === "phone" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lc-phone" className="text-sm">Mobile Phone Number</Label>
              <p className="text-xs text-muted-foreground">We'll send a 6-digit verification code via SMS.</p>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lc-phone"
                  type="tel"
                  placeholder="(555) 000-0000"
                  className="pl-9"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setError(""); setStep("credentials"); }}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleSendCode} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Send Code
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Verify Code ── */}
        {step === "verify" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lc-code" className="text-sm">Verification Code</Label>
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code sent to{" "}
                <span className="font-medium text-foreground">{phone}</span>.
                {devCode && (
                  <span className="ml-1 text-amber-600 font-semibold">[Dev mode — code: {devCode}]</span>
                )}
              </p>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lc-code"
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  className="pl-9 text-xl tracking-[0.4em] font-mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <button
                className={`text-primary hover:underline ${countdown > 0 ? "opacity-40 cursor-not-allowed" : ""}`}
                onClick={handleResend}
                disabled={countdown > 0 || sending}
              >
                {sending ? "Resending…" : countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
              </button>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => { setError(""); setStep("phone"); }}>
                Change number
              </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleVerify} disabled={verifying || code.length !== 6}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Verify &amp; {action === "share" ? "Get Link" : "Save"}
            </Button>
          </div>
        )}

        {/* ── Done ── */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-base">
              {action === "share" ? "Link copied to clipboard!" : "Scenario saved!"}
            </p>
            <p className="text-sm text-muted-foreground text-center">
              {action === "share"
                ? "Your estimate link has been copied. Share it with anyone."
                : "Your scenario has been saved to your account."}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
