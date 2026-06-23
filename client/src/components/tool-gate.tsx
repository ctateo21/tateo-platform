import { useEffect, useState, type ReactNode } from "react";
import { Redirect, useSearch } from "wouter";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import AuthDialog from "@/components/ui/auth-dialog";

// localStorage key remembering the ONE home an anonymous visitor is
// allowed to quote for free. Once set, any other home prompts sign-up.
const FREE_ADDRESS_KEY = "havo_free_address";

function normalizeAddress(a: string): string {
  return a.trim().toLowerCase().replace(/\s+/g, " ");
}

function readFreeAddress(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(FREE_ADDRESS_KEY);
  } catch {
    return null;
  }
}

function CenterSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

/**
 * Gate for the five quote tools (Purchase with Loan/Cash, Refinance,
 * Insurance, Sell Your Home). Three tiers:
 *
 *  - Signed in + active Havo Pro (trialing or paid) → full access.
 *  - Signed in but no active subscription → sent to /subscribe to start
 *    their 7-day free trial.
 *  - Not signed in → one free home. The first home they open is
 *    remembered; they can use any tool on that home, but a second home
 *    (or saving/sending, which ScenarioActions already gates) requires
 *    creating an account.
 */
export default function ToolGate({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const sub = useSubscription();
  const search = useSearch();
  const [authOpen, setAuthOpen] = useState(false);

  const currentAddress = normalizeAddress(
    new URLSearchParams(search).get("address") || "",
  );
  const freeAddress = readFreeAddress();

  // For an anonymous visitor, claim the first home they open as their
  // free quote. Done in an effect so it runs once the view mounts.
  useEffect(() => {
    if (authLoading || user) return;
    if (!currentAddress || freeAddress) return;
    try {
      localStorage.setItem(FREE_ADDRESS_KEY, currentAddress);
    } catch {
      /* ignore storage failures */
    }
  }, [authLoading, user, currentAddress, freeAddress]);

  if (authLoading) return <CenterSpinner />;

  // Signed-in users get full tool access. With FREE_ACCESS_MODE on,
  // useSubscription reports active without any Stripe call; the
  // subscription redirect below is preserved for paid mode.
  if (user) {
    if (sub.isLoading) return <CenterSpinner />;
    if (!sub.data?.active) return <Redirect to="/subscribe" />;
    return <>{children}</>;
  }

  // Anonymous: before any home is claimed, allow access — the effect
  // above claims the first address-bearing view they open. Once a home
  // is claimed, ONLY that exact home stays free; a different home, or a
  // tool opened without an address, requires creating an account. (The
  // ?address param stays in sync with in-page changes, so switching the
  // property re-runs this gate.)
  if (!freeAddress) return <>{children}</>;
  if (currentAddress && currentAddress === freeAddress) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
      <div className="rounded-full bg-muted p-4 mb-5">
        <Lock className="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold mb-2">You've used your free quote</h1>
      <p className="text-muted-foreground max-w-md mb-6">
        Create a free account to quote more homes, save your numbers, and
        download or send estimates. No credit card required.
      </p>
      <Button size="lg" onClick={() => setAuthOpen(true)}>
        Create free account
      </Button>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab="register" />
    </div>
  );
}
