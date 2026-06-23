import { useQuery } from "@tanstack/react-query";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuth } from "@/context/auth-context";
import { FREE_ACCESS_MODE } from "@/lib/access";

export interface SubscriptionStatus {
  active: boolean;
  status: string;
  currentPeriodEnd?: number | null;
}

// Live subscription state for the signed-in user. The backend re-checks
// against Stripe on each call, so cancellations/renewals are reflected
// without webhooks. Disabled when no user is signed in.
//
// While FREE_ACCESS_MODE is on, every signed-in user reads as active with
// no Stripe call at all — payment enforcement is bypassed but the Stripe
// code path below stays intact for when paid mode is restored.
export function useSubscription() {
  const { user } = useAuth();
  return useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (FREE_ACCESS_MODE) {
        return { active: true, status: "free_access" };
      }
      const res = await authedFetch("/api/subscription/status");
      if (!res.ok) throw new Error("Failed to load subscription status");
      return res.json();
    },
    staleTime: 60_000,
  });
}
