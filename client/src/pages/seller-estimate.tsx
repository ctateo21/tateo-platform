import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useLocation, useSearch } from "wouter";
import ScenarioActions from "@/components/scenario-actions";
import {
  ArrowLeft, MapPin, Save, AlertCircle, Loader2, ImageOff,
  Sparkles, TrendingUp, AlertTriangle,
  Home, Eye, Heart, Calendar, DollarSign, BarChart3,
} from "lucide-react";
import {
  Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext,
} from "@/components/ui/carousel";
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
  getSellerScenarios, saveSellerScenarios, isAuthHydrated, subscribeAuthChange,
  getTrackedLoans, saveTrackedLoans,
  type SellerScenario, type SellerScenarioStatus,
} from "@/lib/auth";
import { normalizePropertyKey } from "@/lib/property-key";
import { posthog } from "@/lib/posthog";
import { applySellerSalePriceToRefinance } from "@/lib/refinance-from-seller";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
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

/** Default percent for the Seller Closing Costs slider. Must mirror the
 *  same constant in `seller-from-refinance.ts`. */
const DEFAULT_SELLER_CLOSING_PCT = 1.85;

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

  // Standard slider layout (global spec): label row on top, then
  // a 3fr/1fr grid below with the slider on the left (75% width)
  // and the editable value pill on the right (25%). Mobile stacks.
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_1fr] items-center gap-2 md:gap-3">
        <Slider
          className="w-full"
          min={min} max={max} step={step}
          value={[Math.min(max, Math.max(min, value))]}
          onValueChange={([v]) => onChange(v)}
        />
        <div className="flex items-center gap-0.5 bg-muted rounded-md px-2 py-1 min-w-[120px] md:justify-end">
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
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export default function SellerEstimatePage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
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

  // ── Hydration sync ─────────────────────────────────────────────
  // On a hard refresh of /seller?id=..., auth+scenarios usually load
  // AFTER initial render — getSellerScenarios() returns []. Without a
  // re-sync, the page seeds with default values and the autosave
  // effect below would then upsert those defaults under the same id,
  // wiping the user's saved row. We track hydration explicitly and
  // gate autosave on it.
  const hydratedRef = useRef<boolean>(isAuthHydrated());
  useEffect(() => {
    if (hydratedRef.current) return;
    const trySync = () => {
      if (!isAuthHydrated()) return;
      if (idFromUrl) {
        const persisted = getSellerScenarios().find(s => s.id === idFromUrl);
        if (persisted) {
          // Replace local state with the persisted row so autosave
          // doesn't clobber it with the placeholder defaults.
          console.debug("[seller-user-load] scenario id", persisted.id);
          console.debug("[seller-user-load] loaded user fields", {
            estimatedSalePrice: persisted.estimatedSalePrice,
            mortgagePayoff: persisted.mortgagePayoff,
            realtorCommissionPct: persisted.realtorCommissionPct,
            sellerClosingCosts: persisted.sellerClosingCosts,
            sellerClosingCostsPercent: persisted.sellerClosingCostsPercent,
            buyerConcessions: persisted.buyerConcessions,
            repairBudget: persisted.repairBudget,
            otherSellingCosts: persisted.otherSellingCosts,
            status: persisted.status,
          });
          console.debug("[seller-user-load] loaded source map", {
            estimatedSalePriceSource: persisted.estimatedSalePriceSource,
            mortgagePayoffSource: persisted.mortgagePayoffSource,
            realtorCommissionSource: persisted.realtorCommissionSource,
            sellerClosingCostsSource: persisted.sellerClosingCostsSource,
            buyerConcessionsSource: persisted.buyerConcessionsSource,
            repairBudgetSource: persisted.repairBudgetSource,
            otherSellingCostsSource: persisted.otherSellingCostsSource,
          });
          setScenario(persisted);
          // Seed the reverse-sync gate from the persisted value so
          // the first post-hydration autosave doesn't fire seller→refi
          // unless the user actually edits estimatedSalePrice.
          if (typeof persisted.estimatedSalePrice === "number") {
            lastSyncedSalePriceRef.current = persisted.estimatedSalePrice;
          }
        }
      }
      hydratedRef.current = true;
    };
    trySync();
    const unsub = subscribeAuthChange(trySync);
    return () => unsub();
  }, [idFromUrl]);

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
  // Tracks the last estimatedSalePrice we mirrored over to
  // tracked_loans so the reverse sync only fires when the value
  // actually changes (not on every unrelated autosave).
  const lastSyncedSalePriceRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    if (!isAuthenticated) return;
    // Don't autosave until hydration completes — otherwise on a hard
    // refresh we'd write the placeholder defaults over the persisted row
    // (race: render with empty cache → set defaults → cache loads → save).
    if (!hydratedRef.current) return;
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
        // Seller → refinance value mirroring used to live here; it is now
        // handled globally by the Phase 1 cross-tab sync helper
        // (`syncPropertyValueAcrossTabs`) which fires from the diff-watcher
        // inside `saveSellerScenarios`. Keeping the manual call would
        // cause duplicate writes and competing sync paths.
        lastSyncedSalePriceRef.current = stamped.estimatedSalePrice;
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
    setScenario(prev => {
      const next: SellerScenario = { ...prev, [field]: value };
      // Stamp provenance when the user edits any persistable input so
      // refinance / Zillow / property-cache merges won't clobber it.
      // See seller-from-refinance.ts (mergeFromRefinance) and the
      // Zillow merge block higher up in this file.
      let stampedSource: string | undefined;
      if (field === "estimatedSalePrice") {
        next.estimatedSalePriceSource = "manual"; stampedSource = "manual";
      } else if (field === "mortgagePayoff") {
        next.mortgagePayoffSource = "manual"; stampedSource = "manual";
      } else if (field === "realtorCommissionPct") {
        next.realtorCommissionSource = "manual"; stampedSource = "manual";
      } else if (field === "sellerClosingCosts") {
        next.sellerClosingCostsSource = "manual"; stampedSource = "manual";
      } else if (field === "buyerConcessions") {
        next.buyerConcessionsSource = "manual"; stampedSource = "manual";
      } else if (field === "repairBudget") {
        next.repairBudgetSource = "manual"; stampedSource = "manual";
      } else if (field === "otherSellingCosts") {
        next.otherSellingCostsSource = "manual"; stampedSource = "manual";
      }
      // Debug breadcrumb — autosave (~line 320) does the actual write.
      console.debug("[seller-user-save] changed field", String(field));
      console.debug("[seller-user-save] value", value);
      console.debug("[seller-user-save] source", stampedSource ?? "(not tracked)");
      console.debug("[seller-user-save] scenario id", prev.id);
      // When the sale price changes, recompute seller closing-costs
      // dollars from the stored percent so the slider's chosen %
      // continues to reflect the new sale price (legacy "manual"
      // dollar edits stay locked).
      if (field === "estimatedSalePrice" && next.sellerClosingCostsSource !== "manual") {
        const pct = next.sellerClosingCostsPercent ?? DEFAULT_SELLER_CLOSING_PCT;
        next.sellerClosingCosts = Math.round((value as number) * (pct / 100));
      }
      return next;
    });
  }

  // Move the seller-closing-costs percent slider. Stamps source as
  // "percent_manual" so the refinance auto-sync preserves the user's
  // chosen percent on future statement uploads.
  function updateClosingPercent(rawPct: number) {
    const pct = parseFloat(rawPct.toFixed(2));
    setScenario(prev => {
      const sale2 = prev.estimatedSalePrice ?? 0;
      return {
        ...prev,
        sellerClosingCostsPercent: pct,
        sellerClosingCosts: Math.round(sale2 * (pct / 100)),
        sellerClosingCostsSource: "percent_manual",
      };
    });
  }

  // Normalize legacy rows on mount: rows saved before the percent slider
  // existed have either no source or the old "default_1_percent" stamp
  // and no `sellerClosingCostsPercent` value. Persist the 1.85% default
  // so the slider matches the displayed dollar amount and the row gets
  // an up-to-date source on the next autosave. We never touch a row
  // that's been manually edited (source === "manual" | "percent_manual").
  useEffect(() => {
    const src = scenario.sellerClosingCostsSource;
    const needsPercent = scenario.sellerClosingCostsPercent == null;
    const isLegacyAuto = src == null || src === "default_1_percent" || src === "default_percent";
    if (!needsPercent || !isLegacyAuto) return;
    setScenario(prev => {
      if (prev.sellerClosingCostsPercent != null) return prev;
      const sale2 = prev.estimatedSalePrice ?? 0;
      return {
        ...prev,
        sellerClosingCostsPercent: DEFAULT_SELLER_CLOSING_PCT,
        sellerClosingCosts: Math.round(sale2 * (DEFAULT_SELLER_CLOSING_PCT / 100)),
        sellerClosingCostsSource: "default_percent",
      };
    });
  }, [scenario.id]);

  const sale = scenario.estimatedSalePrice ?? 0;
  const commissionPct = scenario.realtorCommissionPct ?? 0;
  const commissionDollars = Math.round(sale * (commissionPct / 100));
  const closingPct = scenario.sellerClosingCostsPercent ?? DEFAULT_SELLER_CLOSING_PCT;
  const closingDollars = scenario.sellerClosingCostsSource === "manual"
    ? (scenario.sellerClosingCosts ?? 0)
    : Math.round(sale * (closingPct / 100));
  const net = netProceedsOf({ ...scenario, sellerClosingCosts: closingDollars });

  // PostHog: scenario_calculated (seller). Fires once per scenario id the
  // first time the projected sale price is meaningful (> 0).
  const phSellerCalcFiredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!scenario.id || !(sale > 0)) return;
    if (phSellerCalcFiredRef.current.has(scenario.id)) return;
    phSellerCalcFiredRef.current.add(scenario.id);
    posthog.capture("scenario_calculated", { type: "seller" });
  }, [scenario.id, sale]);

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
            onClick={() => {
              // Logged-in users came from the dashboard's Sell Your
              // Home tab. Logged-out users came through the
              // six-option service picker after entering an address —
              // send them back there with the address preserved
              // (not to the dashboard, which would force login).
              if (isAuthenticated) {
                setLocation("/dashboard?tab=sellers");
              } else {
                setLocation(
                  scenario.address
                    ? `/select-service?address=${encodeURIComponent(scenario.address)}`
                    : "/select-service",
                );
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />{" "}
            {isAuthenticated ? "Back to Sellers" : "Back to Services"}
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {saveStatus === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>)}
              {saveStatus === "saved"  && (<><Save className="h-3 w-3 text-green-600" /> Saved</>)}
              {saveStatus === "error"  && (<><AlertCircle className="h-3 w-3 text-destructive" /> Save failed</>)}
            </div>
            <ScenarioActions scenarioType="seller" />
          </div>
        </div>

        <div className="space-y-4">
          {/* Row 1: Property photo/card  ←→  Estimated Net Proceeds.
              Stacks on mobile (photo first, KPI second). */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Left: address + photo + status */}
          <Card>
            <CardContent className="p-0 overflow-hidden rounded-lg">
              {/* Photo carousel — primary + propertyPhotos (deduped).
                  Falls through to a placeholder if no photos exist
                  after lookup completes; shows a loading state while
                  the Zillow scrape is in flight so we never flash
                  "No photo available" prematurely. */}
              {(() => {
                const list = Array.from(new Set([
                  scenario.primaryPhotoUrl,
                  ...(scenario.propertyPhotos ?? []),
                ].filter((p): p is string => !!p)));
                if (list.length === 0) {
                  return (
                    <div className="aspect-[4/3] bg-muted flex flex-col items-center justify-center text-muted-foreground gap-2">
                      {zillowStatus === "loading" ? (
                        <>
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-xs">Loading property photos…</span>
                        </>
                      ) : (
                        <>
                          <ImageOff className="h-8 w-8" />
                          <span className="text-xs">No photo available</span>
                        </>
                      )}
                    </div>
                  );
                }
                if (list.length === 1) {
                  return (
                    <div className="aspect-[4/3] bg-muted">
                      <img src={list[0]} alt={scenario.address} className="w-full h-full object-cover" />
                    </div>
                  );
                }
                return (
                  <Carousel className="w-full">
                    <CarouselContent>
                      {list.map((src, i) => (
                        <CarouselItem key={`${i}-${src}`}>
                          <div className="aspect-[4/3] bg-muted">
                            <img src={src} alt={scenario.address} className="w-full h-full object-cover" />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </Carousel>
                );
              })()}
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

          {/* Right of Row 1: Estimated Net Proceeds KPI. */}
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
          </div>

          {/* Row 2: Sale & Costs  ←→  Net Proceeds Breakdown.
              Stacks on mobile (Sale & Costs first). */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
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
                  hint={`${formatCurrency(closingDollars)} at ${closingPct.toFixed(2)}% — title, escrow, transfer taxes, document fees.`}
                  value={closingPct}
                  onChange={updateClosingPercent}
                  min={0}
                  max={5}
                  step={0.01}
                  suffix="%"
                  decimals={2}
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
                  label="Post Inspection Credits / Repair Costs"
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

            {/* Net Proceeds Breakdown — sits next to Sale & Costs on desktop. */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Net Proceeds Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="text-sm divide-y">
                  <Row label="Estimated Sale Price"   value={formatCurrency(sale)} positive />
                  <Row label="Mortgage Payoff"        value={`− ${formatCurrency(scenario.mortgagePayoff ?? 0)}`} />
                  <Row label={`Realtor Commission (${commissionPct.toFixed(1)}%)`} value={`− ${formatCurrency(commissionDollars)}`} />
                  <Row label={`Seller Closing Costs (${closingPct.toFixed(2)}%)`} value={`− ${formatCurrency(closingDollars)}`} />
                  <Row label="Buyer Concessions"      value={`− ${formatCurrency(scenario.buyerConcessions ?? 0)}`} />
                  <Row label="Post Inspection Credits / Repair Costs" value={`− ${formatCurrency(scenario.repairBudget ?? 0)}`} />
                  <Row label="Other Selling Costs"    value={`− ${formatCurrency(scenario.otherSellingCosts ?? 0)}`} />
                  <div className="flex items-center justify-between py-2 font-semibold">
                    <span>Estimated Net Proceeds</span>
                    <span className={net >= 0 ? "text-green-700" : "text-destructive"}>
                      {formatCurrency(net)}
                    </span>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Market Analysis — full width below Row 1 + Row 2.
              Lazy-loads on mount; the backend decides cache-vs-regenerate
              based on Friday rollover. The Anthropic API key never touches
              this component. */}
          <MarketAnalysisSection
            scenario={scenario}
            userId={user?.id ?? null}
            authLoading={authLoading}
          />
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

// ─── Market Analysis section ─────────────────────────────────────────
// Lazy-loads from /api/listing-market-analysis on mount. The backend
// returns either a cached row (within the current Friday week) or a freshly
// generated Anthropic analysis. We render loading, error, and stale states
// without ever blocking the surrounding Net Proceeds UI.

// ── Structured analysis shape (mirrors the server `StructuredAnalysis`) ──

type StatusLabel = "Competitive" | "Price Review Advised" | "Overpriced Risk" | "Insufficient Data";
type ComparisonLabel = "faster" | "similar" | "slower" | "unavailable";
type EngagementComparison = "higher" | "similar" | "lower" | "unavailable";

interface ListingMetric { label: string; value: string; note?: string | null; }
interface StructuredComp {
  address?: string | null;
  price?: number | null;
  sqft?: number | null;
  pricePerSqft?: number | null;
  beds?: number | null;
  baths?: number | null;
  daysOnMarket?: number | null;
  status?: string | null;
  notes?: string | null;
}
interface PlatformStat { views?: number | null; saves?: number | null; }

interface StructuredAnalysis {
  week_of: string;
  status_label: StatusLabel;
  listing_snapshot: { summary: string; metrics: ListingMetric[]; };
  market_comps: { summary: string; comps: StructuredComp[]; };
  similar_pending_sold: { summary: string; items: StructuredComp[]; };
  days_on_market_analysis: {
    summary: string;
    subject_dom: number | null;
    average_comp_dom: number | null;
    comparison_label: ComparisonLabel;
  };
  platform_engagement: {
    summary: string;
    zillow: PlatformStat | null;
    realtor: PlatformStat | null;
    redfin: PlatformStat | null;
    comparison_to_similar: EngagementComparison;
  };
  price_drop_recommendation: {
    recommended: boolean;
    summary: string;
    suggested_price_low: number | null;
    suggested_price_high: number | null;
  };
  projected_sale_price: {
    projected_low: number | null;
    projected_high: number | null;
    summary: string;
  };
  next_steps: string[];
  market_context: { summary: string; stats: { label: string; value: string; note?: string | null }[]; };
  data_limitations: string[];
  confidence_level: "low" | "medium" | "high";
  data_sources?: {
    available: { source: string; detail?: string | null }[];
    missing:   { source: string; reason: string }[];
  };
  citations?: { url: string; title: string }[];
}

interface MarketAnalysisRecord {
  id: string;
  listing_id: string;
  property_address: string;
  analysis_week_of: string;
  generated_at: string;
  next_update_due_at: string;
  status: "draft" | "published" | "error";
  market_summary: string | null;
  pricing_analysis: string | null;
  comps_summary: string | null;
  online_interest_summary: string | null;
  showing_summary: string | null;
  recommended_next_steps: string[] | null;
  risk_flags: string[] | null;
  price_review_recommended: boolean | null;
  confidence_level: "low" | "medium" | "high" | null;
  data_limitations: string[] | null;
  error_message: string | null;
  // Rich structured payload returned alongside the legacy scalar fields.
  // Older cached rows may omit this — UI falls back to the legacy fields.
  structured?: StructuredAnalysis | null;
}

function formatFriendlyDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function MarketAnalysisSection({
  scenario,
  userId,
  authLoading,
}: {
  scenario: SellerScenario;
  userId: string | null;
  authLoading: boolean;
}) {
  const [analysis, setAnalysis] = useState<MarketAnalysisRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedRef = useRef<string | null>(null);
  const retriedRef = useRef<boolean>(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchAnalysis(forceRefresh = false) {
    if (!userId) return;
    if (!scenario.address || scenario.address === "Unknown Address") return;
    setLoading(true);
    // Don't clear the prior error/warning — we want the failure banner to
    // remain visible above the previous saved analysis until a successful
    // generation replaces it.
    if (!analysis) setError(null);
    try {
      // Pull the current Supabase access token so the server can verify the
      // caller. The server derives user_id from this token — we never trust
      // the request body for identity.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/listing-market-analysis", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          listingId: scenario.id,
          address: scenario.address,
          normalizedPropertyKey: scenario.normalizedPropertyKey ?? null,
          estimatedSalePrice: scenario.estimatedSalePrice ?? null,
          // We don't have a separate list price field yet — fall back to the
          // seller's estimated sale price as the "list price" the model uses.
          listPrice: scenario.estimatedSalePrice ?? null,
          netProceeds: scenario.netProceeds ?? null,
          mortgagePayoff: scenario.mortgagePayoff ?? null,
          realtorCommissionPct: scenario.realtorCommissionPct ?? null,
          sellerClosingCosts: scenario.sellerClosingCosts ?? null,
          photoCount: scenario.propertyPhotos?.length ?? null,
          primaryPhotoUrl: scenario.primaryPhotoUrl ?? null,
          status: scenario.status,
          scenarioUpdatedAt: scenario.updatedAt,
          forceRefresh,
        }),
      });
      const body = await res.json();
      if (body?.analysis) {
        const next = body.analysis as MarketAnalysisRecord;
        setAnalysis(next);
        if (next.status === "error" && next.error_message) {
          setError(next.error_message);
        }
        // Poll every 15s whenever the server signals a background
        // generation is still in flight — this covers BOTH the
        // "generating" stub (no prior) and the "previous-cycle row shown
        // while this week's update cooks" case (prior row exists, server
        // sets `generating: true`).
        const isPending =
          body.generating === true ||
          next.status === "generating" ||
          (typeof (next as any).id === "string" && (next as any).id.startsWith("pending_"));
        if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
        if (isPending) {
          pollTimerRef.current = setTimeout(() => { void fetchAnalysis(false); }, 15_000);
        }
      } else if (body?.error) {
        setError(body.error);
      }
    } catch (err) {
      console.warn("[market-analysis] fetch failed:", err);
      // First-time fetch failures are often the request being aborted
      // mid-generation (Anthropic web search can take 30-60s). The server
      // still completes and saves the row, so a quick second attempt
      // usually returns the cached result instantly. Retry once silently
      // before surfacing an error banner to the seller.
      if (!retriedRef.current) {
        retriedRef.current = true;
        setLoading(false);
        setTimeout(() => { void fetchAnalysis(false); }, 1500);
        return;
      }
      setError(err instanceof Error ? err.message : "Could not load market analysis");
    } finally {
      setLoading(false);
    }
  }

  // Market Analysis gating: only auto-fetch when the seller scenario
  // is actually being marketed. Draft/blank scenarios get a clean
  // placeholder and never trigger Anthropic / web search / scraper /
  // weekly job. Allowed statuses match the spec exactly.
  const marketAnalysisAllowed = scenario.status === "ready_to_list" || scenario.status === "listed";

  // Fire once per (listingId, userId, status-gate) on mount. Re-fires
  // if the user switches listings OR flips status into an allowed
  // state (so promoting Draft → Ready to List loads/generates the
  // analysis immediately).
  useEffect(() => {
    if (!userId) return;
    if (!marketAnalysisAllowed) {
      console.log("[market-analysis] skipped because seller status is draft", {
        scenarioId: scenario.id, status: scenario.status,
      });
      return;
    }
    const key = `${scenario.id}::${userId}::${scenario.status}`;
    if (requestedRef.current === key) return;
    requestedRef.current = key;
    fetchAnalysis(false);
    return () => {
      if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id, userId, marketAnalysisAllowed]);

  // While Supabase hydration is in flight we don't yet know whether the user
  // is signed in — show a loader instead of flashing a sign-in CTA.
  if (authLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Market Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading market analysis…
          </div>
        </CardContent>
      </Card>
    );
  }

  // Status-gated placeholder. Shown BEFORE the auth check would
  // otherwise hide it — a logged-in user with a Draft/Estimate/blank
  // scenario sees this highlighted banner instead of any loading,
  // empty or error variant. Backend analysis is NOT called: the
  // gating useEffect above bails out for any status that isn't
  // "ready_to_list" / "listed".
  if (userId && !marketAnalysisAllowed) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Market Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div
            data-testid="market-analysis-draft-banner"
            className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3"
          >
            <p className="text-sm font-semibold text-foreground">
              Once your property is marked Ready to List or Listed, you’ll receive a weekly market analysis for this property every Friday at 8:00 AM EST.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Market analysis is not generated while this estimate is in Draft status.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Auth-gated empty state — calculator above still works for anonymous use.
  if (!userId) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Market Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sign in to get a weekly AI-powered market briefing for this listing.
          </p>
        </CardContent>
      </Card>
    );
  }

  const showSkeleton = loading && !analysis;
  // Render the analysis whenever we have ANY usable saved content — either
  // a structured payload or any of the legacy text fields. Even rows with
  // status === "error" can carry a previous good `structured` payload that
  // the server returned as a soft fallback, and we want to show that
  // instead of the full "unavailable" state. The big unavailable banner
  // is reserved for the true zero-data case (no saved row at all).
  const hasContent = !!(analysis && (
    analysis.structured ||
    analysis.market_summary ||
    analysis.pricing_analysis ||
    analysis.comps_summary ||
    analysis.online_interest_summary ||
    analysis.showing_summary
  ));
  const isPreparing = !!(analysis && (
    analysis.status === "generating" ||
    (typeof (analysis as any).id === "string" && (analysis as any).id.startsWith("pending_"))
  ));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Market Analysis
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {analysis?.generated_at ? (
              <>
                Last updated {formatFriendlyDate(analysis.generated_at)}
                {analysis.next_update_due_at && (
                  <> · Next update {formatFriendlyDate(analysis.next_update_due_at)}</>
                )}
              </>
            ) : (
              <>Updates Fridays at 8:00 AM</>
            )}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showSkeleton && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            {analysis ? "Updating this week's market analysis…" : "Loading saved market analysis…"}
          </div>
        )}

        {/* Warning shown when generation failed but we still have a prior
            saved analysis to show below. */}
        {hasContent && analysis!.error_message && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-xs">{analysis!.error_message}</p>
          </div>
        )}

        {!showSkeleton && isPreparing && !hasContent && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            This week's market analysis is being prepared.
          </div>
        )}

        {!showSkeleton && !isPreparing && error && !hasContent && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Market analysis unavailable right now.</p>
              <p className="text-xs mt-1">
                Your net proceeds and saved data are unaffected. The next weekly update runs Friday at 8:00 AM Eastern.
              </p>
            </div>
          </div>
        )}

        {hasContent && analysis!.structured && (
          <RichAnalysis structured={analysis!.structured} address={analysis!.property_address} />
        )}

        {/* Fallback for older cached rows that don't have a structured payload. */}
        {hasContent && !analysis!.structured && (
          <LegacyAnalysis a={analysis!} />
        )}
      </CardContent>
    </Card>
  );
}

