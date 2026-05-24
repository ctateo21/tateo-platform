import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export type AlertScenarioType = "purchase" | "refinance" | "cash_buy" | "seller";
export type AlertType = "rate_drop" | "price_drop";

export interface AlertBellProps {
  scenarioId: string;
  scenarioType: AlertScenarioType;
  /** Which alert types are offered for this scenario. */
  availableAlertTypes: AlertType[];
  propertyAddress: string;
  /** Loan/program context used for rate-drop comparisons. */
  loanType?: string;
  loanTermYears?: number;
  occupancyType?: string;
  creditScore?: number;
  ltv?: number;
  /** Latest known listing/purchase price. Seeds `initial_watched_price`
   *  when the user first enables a price-drop alert. */
  currentPrice?: number;
  /** Optional Zillow URL / zpid / normalized key to help the scheduled
   *  job locate the property without re-parsing the address. */
  zillowUrl?: string;
  zpid?: string;
  normalizedPropertyKey?: string;
}

interface Subscription {
  id: string;
  scenario_id: string;
  scenario_type: AlertScenarioType;
  alert_type: AlertType;
  is_active: boolean;
  target_rate: number | null;
  initial_watched_price: number | null;
  last_seen_price: number | null;
}

async function authedFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function AlertBell(props: AlertBellProps) {
  const {
    scenarioId, scenarioType, availableAlertTypes,
    propertyAddress, currentPrice,
  } = props;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const queryKey = ["/api/property-alerts", scenarioId, scenarioType] as const;
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await authedFetch(
        `/api/property-alerts?scenarioId=${encodeURIComponent(scenarioId)}&scenarioType=${scenarioType}`,
      );
      return (res.subscriptions ?? []) as Subscription[];
    },
    staleTime: 60_000,
  });

  const subs = data ?? [];
  const rateSub = subs.find((s) => s.alert_type === "rate_drop" && s.is_active);
  const priceSub = subs.find((s) => s.alert_type === "price_drop" && s.is_active);
  const hasActive = !!(rateSub || priceSub);

  // Local form state — synced when dialog opens.
  const [rateEnabled, setRateEnabled] = useState(false);
  const [targetRateStr, setTargetRateStr] = useState("");
  const [priceEnabled, setPriceEnabled] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRateEnabled(!!rateSub);
    setTargetRateStr(rateSub?.target_rate != null ? rateSub.target_rate.toFixed(3) : "");
    setPriceEnabled(!!priceSub);
  }, [open, rateSub?.id, priceSub?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const offersRate = availableAlertTypes.includes("rate_drop");
  const offersPrice = availableAlertTypes.includes("price_drop");

  const upsert = useMutation({
    mutationFn: async (body: any) =>
      authedFetch("/api/property-alerts", { method: "POST", body: JSON.stringify(body) }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      authedFetch(`/api/property-alerts/${id}`, { method: "DELETE" }),
  });

  const targetRateNum = useMemo(() => {
    const n = parseFloat(targetRateStr);
    return Number.isFinite(n) ? n : NaN;
  }, [targetRateStr]);

  async function handleSave() {
    try {
      // Rate alert side
      if (offersRate) {
        if (rateEnabled) {
          if (!Number.isFinite(targetRateNum) || targetRateNum <= 0 || targetRateNum > 25) {
            toast({
              title: "Enter a valid target rate",
              description: "Target rate must be greater than 0 and at most 25%.",
              variant: "destructive",
            });
            return;
          }
          await upsert.mutateAsync({
            scenarioId, scenarioType, alertType: "rate_drop", isActive: true,
            targetRate: targetRateNum,
            propertyAddress,
            loanType: props.loanType, loanTermYears: props.loanTermYears,
            occupancyType: props.occupancyType, creditScore: props.creditScore, ltv: props.ltv,
            normalizedPropertyKey: props.normalizedPropertyKey,
            zpid: props.zpid, zillowUrl: props.zillowUrl,
          });
        } else if (rateSub) {
          await remove.mutateAsync(rateSub.id);
        }
      }
      // Price alert side
      if (offersPrice) {
        if (priceEnabled) {
          await upsert.mutateAsync({
            scenarioId, scenarioType, alertType: "price_drop", isActive: true,
            propertyAddress,
            initialWatchedPrice: currentPrice && currentPrice > 0 ? currentPrice : undefined,
            normalizedPropertyKey: props.normalizedPropertyKey,
            zpid: props.zpid, zillowUrl: props.zillowUrl,
          });
        } else if (priceSub) {
          await remove.mutateAsync(priceSub.id);
        }
      }
      await qc.invalidateQueries({ queryKey });
      setOpen(false);
      toast({ title: "Alerts updated" });
    } catch (e: any) {
      toast({ title: "Couldn't save alerts", description: e?.message ?? "", variant: "destructive" });
    }
  }

  const saving = upsert.isPending || remove.isPending;
  const Icon = hasActive ? BellRing : Bell;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className={`px-2 ${hasActive ? "text-primary" : "text-muted-foreground"}`}
          onClick={(e) => e.stopPropagation()}
          title="Set alerts"
          aria-label="Set alerts"
          data-testid={`button-alert-bell-${scenarioType}-${scenarioId}`}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Set alerts for this property</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-6 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5 py-1">
            {offersRate && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`rate-${scenarioId}`} className="text-sm font-medium">
                    Interest rate drop alert
                  </Label>
                  <Switch
                    id={`rate-${scenarioId}`}
                    checked={rateEnabled}
                    onCheckedChange={setRateEnabled}
                  />
                </div>
                {rateEnabled && (
                  <div className="space-y-1.5">
                    <Label htmlFor={`target-rate-${scenarioId}`} className="text-xs text-muted-foreground">
                      Notify me when rates drop to
                    </Label>
                    <div className="relative">
                      <Input
                        id={`target-rate-${scenarioId}`}
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        min="0"
                        max="25"
                        placeholder="6.250"
                        value={targetRateStr}
                        onChange={(e) => setTargetRateStr(e.target.value)}
                        className="pr-7"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                    {rateSub && (
                      <p className="text-xs text-muted-foreground">
                        Active at {rateSub.target_rate?.toFixed(3)}%
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {offersPrice && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`price-${scenarioId}`} className="text-sm font-medium">
                    Price drop alert
                  </Label>
                  <Switch
                    id={`price-${scenarioId}`}
                    checked={priceEnabled}
                    onCheckedChange={setPriceEnabled}
                  />
                </div>
                {priceEnabled && (
                  <p className="text-xs text-muted-foreground">
                    {priceSub
                      ? `Watching from $${(priceSub.initial_watched_price ?? 0).toLocaleString()}. We'll notify you when the listing price drops below the last seen price.`
                      : currentPrice && currentPrice > 0
                        ? `Starting watch at $${Math.round(currentPrice).toLocaleString()}.`
                        : "We'll start watching from the next price we see on Zillow."}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save alerts
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
