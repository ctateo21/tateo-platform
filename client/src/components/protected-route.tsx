import { useState, type ReactNode } from "react";
import { Redirect } from "wouter";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import AuthDialog from "@/components/ui/auth-dialog";

function CenterSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

// Gate that requires both a signed-in user and an active Havo Pro
// subscription. Not signed in → inline sign-in prompt. Signed in but
// not subscribed → redirect to /subscribe.
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const sub = useSubscription();
  const [authOpen, setAuthOpen] = useState(false);

  if (authLoading) return <CenterSpinner />;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <div className="rounded-full bg-muted p-4 mb-5">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Sign in to continue</h1>
        <p className="text-muted-foreground max-w-md mb-6">
          Create an account or sign in to access Havo's tools.
        </p>
        <Button size="lg" onClick={() => setAuthOpen(true)}>
          Sign In / Create Account
        </Button>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  if (sub.isLoading) return <CenterSpinner />;

  if (!sub.data?.active) {
    return <Redirect to="/subscribe" />;
  }

  return <>{children}</>;
}
