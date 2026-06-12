import { useState } from "react";
import { Link } from "wouter";
import { Check, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { authedFetch } from "@/lib/authed-fetch";
import AuthDialog from "@/components/ui/auth-dialog";

const FEATURES = [
  "Property purchase & cash-buy estimates",
  "Refinance analysis",
  "Insurance quotes & comparisons",
  "Sell-your-home net proceeds",
  "Saved scenarios dashboard & alerts",
];

export default function Subscribe() {
  const { user, isLoading: authLoading } = useAuth();
  const sub = useSubscription();
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  async function handleSubscribe() {
    setStarting(true);
    try {
      const res = await authedFetch("/api/subscription/create-checkout-session", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout");
      }
      window.location.href = data.url;
    } catch (e: any) {
      setStarting(false);
      toast({
        title: "Something went wrong",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    }
  }

  const isSubscribed = !!sub.data?.active;

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Havo Pro</h1>
        <p className="text-muted-foreground">
          One simple plan. Full access to every tool.
        </p>
      </div>

      <Card className="border-2 border-primary/30 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold">$20</span>
            <span className="text-muted-foreground">/month</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">{f}</span>
              </li>
            ))}
          </ul>

          {authLoading || (user && sub.isLoading) ? (
            <Button className="w-full" size="lg" disabled>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading…
            </Button>
          ) : isSubscribed ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-primary font-medium">
                You're subscribed — you have full access.
              </p>
              <Button className="w-full" size="lg" asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          ) : !user ? (
            <div className="space-y-3">
              <Button className="w-full" size="lg" onClick={() => setAuthOpen(true)}>
                <Lock className="h-4 w-4 mr-2" />
                Sign in to subscribe
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Create an account or sign in first, then subscribe.
              </p>
            </div>
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubscribe}
              disabled={starting}
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Redirecting…
                </>
              ) : (
                "Subscribe"
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center mt-6">
        Secure payment powered by Stripe. Cancel anytime.
      </p>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