// ── Rich structured renderer (new) ──────────────────────────────────

function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}
function formatRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return "Unavailable";
  if (low != null && high != null) return `${formatMoney(low)} – ${formatMoney(high)}`;
  return formatMoney(low ?? high);
}

function statusBadgeClass(label: StatusLabel): string {
  switch (label) {
    case "Competitive":          return "bg-green-100 text-green-800 border-green-200";
    case "Price Review Advised": return "bg-amber-100 text-amber-800 border-amber-200";
    case "Overpriced Risk":      return "bg-red-100 text-red-800 border-red-200";
    default:                     return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function compStatusBadgeClass(s?: string | null): string {
  const v = (s ?? "").toLowerCase();
  if (v === "active")  return "bg-blue-50 text-blue-700 border-blue-200";
  if (v === "pending") return "bg-amber-50 text-amber-800 border-amber-200";
  if (v === "sold")    return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-muted text-muted-foreground border-border";
}

function RichAnalysis({ structured: raw, address }: { structured: StructuredAnalysis; address: string }) {
  // Defensive normalization: older cached rows or partially-populated
  // payloads may be missing whole sections. Use empty-shaped defaults so
  // the renderer never crashes on `.summary` / `.metrics` of undefined.
  const s: StructuredAnalysis = {
    ...raw,
    listing_snapshot: raw?.listing_snapshot ?? ({ summary: "", metrics: [] } as any),
    market_comps: raw?.market_comps ?? ({ summary: "", comps: [] } as any),
    similar_pending_sold: raw?.similar_pending_sold ?? ({ summary: "", items: [] } as any),
    days_on_market_analysis: raw?.days_on_market_analysis ?? ({ summary: "", subject_dom: null, average_comp_dom: null, comparison_label: "" } as any),
    platform_engagement: raw?.platform_engagement ?? ({ summary: "", zillow: null, realtor: null, redfin: null } as any),
    price_drop_recommendation: raw?.price_drop_recommendation ?? ({ recommended: false, summary: "", suggested_price_low: null, suggested_price_high: null } as any),
    projected_sale_price: raw?.projected_sale_price ?? ({ summary: "", projected_low: null, projected_high: null } as any),
  };
  const ls = s.listing_snapshot;
  const mc = s.market_comps;
  const sps = s.similar_pending_sold;
  const dom = s.days_on_market_analysis;
  const pe = s.platform_engagement;
  const pdr = s.price_drop_recommendation;
  const psp = s.projected_sale_price;
  const lsMetrics = Array.isArray(ls?.metrics) ? ls.metrics : [];
  const mcComps = Array.isArray(mc?.comps) ? mc.comps : [];
  const spsItems = Array.isArray(sps?.items) ? sps.items : [];
  return (
    <div className="space-y-5">
      {/* Status banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-md border bg-muted/30">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium truncate">{address}</span>
        </div>
        <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${statusBadgeClass(s.status_label)}`}>
          {s.status_label}
        </span>
      </div>

      {/* Listing Snapshot */}
      <Section title="Listing Snapshot" icon={<BarChart3 className="h-3.5 w-3.5" />}>
        {ls?.summary && (
          <p className="text-sm leading-relaxed text-muted-foreground mb-3">{ls.summary}</p>
        )}
        {lsMetrics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {lsMetrics.map((m, i) => (
              <div key={i} className="rounded-md border p-2.5 bg-background">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
                <div className="text-sm font-semibold mt-0.5 truncate">{m.value || "Unavailable"}</div>
                {m.note && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{m.note}</div>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Market Comps */}
      <Section title="Market Comps" icon={<Home className="h-3.5 w-3.5" />}>
        <p className="text-sm leading-relaxed text-muted-foreground mb-2">{mc?.summary || "No comps connected yet."}</p>
        {mcComps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {mcComps.slice(0, 6).map((c, i) => <CompCard key={i} c={c} />)}
          </div>
        ) : (
          <UnavailableNote text="Comparable sales have not been connected yet. Add 3–5 comps to improve the pricing analysis." />
        )}
      </Section>

      {/* Similar Pending / Sold */}
      <Section title="Similar Pending / Sold" icon={<TrendingUp className="h-3.5 w-3.5" />}>
        <p className="text-sm leading-relaxed text-muted-foreground mb-2">{sps?.summary || "No nearby pending/sold data connected yet."}</p>
        {spsItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {spsItems.slice(0, 6).map((c, i) => <CompCard key={i} c={c} />)}
          </div>
        ) : (
          <UnavailableNote text="Nearby pending and recently sold homes are not connected yet." />
        )}
      </Section>

      {/* DOM analysis */}
      <Section title="Days on Market" icon={<Calendar className="h-3.5 w-3.5" />}>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <DomTile label="This listing"   value={dom?.subject_dom} />
          <DomTile label="Similar (avg)"  value={dom?.average_comp_dom} />
          <DomTile label="Vs similar" valueText={domComparisonText(dom?.comparison_label)} tone={domComparisonTone(dom?.comparison_label)} />
        </div>
        <p className="text-sm leading-relaxed">{dom?.summary || "Days-on-market cannot be evaluated yet — connect listing/MLS data to enable this section."}</p>
      </Section>

      {/* Platform engagement */}
      <Section title="Views &amp; Saves Across Platforms" icon={<Eye className="h-3.5 w-3.5" />}>
        <p className="text-sm leading-relaxed text-muted-foreground mb-3">{pe?.summary || "Platform engagement data has not been connected yet."}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <PlatformCard name="Zillow"     stat={pe?.zillow} />
          <PlatformCard name="Realtor.com" stat={pe?.realtor} />
          <PlatformCard name="Redfin"     stat={pe?.redfin} />
        </div>
        {!pe?.zillow && !pe?.realtor && !pe?.redfin && (
          <UnavailableNote className="mt-3" text="Connect Zillow / Realtor / Redfin / MLS to compare your views and saves vs similar homes." />
        )}
      </Section>

      {/* Price Drop Recommendation */}
      <div className={`rounded-md border p-4 ${pdr?.recommended ? "bg-amber-50 border-amber-200" : "bg-muted/30"}`}>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className={`h-4 w-4 ${pdr?.recommended ? "text-amber-700" : "text-muted-foreground"}`} />
          <h4 className="text-sm font-semibold">
            {pdr?.recommended ? "Price drop recommended" : "No price drop recommended right now"}
          </h4>
        </div>
        {pdr?.summary && (
          <p className="text-sm leading-relaxed text-muted-foreground">{pdr.summary}</p>
        )}
        {(pdr?.suggested_price_low != null || pdr?.suggested_price_high != null) && (
          <div className="mt-2 text-sm">
            <span className="text-muted-foreground">Suggested range: </span>
            <span className="font-semibold">{formatRange(pdr?.suggested_price_low, pdr?.suggested_price_high)}</span>
          </div>
        )}
      </div>

      {/* Projected Sale Price */}
      <Section title="Projected Sale Range" icon={<TrendingUp className="h-3.5 w-3.5" />}>
        <div className="rounded-md border bg-background p-3 mb-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Likely sale range</div>
          <div className="text-lg font-bold mt-0.5">
            {formatRange(psp?.projected_low, psp?.projected_high)}
          </div>
        </div>
        {psp?.summary && (
          <p className="text-sm leading-relaxed text-muted-foreground">{psp.summary}</p>
        )}
      </Section>

      {/* Seller-facing recap intentionally ends here. Backend still
          tracks next_steps, market_context, data_sources, citations,
          and data_limitations on the structured payload for admin/
          debugging — they're just hidden from the seller view. Low
          confidence is shown as a small inline note below. */}
      {s.confidence_level && s.confidence_level !== "high" && (
        <p className="text-xs text-muted-foreground border-t pt-3">
          Confidence: <span className="font-medium capitalize">{s.confidence_level}</span>
        </p>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
        {icon}{title}
      </h4>
      {children}
    </div>
  );
}

function UnavailableNote({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`text-xs text-muted-foreground italic rounded-md border border-dashed p-2.5 ${className ?? ""}`}>
      {text}
    </div>
  );
}

function CompCard({ c }: { c: StructuredComp }) {
  const ppsf = c.pricePerSqft ?? (c.price && c.sqft ? Math.round(c.price / c.sqft) : null);
  return (
    <div className="rounded-md border p-2.5 bg-background">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-sm font-medium truncate" title={c.address ?? undefined}>
          {c.address || "Address unavailable"}
        </div>
        {c.status && (
          <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${compStatusBadgeClass(c.status)}`}>
            {c.status}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
        {c.price != null && <div><span className="text-muted-foreground">Price:</span> <span className="font-semibold">{formatMoney(c.price)}</span></div>}
        {c.sqft != null && <div><span className="text-muted-foreground">Sqft:</span> <span className="font-medium">{c.sqft.toLocaleString()}</span></div>}
        {ppsf != null && <div><span className="text-muted-foreground">$/sqft:</span> <span className="font-medium">${ppsf.toLocaleString()}</span></div>}
        {c.daysOnMarket != null && <div><span className="text-muted-foreground">DOM:</span> <span className="font-medium">{c.daysOnMarket}</span></div>}
        {c.beds != null && <div><span className="text-muted-foreground">Bd:</span> <span className="font-medium">{c.beds}</span></div>}
        {c.baths != null && <div><span className="text-muted-foreground">Ba:</span> <span className="font-medium">{c.baths}</span></div>}
      </div>
      {c.notes && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{c.notes}</p>}
    </div>
  );
}

function DomTile({ label, value, valueText, tone }: { label: string; value?: number | null; valueText?: string; tone?: string }) {
  const display = valueText ?? (value != null ? `${value} days` : "Unavailable");
  return (
    <div className="rounded-md border p-2 bg-background text-center">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${tone ?? ""}`}>{display}</div>
    </div>
  );
}
function domComparisonText(l: ComparisonLabel): string {
  switch (l) {
    case "faster":  return "Faster";
    case "similar": return "In line";
    case "slower":  return "Slower";
    default:        return "Unavailable";
  }
}
function domComparisonTone(l: ComparisonLabel): string {
  switch (l) {
    case "faster":  return "text-green-700";
    case "slower":  return "text-amber-700";
    default:        return "";
  }
}

function PlatformCard({ name, stat }: { name: string; stat: PlatformStat | null }) {
  return (
    <div className="rounded-md border p-2.5 bg-background">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{name}</div>
      {stat ? (
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1"><Eye className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{stat.views?.toLocaleString() ?? "—"}</span> <span className="text-xs text-muted-foreground">views</span></div>
          <div className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{stat.saves?.toLocaleString() ?? "—"}</span> <span className="text-xs text-muted-foreground">saves</span></div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">Not connected</div>
      )}
    </div>
  );
}

// ── Legacy renderer (used only for old cached rows without `structured`) ──

function LegacyAnalysis({ a }: { a: MarketAnalysisRecord }) {
  return (
    <div className="space-y-4">
      {a.price_review_recommended && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Price review recommended</p>
            <p className="text-xs mt-1">Based on the data we have, it may be worth revisiting the asking price with your agent.</p>
          </div>
        </div>
      )}
      {a.market_summary && <AnalysisBlock title="Market Summary" body={a.market_summary} />}
      {a.pricing_analysis && <AnalysisBlock title="Pricing Analysis" body={a.pricing_analysis} />}
      {a.comps_summary && <AnalysisBlock title="Comparable Sales / Competition" body={a.comps_summary} />}
      {a.online_interest_summary && <AnalysisBlock title="Online Interest" body={a.online_interest_summary} />}
      {a.showing_summary && <AnalysisBlock title="Showing Activity" body={a.showing_summary} />}
      {/* Legacy fallback view: Recommended Next Steps and "Where we had
          limited data" are hidden from the seller-facing recap. Backend
          still carries them on the record for admin/debugging. */}
      {a.confidence_level && a.confidence_level.toLowerCase() !== "high" && (
        <p className="text-xs text-muted-foreground border-t pt-3 mt-2">
          Confidence: <span className="font-medium capitalize">{a.confidence_level}</span>
        </p>
      )}
    </div>
  );
}

function AnalysisBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {title}
      </h4>
      <p className="text-sm leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}
