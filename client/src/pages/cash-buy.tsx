import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft, MapPin, Save, AlertCircle, Loader2, Banknote, Camera, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext,
} from "@/components/ui/carousel";
import { useAuth } from "@/context/auth-context";
import {
  getCashBuyScenarios, saveCashBuyScenarios,
  type CashBuyScenario, type CashBuyOccupancyType, type SellerConcessionsMode,
  type CashBuyInsuranceFactors,
} from "@/lib/auth";
import { normalizePropertyKey } from "@/lib/property-key";
import { estimateAnnualTax } from "@/lib/county-tax-estimator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PropertyInsuranceSimulator, {
  DEFAULT_INSURANCE_FACTORS, getInsRegionFromAddress, calcInsurancePremium,
  type InsuranceFactors,
} from "@/components/insurance/property-insurance-simulator";

// ─── helpers ─────────────────────────────────────────────────────────

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

function sellerConcessionsApplied(s: CashBuyScenario): number {
  const price = s.purchasePrice ?? 0;
  const closing = s.closingCosts ?? 0;
  const mode: SellerConcessionsMode = s.sellerConcessionsMode ?? "percent";
  const raw = mode === "amount"
    ? (s.sellerConcessionsAmount ?? 0)
    : price * ((s.sellerConcessionsPercent ?? 0) / 100);
  return Math.max(0, Math.min(raw, closing));
}

/** Cash-to-close formula per spec:
 *  Purchase Price + Estimated Closing Costs − Seller Concessions.
 *  Taxes / insurance / HOA are surfaced separately as ongoing costs and
 *  intentionally NOT folded in (avoids baking unverified proration
 *  assumptions into the headline number). */
function cashToCloseOf(s: CashBuyScenario): number {
  const price = s.purchasePrice ?? 0;
  const closing = s.closingCosts ?? 0;
  return Math.max(0, Math.round(price + closing - sellerConcessionsApplied(s)));
}

/** Purchase-tab tax logic — same county-aware estimator, with primary vs
 *  non-primary homestead flag. Cash Buy has no VA flow, so the VA-disability
 *  branch in `computePropertyTax` is not applicable. */
function computeAnnualTaxes(address: string, price: number, occ: CashBuyOccupancyType): number {
  if (!address || price <= 0) return 0;
  return estimateAnnualTax(address, price, occ === "primary");
}

const DEFAULT_CLOSING_PERCENT = 2.0;

/** ─── Zillow LookedUpProperty shape — kept loose so server changes don't
 *  immediately break this page. Mirrors property-lookup-dialog. */
interface LookedUpPropertyLite {
  address?: string;
  zestimate?: number | null;
  listingPrice?: number | null;
  purchasePrice?: number | null;
  soldPrice?: number | null;
  isSold?: boolean;
  hoaMonthly?: number | null;
  photos?: string[];
}

function inferPriceSource(
  p: LookedUpPropertyLite, zPrice: number | null, fromCache: boolean,
): CashBuyScenario["purchasePriceSource"] {
  if (fromCache) return "zillow_cache";
  if (zPrice == null) return "zillow_zestimate";
  if (p.isSold && p.soldPrice != null && p.soldPrice === zPrice) return "zillow_sold";
  if (p.listingPrice != null && p.listingPrice === zPrice) return "zillow_listing";
  return "zillow_zestimate";
}

// ─── Number row (slider + numeric input) ─────────────────────────────

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
  badge?: React.ReactNode;
}

