import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft, MapPin, Save, AlertCircle, Loader2, Banknote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import {
  getCashBuyScenarios, saveCashBuyScenarios,
  type CashBuyScenario, type CashBuyOccupancyType, type SellerConcessionsMode,
} from "@/lib/auth";
import { normalizePropertyKey } from "@/lib/property-key";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cashbuy_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Seller concessions applied = raw concession capped at buyer closing costs.
// Cash buys have no loan-program cap (no FHA/VA/Conventional limits) — only
// the practical cap that concessions cannot exceed the buyer costs they offset.
function sellerConcessionsApplied(s: CashBuyScenario): number {
  const price = s.purchasePrice ?? 0;
  const closing = s.closingCosts ?? 0;
  const mode: SellerConcessionsMode = s.sellerConcessionsMode ?? "percent";
  const raw = mode === "amount"
    ? (s.sellerConcessionsAmount ?? 0)
    : price * ((s.sellerConcessionsPercent ?? 0) / 100);
  return Math.max(0, Math.min(raw, closing));
}

// Cash to close — no loan amount, no down payment, no monthly payment.
// Insurance + taxes + HOA are surfaced separately as ongoing costs and are
// NOT folded into the cash-to-close total in Phase 1. (Spec lists them as
// "if included" upfront items — we keep cash-to-close lean to avoid baking
// in unverified proration assumptions; this can be expanded in Phase 2.)
function cashToCloseOf(s: CashBuyScenario): number {
  const price = s.purchasePrice ?? 0;
  const closing = s.closingCosts ?? 0;
  return Math.max(0, Math.round(price + closing - sellerConcessionsApplied(s)));
}

// ─── Small numeric slider+input row ──────────────────────────────────

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
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString("en-US"),
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

// ─── Main page ───────────────────────────────────────────────────────

