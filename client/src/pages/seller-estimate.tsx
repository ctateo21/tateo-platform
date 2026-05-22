import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft, MapPin, Save, AlertCircle, Loader2, ImageOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import {
  getSellerScenarios, saveSellerScenarios,
  type SellerScenario, type SellerScenarioStatus,
} from "@/lib/auth";
import { normalizePropertyKey } from "@/lib/property-key";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Helpers ────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `seller_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const STATUS_OPTIONS: { value: SellerScenarioStatus; label: string }[] = [
  { value: "draft",         label: "Draft" },
  { value: "reviewing",     label: "Reviewing" },
  { value: "ready_to_list", label: "Ready to List" },
  { value: "listed",        label: "Listed" },
  { value: "sold",          label: "Sold" },
];

function netProceedsOf(s: Pick<SellerScenario,
  "estimatedSalePrice" | "mortgagePayoff" | "sellerClosingCosts" |
  "realtorCommissionPct" | "buyerConcessions" | "repairBudget" | "otherSellingCosts"
>): number {
  const sale = s.estimatedSalePrice ?? 0;
  const commission = sale * ((s.realtorCommissionPct ?? 0) / 100);
  return Math.round(
    sale -
    (s.mortgagePayoff ?? 0) -
    (s.sellerClosingCosts ?? 0) -
    commission -
    (s.buyerConcessions ?? 0) -
    (s.repairBudget ?? 0) -
    (s.otherSellingCosts ?? 0)
  );
}

// ─── Small numeric slider+input row (lightweight, no external dep) ──

interface NumRowProps {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

function NumRow({ label, hint, value, onChange, min, max, step = 1, prefix, suffix, decimals = 0 }: NumRowProps) {
  const [text, setText] = useState<string>(() =>
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString("en-US")
  );
  const focused = useRef(false);

  useEffect(() => {
    if (focused.current) return;
    setText(decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString("en-US"));
  }, [value, decimals]);

  function commit(raw: string) {
    const n = parseFloat(raw.replace(/,/g, ""));
    if (Number.isNaN(n)) return;
    const rounded = decimals > 0 ? parseFloat(n.toFixed(decimals)) : Math.round(n);
    onChange(Math.min(max, Math.max(min, rounded)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Label className="text-xs font-medium">{label}</Label>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <div className="flex items-center gap-0.5 bg-muted rounded-md px-2 py-1 min-w-[120px]">
          {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
          <input
            className="w-full bg-transparent text-xs font-semibold text-right outline-none min-w-0"
            value={text}
            inputMode="decimal"
            onFocus={e => { focused.current = true; e.target.select(); }}
            onChange={e => { setText(e.target.value); commit(e.target.value); }}
            onBlur={() => {
              focused.current = false;
              setText(decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString("en-US"));
            }}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          />
          {suffix && <span className="text-xs text-muted-foreground ml-0.5">{suffix}</span>}
        </div>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[Math.min(max, Math.max(min, value))]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export default function SellerEstimatePage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const { toast } = useToast();

  const { addressFromUrl, idFromUrl } = useMemo(() => {
    const p = new URLSearchParams(search);
    return {
      addressFromUrl: p.get("address") ?? "",
      idFromUrl: p.get("id") ?? "",
    };
  }, [search]);

  // Resolve initial scenario: existing by id, else by address match, else new.
  const [scenario, setScenario] = useState<SellerScenario>(() => {
    const all = getSellerScenarios();
    const byId = idFromUrl ? all.find(s => s.id === idFromUrl) : undefined;
    if (byId) return byId;
    const byAddr = addressFromUrl
      ? all.find(s => s.address.toLowerCase().trim() === addressFromUrl.toLowerCase().trim())
      : undefined;
    if (byAddr) return byAddr;
    return {
      id: makeId(),
      address: addressFromUrl || "Unknown Address",
      normalizedPropertyKey: addressFromUrl ? normalizePropertyKey(addressFromUrl).key || undefined : undefined,
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      realtorCommissionPct: 6,
      sellerClosingCosts: 0,
      buyerConcessions: 0,
      repairBudget: 0,
      otherSellingCosts: 0,
      mortgagePayoff: 0,
      status: "draft",
    };
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [zillowStatus, setZillowStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const zillowTriedRef = useRef(false);
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // If the user wasn't signed in when they came here, kick them home — the
  // seller dashboard is auth-gated like the other tabs.
  useEffect(() => {
    if (!isAuthenticated) {
      // Soft fallback: still let them play with the calculator, but don't try
      // to persist. Showing a small inline notice below the form is enough.
    }
  }, [isAuthenticated]);

  // ── Background Zillow pre-fill ────────────────────────────────────
  // Fire once per address on this page; skip when the user already has a
  // sale price set OR when the address is the "Unknown Address" sentinel.
  useEffect(() => {
    if (zillowTriedRef.current) return;
    if (!scenario.address || scenario.address === "Unknown Address") return;
    zillowTriedRef.current = true;

    const hasPrice = scenario.estimatedSalePrice != null && scenario.estimatedSalePrice > 0;
    const hasPhoto = !!scenario.primaryPhotoUrl;
    if (hasPrice && hasPhoto) {
      // Nothing meaningful left to fetch.
      return;
    }

    setZillowStatus("loading");
    (async () => {
      try {
        const res = await apiRequest("POST", "/api/zillow-property-lookup", { addressOrUrl: scenario.address });
        const body = await res.json();
        const p = body?.property;
        if (!isMountedRef.current) return;
        if (!p) { setZillowStatus("error"); return; }
        // Sale-side price priority: home-value Zestimate first (per task spec
        // — never the rent Zestimate), then the cached estimatedHomeValue,
        // then any explicit listing/purchase price on the cache row.
        const zPrice =
          (typeof p.zestimate === "number" && p.zestimate) ||
          (typeof p.estimatedHomeValue === "number" && p.estimatedHomeValue) ||
          (typeof p.listingPrice === "number" && p.listingPrice) ||
          (typeof p.purchasePrice === "number" && p.purchasePrice) ||
          null;
        const photos = Array.isArray(p.photos) ? p.photos.filter((x: any) => typeof x === "string") : [];

        setScenario(prev => {
          // Only fill fields the user hasn't already set.
          const next: SellerScenario = { ...prev };
          if ((next.estimatedSalePrice == null || next.estimatedSalePrice === 0) && zPrice != null) {
            next.estimatedSalePrice = Math.round(zPrice);
          }
          if (!next.primaryPhotoUrl && photos[0]) {
            next.primaryPhotoUrl = photos[0];
            next.propertyPhotos = photos.slice(0, 8);
          }
          next.updatedAt = new Date().toISOString();
          return next;
        });
        setZillowStatus("loaded");
        if (zPrice != null) {
          toast({
            title: "Property data loaded",
            description: `Estimated sale price set to ${formatCurrency(Math.round(zPrice))}.`,
          });
        }
      } catch (err) {
        console.warn("[seller] zillow lookup failed:", err);
        if (isMountedRef.current) setZillowStatus("error");
      }
    })();
  }, [scenario.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced auto-save ───────────────────────────────────────────
  // Guards (in order):
  //   1. Skip the initial render — there's nothing user-driven to persist yet.
  //   2. Require an authenticated session — anonymous visitors can play with
  //      the calculator but we never write anything for them.
  //   3. Refuse to persist a placeholder "Unknown Address" scenario.
  //      Otherwise landing on `/seller` with no query params would silently
  //      pollute the dashboard with an unnamed row.
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    if (!isAuthenticated) return;
    if (!scenario.address || scenario.address === "Unknown Address") return;
    setSaveStatus("saving");
    const t = window.setTimeout(() => {
      try {
        // Always read the cache fresh inside the timer so we pick up any
        // writes that landed between the change and this fire (other tab,
        // background hydration, etc.) before we delete-then-upsert.
        const all = getSellerScenarios();
        const stamped: SellerScenario = {
          ...scenario,
          updatedAt: new Date().toISOString(),
          netProceeds: netProceedsOf(scenario),
        };
        const idx = all.findIndex(s => s.id === stamped.id);
        const next = idx >= 0
          ? all.map(s => s.id === stamped.id ? stamped : s)
          : [stamped, ...all];
        saveSellerScenarios(next);
        if (isMountedRef.current) {
          setSaveStatus("saved");
          window.setTimeout(() => {
            if (isMountedRef.current) setSaveStatus(s => (s === "saved" ? "idle" : s));
          }, 1500);
        }
      } catch (err) {
        console.warn("[seller] auto-save failed:", err);
        if (isMountedRef.current) setSaveStatus("error");
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [scenario, isAuthenticated]);

  function update<K extends keyof SellerScenario>(field: K, value: SellerScenario[K]) {
    setScenario(prev => ({ ...prev, [field]: value }));
  }

  const sale = scenario.estimatedSalePrice ?? 0;
  const commissionPct = scenario.realtorCommissionPct ?? 0;
  const commissionDollars = Math.round(sale * (commissionPct / 100));
  const net = netProceedsOf(scenario);

  const sliderMax = Math.max(2_000_000, Math.round((sale || 500_000) * 2));

  return (
    <div className="min-h-screen bg-muted/30">
      <Helmet>
        <title>Seller Net Proceeds — {scenario.address.split(",")[0]}</title>
      </Helmet>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 -ml-2"
            onClick={() => setLocation("/dashboard?tab=sellers")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Sellers
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {saveStatus === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>)}
            {saveStatus === "saved"  && (<><Save className="h-3 w-3 text-green-600" /> Saved</>)}
            {saveStatus === "error"  && (<><AlertCircle className="h-3 w-3 text-destructive" /> Save failed</>)}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: address + photo + status */}
          <Card className="lg:col-span-1 self-start">
            <CardContent className="p-0 overflow-hidden rounded-lg">
              <div className="aspect-[4/3] bg-muted flex items-center justify-center relative">
                {scenario.primaryPhotoUrl ? (
                  <img
                    src={scenario.primaryPhotoUrl}
                    alt={scenario.address}
                    className="w-full h-full object-cover"
                    onError={e => {
                      const img = e.currentTarget as HTMLImageElement;
                      img.style.display = "none";
                      const fallback = img.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="absolute inset-0 flex-col items-center justify-center text-muted-foreground gap-2"
                  style={{ display: scenario.primaryPhotoUrl ? "none" : "flex" }}
                >
                  {zillowStatus === "loading" ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-xs">Looking up property…</span>
                    </>
                  ) : (
                    <>
                      <ImageOff className="h-8 w-8" />
                      <span className="text-xs">No photo available</span>
                    </>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold leading-snug">{scenario.address}</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select
                    value={scenario.status}
                    onValueChange={v => update("status", v as SellerScenarioStatus)}
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!isAuthenticated && (
                  <div className="flex gap-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>Sign in to save this scenario to your dashboard.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: calculator */}
          <div className="lg:col-span-2 space-y-4">
            {/* Net proceeds — primary KPI */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Net Proceeds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className={`text-4xl font-bold ${net >= 0 ? "text-green-700" : "text-destructive"}`}>
                    {formatCurrency(net)}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Sale {formatCurrency(sale)} − Costs {formatCurrency(sale - net)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  After mortgage payoff, agent commission, closing costs, concessions, and repairs.
                </p>
              </CardContent>
            </Card>

            {/* Inputs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sale &amp; Costs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <NumRow
                  label="Estimated Sale Price"
                  hint={zillowStatus === "loaded" ? "Pre-filled from Zillow — adjust to your target." : undefined}
                  value={sale}
                  onChange={v => update("estimatedSalePrice", v)}
                  min={0}
                  max={sliderMax}
                  step={1000}
                  prefix="$"
                />
                <NumRow
                  label="Mortgage Payoff Balance"
                  hint="What you still owe on the home today."
                  value={scenario.mortgagePayoff ?? 0}
                  onChange={v => update("mortgagePayoff", v)}
                  min={0}
                  max={sliderMax}
                  step={1000}
                  prefix="$"
                />
                <NumRow
                  label="Realtor Commission"
                  hint={`≈ ${formatCurrency(commissionDollars)} at ${commissionPct.toFixed(1)}%`}
                  value={commissionPct}
                  onChange={v => update("realtorCommissionPct", v)}
                  min={0}
                  max={10}
                  step={0.1}
                  suffix="%"
                  decimals={1}
                />
                <NumRow
                  label="Seller Closing Costs"
                  hint="Title, escrow, transfer taxes, document fees."
                  value={scenario.sellerClosingCosts ?? 0}
                  onChange={v => update("sellerClosingCosts", v)}
                  min={0}
                  max={50000}
                  step={250}
                  prefix="$"
                />
                <NumRow
                  label="Buyer Concessions"
                  hint="Credits you may offer the buyer at closing."
                  value={scenario.buyerConcessions ?? 0}
                  onChange={v => update("buyerConcessions", v)}
                  min={0}
                  max={50000}
                  step={250}
                  prefix="$"
                />
                <NumRow
                  label="Repair Budget"
                  hint="Pre-list repairs or post-inspection credits."
                  value={scenario.repairBudget ?? 0}
                  onChange={v => update("repairBudget", v)}
                  min={0}
                  max={100000}
                  step={250}
                  prefix="$"
                />
                <NumRow
                  label="Other Selling Costs"
                  hint="Staging, professional photos, moving expenses, etc."
                  value={scenario.otherSellingCosts ?? 0}
                  onChange={v => update("otherSellingCosts", v)}
                  min={0}
                  max={50000}
                  step={250}
                  prefix="$"
                />
              </CardContent>
            </Card>

            {/* Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="text-sm divide-y">
                  <Row label="Estimated Sale Price"   value={formatCurrency(sale)} positive />
                  <Row label="Mortgage Payoff"        value={`− ${formatCurrency(scenario.mortgagePayoff ?? 0)}`} />
                  <Row label={`Realtor Commission (${commissionPct.toFixed(1)}%)`} value={`− ${formatCurrency(commissionDollars)}`} />
                  <Row label="Seller Closing Costs"   value={`− ${formatCurrency(scenario.sellerClosingCosts ?? 0)}`} />
                  <Row label="Buyer Concessions"      value={`− ${formatCurrency(scenario.buyerConcessions ?? 0)}`} />
                  <Row label="Repair Budget"          value={`− ${formatCurrency(scenario.repairBudget ?? 0)}`} />
                  <Row label="Other Selling Costs"    value={`− ${formatCurrency(scenario.otherSellingCosts ?? 0)}`} />
                  <div className="flex items-center justify-between py-2 font-semibold">
                    <span>Net Proceeds</span>
                    <span className={net >= 0 ? "text-green-700" : "text-destructive"}>
                      {formatCurrency(net)}
                    </span>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={positive ? "font-medium" : ""}>{value}</span>
    </div>
  );
}