function NumRow({
  label, hint, value, onChange, min, max, step = 1,
  prefix, suffix, decimals = 0, badge,
}: NumRowProps) {
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
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs font-medium">{label}</Label>
            {badge}
          </div>
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

// ─── Photo block ─────────────────────────────────────────────────────

function PhotoCarousel({
  photos, primary, status,
}: {
  photos: string[]; primary?: string; status: "idle" | "loading" | "loaded" | "error";
}) {
  const all = useMemo(() => {
    const list = [primary, ...photos].filter((p): p is string => !!p);
    return Array.from(new Set(list));
  }, [photos, primary]);

  if (status === "loading" && all.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/40 aspect-[16/9] flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading property photos…
      </div>
    );
  }
  if (all.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 aspect-[16/9] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
        <Camera className="h-5 w-5" />
        <span>No photos found for this property.</span>
      </div>
    );
  }
  if (all.length === 1) {
    return (
      <div className="rounded-xl overflow-hidden border bg-muted/20">
        <img src={all[0]} alt="" className="w-full aspect-[16/9] object-cover" />
      </div>
    );
  }
  return (
    <Carousel className="w-full">
      <CarouselContent>
        {all.map((src, i) => (
          <CarouselItem key={`${i}-${src}`}>
            <div className="rounded-xl overflow-hidden border bg-muted/20">
              <img src={src} alt="" className="w-full aspect-[16/9] object-cover" />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

// ─── Main page ───────────────────────────────────────────────────────

export default function CashBuyPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
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
    const now = new Date().toISOString();
    return {
      id: makeId(),
      address: addressFromUrl || "Unknown Address",
      normalizedPropertyKey: addressFromUrl ? normalizePropertyKey(addressFromUrl).key || undefined : undefined,
      savedAt: now,
      updatedAt: now,
      purchasePrice: 0,
      purchasePriceSource: "default",
      occupancyType: "primary",
      propertyTaxes: 0,
      homeownersInsurance: 0,
      hoaMonthly: 0,
      hoaSource: "unknown",
      closingCosts: 0,
      closingCostsPercent: DEFAULT_CLOSING_PERCENT,
      closingCostsSource: "default_percent",
      sellerConcessionsMode: "percent",
      sellerConcessionsPercent: 0,
      sellerConcessionsAmount: 0,
    };
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // ─── Debounced auto-save (mirrors seller-estimate / Phase 1 guards) ───
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

  // ─── Zillow auto-pull on mount / address change ───
  //
  // Fires once per (scenarioId|address) if the price hasn't been
  // user-edited and Zillow hasn't already populated this scenario.
  // Server returns cached results from `property_cache` when available
  // (no network call), so this is cheap to call.
  const zillowFiredRef = useRef<Set<string>>(new Set());
  const [zillowStatus, setZillowStatus] = useState<CashBuyScenario["zillowStatus"]>(scenario.zillowStatus);

  useEffect(() => {
    const addr = scenario.address;
    if (!addr || addr === "Unknown Address") return;
    const key = `${scenario.id}|${addr.trim().toLowerCase()}`;
    if (zillowFiredRef.current.has(key)) return;
    // Skip re-fetch if user already edited price OR we already have a
    // successful Zillow load on this scenario.
    if (scenario.purchasePriceSource === "user") return;
    if (scenario.purchasePriceSource && scenario.purchasePriceSource.startsWith("zillow")) {
      zillowFiredRef.current.add(key);
      return;
    }
    // After reload from Supabase, `purchasePriceSource` is gone (not in
    // the canonical table). Use a non-zero price as a proxy for "already
    // populated" so a reload doesn't clobber the saved value with a
    // fresh Zillow scrape.
    if ((scenario.purchasePrice ?? 0) > 0) {
      zillowFiredRef.current.add(key);
      return;
    }
    zillowFiredRef.current.add(key);
    setZillowStatus("loading");
    setScenario(prev => ({ ...prev, zillowStatus: "loading" }));

    (async () => {
      try {
        const res = await apiRequest("POST", "/api/zillow-property-lookup", { addressOrUrl: addr });
        const body = await res.json();
        const p: LookedUpPropertyLite | undefined = body?.property;
        const fromCache: boolean = body?.cached === true;
        if (!p) {
          if (isMountedRef.current) {
            setZillowStatus("error");
            setScenario(prev => ({ ...prev, zillowStatus: "error" }));
          }
          return;
        }
        const zPrice = p.purchasePrice ?? p.listingPrice ?? p.zestimate ?? null;
        const zHoa = p.hoaMonthly ?? null;
        const photos = Array.isArray(p.photos) ? p.photos.filter(x => typeof x === "string") : [];
        const primary = photos[0];
        const priceSource = inferPriceSource(p, zPrice, fromCache);
        const nextStatus: CashBuyScenario["zillowStatus"] =
          fromCache ? "loaded_from_cache" : "loaded_from_zillow";

        if (!isMountedRef.current) return;
        setZillowStatus(nextStatus);

        // Merge — never overwrite user-edited fields.
        setScenario(prev => {
          const next: CashBuyScenario = { ...prev, zillowStatus: nextStatus };
          // Price: overwrite only if not user-edited.
          if (zPrice != null && prev.purchasePriceSource !== "user") {
            next.purchasePrice = zPrice;
            next.purchasePriceSource = priceSource;
            // Recompute 2% closing default unless user has overridden.
            if ((prev.closingCostsSource ?? "default_percent") === "default_percent") {
              const pct = prev.closingCostsPercent ?? DEFAULT_CLOSING_PERCENT;
              next.closingCosts = Math.round(zPrice * (pct / 100));
            }
            // Recompute taxes for the new price + current occupancy.
            const occ = prev.occupancyType ?? "primary";
            next.propertyTaxes = computeAnnualTaxes(prev.address, zPrice, occ);
          }
          // HOA: overwrite only if user hasn't manually set it.
          if (zHoa != null && (prev.hoaSource ?? "unknown") !== "manual") {
            next.hoaMonthly = zHoa;
            next.hoaSource = "zillow";
          }
          // Photos: always refresh from Zillow (cached or fresh).
          if (primary) next.primaryPhotoUrl = primary;
          if (photos.length > 0) next.propertyPhotos = photos;
          return next;
        });

        if (zPrice != null) {
          toast({
            title: fromCache ? "Property data loaded from cache" : "Zillow data applied",
            description: `Updated purchase price to ${formatCurrency(zPrice)}.`,
          });
        }
      } catch (err) {
        console.warn("[cash-buy] zillow lookup failed:", err);
        if (isMountedRef.current) {
          setZillowStatus("error");
          setScenario(prev => ({ ...prev, zillowStatus: "error" }));
        }
      }
    })();
  }, [scenario.id, scenario.address, scenario.purchasePriceSource, toast]);

  // ─── Field updaters ───

  function update<K extends keyof CashBuyScenario>(field: K, value: CashBuyScenario[K]) {
    setScenario(prev => ({ ...prev, [field]: value }));
  }

  // Price change from the user (slider/input). Side-effects: mark source
  // as "user", recompute default closing costs (if not manually overridden)
  // and recompute taxes for current occupancy.
  function setPurchasePrice(v: number) {
    setScenario(prev => {
      const next: CashBuyScenario = { ...prev, purchasePrice: v, purchasePriceSource: "user" };
      if ((prev.closingCostsSource ?? "default_percent") === "default_percent") {
        const pct = prev.closingCostsPercent ?? DEFAULT_CLOSING_PERCENT;
        next.closingCosts = Math.round(v * (pct / 100));
      }
      next.propertyTaxes = computeAnnualTaxes(prev.address, v, prev.occupancyType ?? "primary");
      return next;
    });
  }

  function setOccupancy(occ: CashBuyOccupancyType) {
    setScenario(prev => ({
      ...prev,
      occupancyType: occ,
      // Tax is fully derived from (address, price, occupancy) — always
      // recompute on occupancy change; there is no manual-override
      // concept for taxes in Phase 2.
      propertyTaxes: computeAnnualTaxes(prev.address, prev.purchasePrice ?? 0, occ),
    }));
  }

  function setClosingCosts(v: number) {
    setScenario(prev => ({ ...prev, closingCosts: v, closingCostsSource: "manual" }));
  }
  function resetClosingToPercent() {
    setScenario(prev => {
      const pct = prev.closingCostsPercent ?? DEFAULT_CLOSING_PERCENT;
      return {
        ...prev,
        closingCostsSource: "default_percent",
        closingCosts: Math.round((prev.purchasePrice ?? 0) * (pct / 100)),
      };
    });
  }
  function setClosingCostsPercent(pct: number) {
    setScenario(prev => {
      const next: CashBuyScenario = { ...prev, closingCostsPercent: pct };
      if ((prev.closingCostsSource ?? "default_percent") === "default_percent") {
        next.closingCosts = Math.round((prev.purchasePrice ?? 0) * (pct / 100));
      }
      return next;
    });
  }

  function setHoaMonthly(v: number) {
    setScenario(prev => ({ ...prev, hoaMonthly: v, hoaSource: "manual" }));
  }

  const handleInsuranceFactors = useCallback((factors: InsuranceFactors) => {
    setScenario(prev => ({ ...prev, insuranceFactors: factors as CashBuyInsuranceFactors }));
  }, []);
  const handleInsurancePremium = useCallback((annual: number) => {
    setScenario(prev =>
      prev.insurancePremiumAnnual === annual && prev.homeownersInsurance === annual
        ? prev
        : { ...prev, insurancePremiumAnnual: annual, homeownersInsurance: annual }
    );
  }, []);

  // ─── Derived display state ───

  const price = scenario.purchasePrice ?? 0;
  const closing = scenario.closingCosts ?? 0;
  const concessionApplied = sellerConcessionsApplied(scenario);
  const ctc = cashToCloseOf(scenario);
  const sliderMax = Math.max(2_000_000, Math.round((price || 500_000) * 2));
  const closingMax = Math.max(50_000, Math.round((price || 500_000) * 0.06));
  const concessionMode: SellerConcessionsMode = scenario.sellerConcessionsMode ?? "percent";
  const concessionMax = concessionMode === "amount" ? Math.max(1, closing || 1) : 9;
  const isPlaceholder = !scenario.address || scenario.address === "Unknown Address";

  const photoStatus: "idle" | "loading" | "loaded" | "error" =
    zillowStatus === "loading" ? "loading"
    : zillowStatus === "error" ? "error"
    : zillowStatus ? "loaded" : "idle";

  const effectiveFactors: InsuranceFactors = scenario.insuranceFactors ?? {
    regionKey: getInsRegionFromAddress(scenario.address),
    ...DEFAULT_INSURANCE_FACTORS,
  };
  // Insurance midpoint preview — used in the ongoing-costs summary even
  // before the user scrolls down to the simulator.
  const insMidpoint = scenario.homeownersInsurance
    ?? scenario.insurancePremiumAnnual
    ?? calcInsurancePremium(price, effectiveFactors).mid;

  const priceSourceLabel: Record<NonNullable<CashBuyScenario["purchasePriceSource"]>, string> = {
    default: "Default",
    user: "Manually entered",
    zillow_cache: "Zillow (cached)",
    zillow_listing: "Zillow listing price",
    zillow_sold: "Zillow sold price",
    zillow_zestimate: "Zillow Zestimate",
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Helmet>
        <title>Cash Buy — {scenario.address.split(",")[0]}</title>
      </Helmet>

      <div className="container mx-auto px-4 py-6 max-w-3xl">
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

        {/* Stacked, one-column layout */}
        <div className="space-y-4">

          {/* 1. Property photos at top */}
          <PhotoCarousel
            photos={scenario.propertyPhotos ?? []}
            primary={scenario.primaryPhotoUrl}
            status={photoStatus}
          />

          {/* 2. Property/address summary */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm leading-snug">{scenario.address}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    {scenario.purchasePriceSource && (
                      <Badge variant="outline" className="text-[10px] font-normal h-5">
                        Price source: {priceSourceLabel[scenario.purchasePriceSource]}
                      </Badge>
                    )}
                    {zillowStatus === "loading" && (
                      <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Looking up Zillow…</span>
                    )}
                    {zillowStatus === "loaded_from_cache" && (
                      <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> Loaded from saved records</span>
                    )}
                    {zillowStatus === "loaded_from_zillow" && (
                      <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> Fresh Zillow data</span>
                    )}
                    {zillowStatus === "error" && (
                      <span className="flex items-center gap-1 text-amber-700"><AlertCircle className="h-3 w-3" /> Zillow lookup unavailable</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Estimated Cash to Close */}
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
              <p className="mt-2 text-[11px] text-muted-foreground">
                Cash purchase — no loan, no monthly mortgage payment. Taxes, insurance, and HOA are
                ongoing costs and are shown separately below.
              </p>
            </CardContent>
          </Card>

          {/* 4. Real Estate */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Real Estate</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <NumRow
                label="Purchase Price"
                value={price}
                onChange={setPurchasePrice}
                min={0} max={sliderMax} step={1000} prefix="$"
              />

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Property Use</Label>
                <Select
                  value={scenario.occupancyType ?? "primary"}
                  onValueChange={(v) => setOccupancy(v as CashBuyOccupancyType)}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary Residence</SelectItem>
                    <SelectItem value="secondary">Secondary Home</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Primary residences get homestead tax rates; secondary &amp; investment use
                  non-homestead rates.
                </p>
              </div>

              <NumRow
                label="Estimated Closing Costs"
                hint={`Title, recording, doc stamps, inspection, appraisal — buyer side.`}
                value={closing}
                onChange={setClosingCosts}
                min={0} max={closingMax} step={100} prefix="$"
                badge={
                  scenario.closingCostsSource === "manual"
                    ? (
                      <button
                        type="button"
                        onClick={resetClosingToPercent}
                        className="text-[10px] text-primary underline-offset-2 hover:underline"
                      >
                        Reset to {(scenario.closingCostsPercent ?? DEFAULT_CLOSING_PERCENT).toFixed(2)}%
                      </button>
                    )
                    : (
                      <Badge variant="outline" className="text-[10px] font-normal h-5">
                        Auto ({(scenario.closingCostsPercent ?? DEFAULT_CLOSING_PERCENT).toFixed(2)}% of price)
                      </Badge>
                    )
                }
              />

              {scenario.closingCostsSource !== "manual" && (
                <NumRow
                  label="Closing-cost percent"
                  hint="Default 2% of purchase price. Change this to scale the auto value."
                  value={scenario.closingCostsPercent ?? DEFAULT_CLOSING_PERCENT}
                  onChange={setClosingCostsPercent}
                  min={0} max={6} step={0.05} suffix="%" decimals={2}
                />
              )}

              {/* Seller concessions toggle */}
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
                    hint="Seller credits are capped at your closing costs."
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

          {/* 5. Ongoing Costs */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ongoing Costs</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <NumRow
                label="Annual Property Taxes"
                hint="Auto-estimated from the Purchase tab's county-aware rates. Updates when price or property use changes."
                value={scenario.propertyTaxes ?? 0}
                onChange={v => update("propertyTaxes", v)}
                min={0} max={50_000} step={50} prefix="$"
              />
              <NumRow
                label="Annual Homeowners Insurance"
                hint="Synced from the insurance simulator midpoint below."
                value={scenario.homeownersInsurance ?? insMidpoint}
                onChange={v => update("homeownersInsurance", v)}
                min={0} max={20_000} step={25} prefix="$"
              />
              <NumRow
                label="HOA / Condo Fees"
                hint={
                  scenario.hoaSource === "zillow"
                    ? "Pulled from Zillow. Editing this will mark it as a manual override."
                    : "Edit to set a manual override."
                }
                value={scenario.hoaMonthly ?? 0}
                onChange={setHoaMonthly}
                min={0} max={2_000} step={5} prefix="$" suffix="/mo"
                badge={
                  scenario.hoaSource === "zillow" ? (
                    <Badge variant="outline" className="text-[10px] font-normal h-5">From Zillow</Badge>
                  ) : scenario.hoaSource === "manual" ? (
                    <Badge variant="outline" className="text-[10px] font-normal h-5">Manual</Badge>
                  ) : null
                }
              />

              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Monthly carrying cost (estimate)</p>
                <p className="tabular-nums">
                  {formatCurrency(
                    Math.round(
                      ((scenario.propertyTaxes ?? 0) / 12) +
                      ((scenario.homeownersInsurance ?? insMidpoint) / 12) +
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

          {/* 6. Insurance simulator (same engine as Purchase tab) */}
          <PropertyInsuranceSimulator
            address={scenario.address}
            purchasePrice={price}
            factors={scenario.insuranceFactors as InsuranceFactors | undefined}
            onFactorsChange={handleInsuranceFactors}
            onPremiumChange={handleInsurancePremium}
          />

          {isPlaceholder && (
            <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Enter an address from the Cash Buy dashboard to save this scenario.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
