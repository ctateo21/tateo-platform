import { useEffect, useRef, useState } from "react";
import { Share2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthDialog from "@/components/ui/auth-dialog";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

/**
 * Reusable Save + Share button pair for the five detail views
 * (Purchase with Cash, Purchase with Loan, Refinance, Insurance,
 * Sell Your Home).
 *
 * Share: copies the current page URL. Every detail view already
 * hydrates from URL params (address, ids, etc.) so the URL itself
 * is a working share link — same pattern Insurance already uses.
 *
 * Save: auth-gated. Logged-in users get an immediate "Scenario
 * saved" toast (the per-flow auto-save / explicit save runs the
 * actual Supabase persistence — Cash Buy / Estimate / Seller all
 * auto-save on every input change once `isAuthenticated` flips
 * true). Logged-out users see the existing `AuthDialog`; we
 * remember their intent and re-fire it once auth completes.
 *
 * No scenario state is touched here — the in-memory draft
 * (address, Zillow cache, calculations, loan-type selection, etc.)
 * lives in the parent page and survives the dialog open/close
 * because the dialog is rendered inside the same component tree.
 */
export interface ScenarioActionsProps {
  /** Flow type — used only for the toast copy + telemetry. */
  scenarioType: "cash_buy" | "purchase" | "refinance" | "insurance" | "seller";
  /**
   * Optional hook for an explicit "Save now" action. Most flows
   * auto-save and can leave this undefined — the auth gate + toast
   * are still wired up correctly. When provided, it's called for
   * logged-in users and after a successful auth-then-save replay.
   */
  onSave?: () => void | Promise<void>;
  /** Compact buttons (icon-only on narrow screens). Default true. */
  compact?: boolean;
}

const FLOW_LABEL: Record<ScenarioActionsProps["scenarioType"], string> = {
  cash_buy: "Cash Buy",
  purchase: "Purchase",
  refinance: "Refinance",
  insurance: "Insurance",
  seller: "Seller",
};

export default function ScenarioActions({
  scenarioType,
  onSave,
  compact = true,
}: ScenarioActionsProps) {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Action the user wanted to take before being prompted to log in.
   *  Replayed automatically once `isAuthenticated` flips true. */
  const pendingActionRef = useRef<"save" | "share" | null>(null);
  /** Snapshot of the `onSave` closure taken at click time, before
   *  the auth dialog opens. Replaying this exact reference (instead
   *  of the latest `onSave` prop) preserves the parent's pre-auth
   *  draft state — important for flows like Refinance whose local
   *  state is rehydrated from Supabase on login, which would
   *  otherwise overwrite the user's unsaved edits before the
   *  replayed save fires. */
  const pendingSaveSnapshotRef = useRef<(() => void | Promise<void>) | null>(null);

  async function doSave(saveFn?: (() => void | Promise<void>) | null) {
    setSaving(true);
    try {
      const fn = saveFn ?? onSave;
      if (fn) await fn();
      toast({
        title: "Scenario saved",
        description: `Your ${FLOW_LABEL[scenarioType]} scenario was saved to your dashboard.`,
      });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function doShare() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copied",
          description: "Share the URL with anyone to show this scenario.",
        });
      } catch {
        toast({
          title: "Could not copy",
          description: url,
        });
      }
    };
    void copy();
  }

  // Replay the pending action after the user finishes signing in.
  // Guarded by `pendingActionRef` so this only runs in response to
  // the user clicking Save/Share while logged out — never on a
  // normal "you happen to be logged in" page load.
  useEffect(() => {
    if (!isAuthenticated) return;
    const pending = pendingActionRef.current;
    if (!pending) return;
    pendingActionRef.current = null;
    if (pending === "save") {
      // Use the snapshot captured at click time so we save the
      // parent's pre-auth draft, not whatever state the parent
      // hydrated post-login.
      const snapshot = pendingSaveSnapshotRef.current;
      pendingSaveSnapshotRef.current = null;
      void doSave(snapshot);
    }
    if (pending === "share") doShare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  function handleSave() {
    if (!isAuthenticated) {
      pendingActionRef.current = "save";
      // Capture the current onSave closure so the replay after
      // login uses the parent's pre-auth draft state, not the
      // post-login hydrated state.
      pendingSaveSnapshotRef.current = onSave ?? null;
      setAuthOpen(true);
      return;
    }
    void doSave();
  }

  function handleShare() {
    // Share always copies the current URL — every detail view
    // already hydrates from URL params, so the URL is a working
    // link even before save. We still auth-gate per spec so the
    // link points at the saved scenario for logged-in users.
    if (!isAuthenticated) {
      pendingActionRef.current = "share";
      setAuthOpen(true);
      return;
    }
    doShare();
  }

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 sm:h-9"
          onClick={handleShare}
          data-testid={`button-share-${scenarioType}`}
          title="Copy link to this scenario"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className={compact ? "hidden sm:inline" : ""}>Share</span>
        </Button>
        <Button
          size="sm"
          className="gap-1.5 h-8 sm:h-9 bg-secondary hover:bg-secondary/90 text-white"
          onClick={handleSave}
          disabled={saving}
          data-testid={`button-save-${scenarioType}`}
          title={isAuthenticated ? "Save this scenario" : "Sign in to save"}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span className={compact ? "hidden sm:inline" : ""}>
            {saving ? "Saving…" : "Save Scenario"}
          </span>
        </Button>
      </div>

      <AuthDialog
        open={authOpen}
        onOpenChange={(next) => {
          // Clear any pending intent when the user dismisses the
          // dialog without finishing auth. Without this, a stale
          // intent could later replay if the user signs in via a
          // different surface (header menu, etc.) while this
          // component is still mounted.
          if (!next && !isAuthenticated) {
            pendingActionRef.current = null;
            pendingSaveSnapshotRef.current = null;
          }
          setAuthOpen(next);
        }}
        defaultTab="register"
      />
    </>
  );
}