export default function CashBuyPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const { addressFromUrl, idFromUrl } = useMemo(() => {
    const p = new URLSearchParams(search);
    return {
      addressFromUrl: p.get("address") ?? "",
      idFromUrl: p.get("id") ?? "",
    };
  }, [search]);

  // Resolve initial scenario: existing by id → by address → new draft.
  const [scenario, setScenario] = useState<CashBuyScenario>(() => {
    const all = getCashBuyScenarios();
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
      purchasePrice: 0,
      occupancyType: "primary",
      propertyTaxes: 0,
      homeownersInsurance: 0,
      hoaMonthly: 0,
      closingCosts: 0,
      sellerConcessionsMode: "percent",
      sellerConcessionsPercent: 0,
      sellerConcessionsAmount: 0,
    };
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // Debounced auto-save (mirrors seller-estimate guards: skip first render,
  // require auth, refuse "Unknown Address" placeholder).
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    if (!isAuthenticated) return;
    if (!scenario.address || scenario.address === "Unknown Address") return;
    setSaveStatus("saving");
    const t = window.setTimeout(() => {
      try {
        const all = getCashBuyScenarios();
        const stamped: CashBuyScenario = {
          ...scenario,
          updatedAt: new Date().toISOString(),
          cashToClose: cashToCloseOf(scenario),
        };
        const idx = all.findIndex(s => s.id === stamped.id);
        const next = idx >= 0
          ? all.map(s => s.id === stamped.id ? stamped : s)
          : [stamped, ...all];
        saveCashBuyScenarios(next);
        if (isMountedRef.current) {
          setSaveStatus("saved");
          window.setTimeout(() => {
            if (isMountedRef.current) setSaveStatus(s => (s === "saved" ? "idle" : s));
          }, 1500);
        }
      } catch (err) {
        console.warn("[cash-buy] auto-save failed:", err);
        if (isMountedRef.current) setSaveStatus("error");
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [scenario, isAuthenticated]);

  function update<K extends keyof CashBuyScenario>(field: K, value: CashBuyScenario[K]) {
    setScenario(prev => ({ ...prev, [field]: value }));
  }

  const price = scenario.purchasePrice ?? 0;
  const closing = scenario.closingCosts ?? 0;
  const concessionApplied = sellerConcessionsApplied(scenario);
  const ctc = cashToCloseOf(scenario);
  const sliderMax = Math.max(2_000_000, Math.round((price || 500_000) * 2));
  const closingMax = Math.max(50_000, Math.round((price || 500_000) * 0.06));

  // Seller-concessions slider bounds depend on the active mode. Percent: 0–9
  // (cash has no loan-program cap; 9% is a generous practical ceiling — the
  // applied amount is independently capped at closing costs above). Dollar:
  // 0 → max of buyer closing costs (defaults to 1 if closing is 0 to keep
  // the slider operable).
  const concessionMode: SellerConcessionsMode = scenario.sellerConcessionsMode ?? "percent";
  const concessionMax = concessionMode === "amount"
    ? Math.max(1, closing || 1)
    : 9;

  const isPlaceholder = !scenario.address || scenario.address === "Unknown Address";

  return (
    <div className="min-h-screen bg-muted/30">
      <Helmet>
        <title>Cash Buy — {scenario.address.split(",")[0]}</title>
      </Helmet>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 -ml-2"
            onClick={() => setLocation("/dashboard?tab=cash_buy")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Cash Buy
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {!isAuthenticated && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" /> Sign in to save
              </span>
            )}
            {isAuthenticated && saveStatus === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>)}
            {isAuthenticated && saveStatus === "saved" && (<><Save className="h-3 w-3 text-green-600" /> Saved</>)}
            {isAuthenticated && saveStatus === "error" && (<><AlertCircle className="h-3 w-3 text-destructive" /> Save failed</>)}
          </div>
        </div>

        {/* Address + headline KPI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start mb-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{scenario.address}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              Cash purchase — no loan, no monthly mortgage payment. Adjust the
              numbers below to model your total cash required at closing.
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Banknote className="h-4 w-4 text-primary" /> Estimated Cash to Close
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary tabular-nums">{formatCurrency(ctc)}</p>
              <div className="mt-3 text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between"><span>Purchase price</span><span>{formatCurrency(price)}</span></div>
                <div className="flex justify-between"><span>+ Closing costs</span><span>{formatCurrency(closing)}</span></div>
                {concessionApplied > 0 && (
                  <div className="flex justify-between text-green-700"><span>− Seller concessions</span><span>−{formatCurrency(concessionApplied)}</span></div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Editable inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: purchase + occupancy + costs */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Real Estate</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <NumRow
                label="Purchase Price"
                value={price}
                onChange={v => update("purchasePrice", v)}
                min={0} max={sliderMax} step={1000} prefix="$"
              />

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Property Use</Label>
                <Select
                  value={scenario.occupancyType ?? "primary"}
                  onValueChange={(v) => update("occupancyType", v as CashBuyOccupancyType)}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary Residence</SelectItem>
                    <SelectItem value="secondary">Secondary Home</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <NumRow
                label="Estimated Closing Costs"
                hint="Title, recording, doc stamps, inspection, appraisal — buyer side."
                value={closing}
                onChange={v => update("closingCosts", v)}
                min={0} max={closingMax} step={100} prefix="$"
              />

              {/* Seller concessions — Percentage / Dollar Amount toggle */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-medium">Seller Concessions</Label>
                  <div className="flex rounded-md border bg-background text-[11px] overflow-hidden">
                    <button
                      type="button"
                      className={`px-2.5 py-1 ${concessionMode === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      onClick={() => update("sellerConcessionsMode", "percent")}
                    >
                      Percentage
                    </button>
                    <button
                      type="button"
                      className={`px-2.5 py-1 border-l ${concessionMode === "amount" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      onClick={() => update("sellerConcessionsMode", "amount")}
                    >
                      Dollar Amount
                    </button>
                  </div>
                </div>
                {concessionMode === "percent" ? (
                  <NumRow
                    label="Percent of Price"
                    hint="Seller credits are capped at your closing costs (concessions can't exceed costs they offset)."
                    value={scenario.sellerConcessionsPercent ?? 0}
                    onChange={v => update("sellerConcessionsPercent", v)}
                    min={0} max={concessionMax} step={0.05} suffix="%" decimals={2}
                  />
                ) : (
                  <NumRow
                    label="Dollar Amount"
                    hint="Seller credits are capped at your closing costs."
                    value={scenario.sellerConcessionsAmount ?? 0}
                    onChange={v => update("sellerConcessionsAmount", v)}
                    min={0} max={concessionMax} step={50} prefix="$"
                  />
                )}
                {concessionApplied > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Applied credit: <span className="font-semibold text-foreground">{formatCurrency(concessionApplied)}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: ongoing costs (taxes + insurance + HOA) */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ongoing Costs</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <NumRow
                label="Annual Property Taxes"
                hint="Estimated yearly property tax bill."
                value={scenario.propertyTaxes ?? 0}
                onChange={v => update("propertyTaxes", v)}
                min={0} max={50_000} step={50} prefix="$"
              />
              <NumRow
                label="Annual Homeowners Insurance"
                hint="Estimated yearly premium. Floods/wind handled in the Insurance tab."
                value={scenario.homeownersInsurance ?? 0}
                onChange={v => update("homeownersInsurance", v)}
                min={0} max={20_000} step={25} prefix="$"
              />
              <NumRow
                label="HOA / Condo Fees"
                value={scenario.hoaMonthly ?? 0}
                onChange={v => update("hoaMonthly", v)}
                min={0} max={2_000} step={5} prefix="$" suffix="/mo"
              />

              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Monthly carrying cost (estimate)</p>
                <p className="tabular-nums">
                  {formatCurrency(
                    Math.round(
                      ((scenario.propertyTaxes ?? 0) / 12) +
                      ((scenario.homeownersInsurance ?? 0) / 12) +
                      (scenario.hoaMonthly ?? 0),
                    ),
                  )}/mo
                </p>
                <p className="mt-1 text-[11px]">
                  Taxes + insurance + HOA only. No mortgage payment because there is no loan.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {isPlaceholder && (
          <div className="mt-4 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            Enter an address from the Cash Buy dashboard to save this scenario.
          </div>
        )}
      </div>
    </div>
  );
}
