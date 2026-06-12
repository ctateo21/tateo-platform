import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authedFetch } from "@/lib/authed-fetch";
import { queryClient } from "@/lib/queryClient";

type State = "confirming" | "success" | "error";

export default function SubscribeSuccess() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<State>("confirming");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setState("error");
      setMessage("Missing checkout session.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch("/api/subscription/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Could not confirm subscription");
        await queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
        setState("success");
        // Give the user a moment to read the confirmation, then send them in.
        setTimeout(() => { if (!cancelled) navigate("/dashboard"); }, 2000);
      } catch (e: any) {
        if (cancelled) return;
        setState("error");
        setMessage(e?.message || "Please try again.");
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="max-w-md mx-auto px-6 py-24 text-center">
      {state === "confirming" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Confirming your subscription…</h1>
          <p className="text-muted-foreground">This will only take a second.</p>
        </>
      )}
      {state === "success" && (
        <>
          <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-semibold mb-2">You're all set!</h1>
          <p className="text-muted-foreground mb-6">
            Welcome to Havo Pro. Taking you to your dashboard…
          </p>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </>
      )}
      {state === "error" && (
        <>
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-semibold mb-2">We couldn't confirm your payment</h1>
          <p className="text-muted-foreground mb-6">{message}</p>
          <Button asChild variant="outline">
            <Link href="/subscribe">Back to plans</Link>
          </Button>
        </>
      )}
    </div>
  );
}
