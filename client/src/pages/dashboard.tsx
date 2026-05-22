import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Home, RefreshCw, Shield, Search, LogOut, Trash2, ExternalLink,
  MapPin, Calendar, Plus, X, Pencil, Check, Tag,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/auth-context";
import {
  getPurchaseScenarios, savePurchaseScenarios,
  getTrackedLoans, saveTrackedLoans, subscribeAuthChange,
  getInsuranceScenarios,
  getSellerScenarios, saveSellerScenarios, subscribePersistenceError,
  type InsuranceScenario, type PurchaseScenario,
  type SellerScenario, type SellerScenarioStatus,
} from "@/lib/auth";
import {
  normalizePropertyKey,
  getOccupancyOverride,
  setOccupancyOverride,
  type OccupancyType,
} from "@/lib/property-key";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { loadGoogleMapsApi } from "@/lib/script-loader";
import { useToast } from "@/hooks/use-toast";
import {
  getBestOption, getBestConventionalRate, PROPERTY_TYPE_ADJUSTMENTS,
  HE_MAX_CLTV, HE_RATE_MARGIN, NEW_TERM_YEARS,
  CLOSING_COST_PERCENT, CLOSING_COST_FIXED,
  type TrackedLoan, type LiveRate, type BestOption,
} from "@/components/refi/loan-tracker";
import { calculateRefinance, calculateMonthlyPayment, amortizeBalance, monthsBetween } from "@/lib/refi-calculations";

interface LiveRatesResponse { rates: LiveRate[]; source: string; disclaimer: string; asOf: string; }

// Fallback "today's market" rate when live rates haven't loaded yet.
const FALLBACK_TODAY_RATE = 6.65;

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  primary: "Primary Home", secondary: "2nd Home", investment: "Investment",
};
const PROPERTY_TYPE_COLORS: Record<string, string> = {
  primary: "bg-background text-foreground border",
  secondary: "bg-amber-600 text-white border-amber-600",
  investment: "bg-red-600 text-white border-red-600",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}


function RecStat({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-md border bg-background/80 p-2.5 min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold truncate">{label}</p>
      <p className={`text-sm font-bold truncate ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

function HomeValueStat({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(String(Math.round(value)));

  function commit() {
    const parsed = parseFloat(input.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed) && parsed > 0) onSave(parsed);
    setEditing(false);
  }

  return (
    <div className="rounded-md border bg-background/80 p-2.5 min-w-0" onClick={e => e.stopPropagation()}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold truncate">Est. Home Value</p>
      {editing ? (
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-xs font-medium">$</span>
          <input
            type="text"
            className="border rounded px-1.5 py-0.5 text-xs w-full min-w-0 bg-background"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
          />
          <button onClick={commit} className="text-green-600 hover:text-green-700 shrink-0" aria-label="Save"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Cancel"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold truncate">{formatCurrency(value)}</span>
          <button
            onClick={() => { setInput(String(Math.round(value))); setEditing(true); }}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Edit estimated home value"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function RateTermRecRow({ loan, details, homeValueStat }: { loan: TrackedLoan; details: RecDetails; homeValueStat: React.ReactNode }) {
  const { adjustedTodayRate, currentBalance, baseClosingCosts, monthlyEscrow } = details;
  const [financeFees, setFinanceFees] = useState(true);
  const [includeEscrows, setIncludeEscrows] = useState(false);

  const escrowAmount = includeEscrows ? monthlyEscrow * ESCROW_RESERVE_MONTHS : 0;
  const totalFees = baseClosingCosts + escrowAmount;
  const newLoanAmount = currentBalance + (financeFees ? totalFees : 0);
  const newMonthlyPI = calculateMonthlyPayment(newLoanAmount, adjustedTodayRate, NEW_TERM_YEARS);
  const monthlySavings = loan.currentPI - newMonthlyPI;
  const breakEvenMonths = monthlySavings > 0 ? Math.ceil(totalFees / monthlySavings) : 0;

  const savingsClass = monthlySavings > 0 ? "text-green-700" : "text-red-600";
  const loanIdSafe = loan.id.replace(/[^a-zA-Z0-9]/g, "");

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {homeValueStat}
        <RecStat label="New Rate" value={`${adjustedTodayRate.toFixed(2)}%`} valueClass="text-blue-700" />
        <RecStat label="New Monthly" value={`${formatCurrency(newMonthlyPI)}/mo`} />
        <RecStat
          label="Monthly Savings"
          value={`${monthlySavings > 0 ? "+" : ""}${formatCurrency(monthlySavings)}`}
          valueClass={savingsClass}
        />
        <RecStat
          label="Break-Even"
          value={breakEvenMonths > 0 ? `${breakEvenMonths} mo` : "N/A"}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <Switch id={`finance-fees-${loanIdSafe}`} checked={financeFees} onCheckedChange={setFinanceFees} />
          <Label htmlFor={`finance-fees-${loanIdSafe}`} className="text-xs cursor-pointer">
            Finance fees in new loan <span className="text-muted-foreground/80">({formatCurrency(baseClosingCosts)})</span>
          </Label>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <Switch id={`include-escrows-${loanIdSafe}`} checked={includeEscrows} onCheckedChange={setIncludeEscrows} disabled={monthlyEscrow <= 0} />
          <Label htmlFor={`include-escrows-${loanIdSafe}`} className={`text-xs cursor-pointer ${monthlyEscrow <= 0 ? "opacity-50" : ""}`}>
            Include escrows ({ESCROW_RESERVE_MONTHS}-mo reserve{monthlyEscrow > 0 ? ` · ${formatCurrency(monthlyEscrow * ESCROW_RESERVE_MONTHS)}` : ""})
          </Label>
        </div>
        <span className="ml-auto">
          New loan amount: <span className="font-semibold text-foreground">{formatCurrency(newLoanAmount)}</span>
        </span>
      </div>
    </div>
  );
}

function RecOverview({
  loan,
  details,
  onUpdateHomeValue,
}: {
  loan: TrackedLoan;
  details: RecDetails;
  onUpdateHomeValue: (v: number) => void;
}) {
  const { rec, adjustedTodayRate, heAvailable, heRate, heMonthly } = details;

  const homeValueStat = <HomeValueStat value={loan.estimatedHomeValue} onSave={onUpdateHomeValue} />;

  if (rec.type === "rate_term") {
    return <RateTermRecRow loan={loan} details={details} homeValueStat={homeValueStat} />;
  }

  if (rec.type === "second_lien") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {homeValueStat}
        <RecStat label="Equity Available" value={formatCurrency(heAvailable)} valueClass="text-yellow-800" />
        <RecStat label="2nd Lien Rate" value={`${heRate.toFixed(2)}%`} />
        <RecStat label="Est. Monthly" value={heMonthly > 0 ? `${formatCurrency(heMonthly)}/mo` : "—"} />
        <RecStat label="1st Lien Stays" value={`${loan.currentRate}%`} />
      </div>
    );
  }

  // hold
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {homeValueStat}
      <RecStat label="Your Rate" value={`${loan.currentRate}%`} valueClass="text-green-700" />
      <RecStat label="Today's Rate" value={`${adjustedTodayRate.toFixed(2)}%`} />
      <RecStat label="Monthly P&I" value={`${formatCurrency(loan.currentPI)}/mo`} />
      <RecStat label="Action" value="Hold" />
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────
function EmptyState({ icon, title, body, cta, href }: {
  icon: React.ReactNode; title: string; body: string; cta: string; href: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="text-muted-foreground/50">{icon}</div>
      <div>
        <p className="font-semibold text-lg">{title}</p>
        <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">{body}</p>
      </div>
      <Button onClick={() => setLocation(href)} className="mt-2 gap-2">
        <Search className="h-4 w-4" /> {cta}
      </Button>
    </div>
  );
}

// ── Refinance Tab ───────────────────────────────────────────────────
interface RecDetails {
  rec: BestOption;
  adjustedTodayRate: number;
  currentBalance: number;
  monthlyEscrow: number;
  baseClosingCosts: number;
  heAvailable: number;
  heRate: number;
  heMonthly: number;
}

const ESCROW_RESERVE_MONTHS = 3;

function RefiTab() {
  const [, setLocation] = useLocation();
  const [loans, setLoans] = useState<TrackedLoan[]>(() => getTrackedLoans() as TrackedLoan[]);

  // Re-sync whenever Supabase hydrates / user logs in or out.
  useEffect(() => {
    const unsub = subscribeAuthChange(() => setLoans(getTrackedLoans() as TrackedLoan[]));
    return unsub;
  }, []);

  const { data: ratesData } = useQuery<LiveRatesResponse>({ queryKey: ["/api/rates"] });
  const liveRates = ratesData?.rates ?? [];

  function remove(id: string) {
    const updated = loans.filter(l => l.id !== id);
    setLoans(updated);
    saveTrackedLoans(updated);
  }

  function updateHomeValue(id: string, newValue: number) {
    const updated = loans.map(l => l.id === id ? { ...l, estimatedHomeValue: newValue } : l);
    setLoans(updated);
    saveTrackedLoans(updated);
  }

  function getRecDetails(loan: TrackedLoan): RecDetails {
    const bestRate = getBestConventionalRate(liveRates);
    const rateAdj = PROPERTY_TYPE_ADJUSTMENTS[loan.propertyType] ?? 0;
    const adjustedTodayRate = (bestRate?.rate ?? FALLBACK_TODAY_RATE) + rateAdj;

    const liveMonths = monthsBetween(loan.balanceAsOf ?? loan.addedAt);
    const currentBalance = liveMonths > 0 && loan.currentPI > 0
      ? amortizeBalance(loan.loanBalance, loan.currentRate, loan.currentPI, liveMonths)
      : loan.loanBalance;

    const rec = getBestOption(
      { ...loan, loanBalance: currentBalance },
      adjustedTodayRate,
      loan.propertyType
    );

    const baseClosingCosts = (currentBalance * CLOSING_COST_PERCENT) / 100 + CLOSING_COST_FIXED;
    const monthlyEscrow = Math.max(0, loan.monthlyPayment - loan.currentPI);

    const maxCltv = HE_MAX_CLTV[loan.propertyType] ?? 0.9;
    const heAvailable = Math.max(0, Math.floor(loan.estimatedHomeValue * maxCltv - currentBalance));
    const heRate = adjustedTodayRate + HE_RATE_MARGIN;
    const heMonthly = heAvailable > 0 ? calculateMonthlyPayment(heAvailable, heRate, 15) : 0;

    return {
      rec,
      adjustedTodayRate,
      currentBalance,
      monthlyEscrow,
      baseClosingCosts,
      heAvailable,
      heRate,
      heMonthly,
    };
  }

  if (loans.length === 0) {
    return (
      <EmptyState
        icon={<RefreshCw className="h-12 w-12" />}
        title="No refinance loans saved yet"
        body="Upload a mortgage statement on the refinance page to analyze and save your loan."
        cta="Go to Refinance"
        href="/refinance"
      />
    );
  }

  return (
    <div className="space-y-3">
      {loans.map(loan => {
        const details = getRecDetails(loan);
        const { rec } = details;
        return (
          <Card
            key={loan.id}
            className="group relative hover:shadow-md transition-shadow overflow-hidden"
          >
            <CardContent
              className="py-4 cursor-pointer"
              onClick={() => setLocation("/refinance")}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Address + meta */}
                <div className="flex-1 min-w-0 lg:max-w-xs">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-snug line-clamp-2">{loan.propertyAddress}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{loan.lender}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Saved {formatDate(loan.addedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Property type badge */}
                <div className="flex lg:block">
                  <Badge variant="outline" className={`text-xs ${PROPERTY_TYPE_COLORS[loan.propertyType] || ""}`}>
                    {PROPERTY_TYPE_LABELS[loan.propertyType] || loan.propertyType}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm flex-1">
                  <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="font-semibold">{formatCurrency(loan.loanBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rate</p>
                    <p className="font-semibold">{loan.currentRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly P&amp;I</p>
                    <p className="font-semibold">{formatCurrency(loan.currentPI)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Value</p>
                    <p className="font-semibold">{formatCurrency(loan.estimatedHomeValue)}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 lg:shrink-0 items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs"
                    onClick={e => { e.stopPropagation(); setLocation("/refinance"); }}
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive px-2"
                        onClick={e => e.stopPropagation()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={e => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this loan?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove {loan.propertyAddress} from your saved scenarios. You can re-analyze it anytime.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(loan.id)} className="bg-destructive hover:bg-destructive/90">
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>

            <div className={`border-t p-4 space-y-3 ${rec.cardBg}`} onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <rec.Icon className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-sm">Recommended:</p>
                    <Badge variant="outline" className={`text-xs ${rec.badgeClass}`}>{rec.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.reason}</p>
                </div>
              </div>

              <RecOverview
                loan={loan}
                details={details}
                onUpdateHomeValue={v => updateHomeValue(loan.id, v)}
              />
            </div>
          </Card>
        );
      })}

      {/* Add more CTA */}
      <button
        onClick={() => setLocation("/refinance")}
        className="w-full border-2 border-dashed border-border rounded-lg p-4 flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <RefreshCw className="h-5 w-5" />
        <span className="text-sm font-medium">Analyze another loan</span>
      </button>
    </div>
  );
}

// ── Address search sub-component ────────────────────────────────────
function AddressSearchBar({ onNavigate, compact = false }: {
  onNavigate: (addr: string) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    async function init() {
      try {
        let apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
        if (!apiKey) {
          const res = await fetch("/api/config/google-maps-api-key");
          const data = await res.json();
          apiKey = data.apiKey || "";
        }
        if (!apiKey || !inputRef.current) return;
        await loadGoogleMapsApi(apiKey);
        if (!window.google?.maps?.places?.Autocomplete) return;
        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          componentRestrictions: { country: "us" },
          fields: ["formatted_address"],
        });
        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current.getPlace();
          if (place?.formatted_address) onNavigate(place.formatted_address);
        });
      } catch (err) {
        console.warn("Google Maps autocomplete unavailable:", err);
      }
    }
    init();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = inputRef.current?.value?.trim();
    if (val) onNavigate(val);
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter a property address..."
            autoFocus
            className="w-full pl-9 pr-4 h-10 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <Button type="submit" size="sm" className="h-10">Analyze</Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-2xl text-center">
        <h2 className="text-2xl font-bold mb-2">What is the full cost of this home?</h2>
        <p className="text-muted-foreground mb-8">
          Enter any property address to see your mortgage payment, insurance, taxes, and whether you qualify — no questionnaire required.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter a property address..."
              className="w-full pl-10 pr-4 h-14 text-base rounded-xl border bg-background shadow-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Button type="submit" size="lg" className="h-14 px-8 rounded-xl font-semibold text-base">
            Get Estimate
          </Button>
        </form>
        <p className="text-muted-foreground/60 text-sm mt-4">No questionnaire · Instant results · Free to use</p>
      </div>
    </div>
  );
}

// ── Purchase Tab — saved address tabs + full estimate view ───────────
function PurchaseTab() {
  const [, setLocation] = useLocation();
  const [scenarios, setScenarios] = useState<ReturnType<typeof getPurchaseScenarios>>([]);
  const [showAddSearch, setShowAddSearch] = useState(false);

  // Reload on mount and re-sync whenever Supabase hydrates / login changes.
  useEffect(() => {
    setScenarios(getPurchaseScenarios());
    const unsub = subscribeAuthChange(() => setScenarios(getPurchaseScenarios()));
    return unsub;
  }, []);

  function navigate(addr: string) {
    setLocation(`/estimate?address=${encodeURIComponent(addr)}&from=dashboard`);
  }

  function remove(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    const updated = scenarios.filter(s => s.id !== id);
    setScenarios(updated);
    savePurchaseScenarios(updated);
  }

  // No saved scenarios yet → full search experience
  if (scenarios.length === 0 && !showAddSearch) {
    return <AddressSearchBar onNavigate={navigate} />;
  }

  return (
    <div className="space-y-5">
      {/* Address tabs row */}
      <div className="flex flex-wrap items-center gap-2">
        {scenarios.map(s => (
          <button
            key={s.id}
            onClick={() => navigate(s.address)}
            className="group flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-background hover:border-primary hover:bg-accent transition-colors text-sm font-medium max-w-[220px]"
          >
            <MapPin className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
            <span className="truncate">{s.address.split(",")[0]}</span>
            <span
              role="button"
              onClick={e => remove(s.id, e)}
              className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}
        <button
          onClick={() => setShowAddSearch(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Search className="h-3.5 w-3.5" /> Add Property
        </button>
      </div>

      {/* Inline address search */}
      {showAddSearch && (
        <div className="flex items-center gap-2">
          <AddressSearchBar onNavigate={addr => { setShowAddSearch(false); navigate(addr); }} compact />
          <Button variant="ghost" size="sm" className="h-10" onClick={() => setShowAddSearch(false)}>Cancel</Button>
        </div>
      )}

      {/* Property rows */}
      <div className="space-y-3">
        {scenarios.map(s => {
          const dtiPct = s.dti != null ? Math.round(s.dti * 100) : null;
          return (
            <Card
              key={s.id}
              className="hover:shadow-md transition-shadow cursor-pointer group relative"
              onClick={() => navigate(s.address)}
            >
              <CardContent className="py-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Address + meta */}
                  <div className="flex-1 min-w-0 lg:max-w-xs">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-snug line-clamp-2">{s.address}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Saved {formatDate(s.savedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Qualifies badge */}
                  {s.qualifies != null && (
                    <div className="flex lg:block">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          s.qualifies
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {s.qualifies ? "Qualifies" : "Review"}
                      </Badge>
                    </div>
                  )}

                  {/* Stats */}
                  {(s.price != null || s.monthlyPayment != null || s.cashToClose != null || dtiPct != null) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm flex-1">
                      {s.price != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">Price</p>
                          <p className="font-semibold">{formatCurrency(s.price)}</p>
                        </div>
                      )}
                      {s.monthlyPayment != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">Est. Payment</p>
                          <p className="font-semibold">{formatCurrency(s.monthlyPayment)}/mo</p>
                        </div>
                      )}
                      {s.cashToClose != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">Cash to Close</p>
                          <p className="font-semibold">{formatCurrency(s.cashToClose)}</p>
                        </div>
                      )}
                      {dtiPct != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">DTI</p>
                          <p className="font-semibold">{dtiPct}%</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 lg:shrink-0">
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={e => { e.stopPropagation(); navigate(s.address); }}
                    >
                      View Full Estimate <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive px-2"
                          onClick={e => e.stopPropagation()}
                          aria-label="Delete estimate"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={e => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this estimate?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {s.address.split(",")[0]} from your dashboard. You can always look it up again later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove(s.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Insurance Tab ────────────────────────────────────────────────────
//
// Builds one compact row per *unique property* by correlating Insurance
// scenarios with Purchase scenarios and Refinance (tracked) loans on a
// normalized property key (street# + street + unit + ZIP5 + state). Rows
// match the visual style of the Purchase / Refinance tabs.
//
// Occupancy resolution order, per row:
//   1. Manual override (localStorage, persisted across sessions for this
//      browser — clears auto-correlation once set, per spec).
//   2. Refinance.propertyType from the most-recently-added matching
//      TrackedLoan (TrackedLoan has a typed propertyType column).
//   3. Purchase scenario — currently no occupancy column persisted, so
//      this falls through to "unknown" until a follow-up adds that
//      column. (PurchaseScenario type in lib/auth.ts has no occupancy.)
//   4. "unknown" — surfaced as a "Not selected" dropdown so the user can
//      set it manually.
//
// IMPORTANT: this UI relies only on existing persisted fields
// (InsuranceScenario.annualPremium + coverageType). Richer insurance
// data (rebuild cost, deductibles, carrier, policy type, status) is
// surfaced with "—" placeholders today and will fill in automatically
// once the insurance scenarios table gains those columns; no further
// UI changes will be needed.

const OCCUPANCY_LABELS: Record<OccupancyType, string> = {
  primary: "Primary Residence",
  secondary: "Second Home",
  investment: "Investment",
  unknown: "Not selected",
};

interface InsuranceRow {
  /** Normalized key — stable across address-shape changes. */
  key: string;
  /** Best display address (prefers insurance record, then purchase, then refi). */
  address: string;
  insurance: InsuranceScenario | null;
  purchaseMatches: PurchaseScenario[];
  refiMatches: TrackedLoan[];
  /** Resolved occupancy after override + correlation. */
  occupancy: OccupancyType;
  /** Where the occupancy value came from (for the small subtitle). */
  occupancySource: "manual_override" | "refinance" | "purchase" | "unknown";
  /** ISO timestamp of the most-recent record contributing to this row. */
  lastUpdated: string;
  linkedSources: ("Purchase" | "Refinance" | "Insurance")[];
}

function buildInsuranceRows(
  insuranceScenarios: InsuranceScenario[],
  purchaseScenarios: PurchaseScenario[],
  trackedLoans: TrackedLoan[],
): InsuranceRow[] {
  // Group every record by its normalized property key. Records whose
  // address can't be parsed get a synthetic per-record key so they never
  // collapse together silently.
  const byKey = new Map<string, {
    address: string;
    insurance: InsuranceScenario | null;
    purchaseMatches: PurchaseScenario[];
    refiMatches: TrackedLoan[];
    sources: Set<"Purchase" | "Refinance" | "Insurance">;
  }>();

  function ensure(key: string, address: string) {
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        address,
        insurance: null,
        purchaseMatches: [],
        refiMatches: [],
        sources: new Set(),
      };
      byKey.set(key, entry);
    }
    return entry;
  }

  // When an address can't be normalized, fall back to the record's own
  // stable id (never the array index) so row keys + localStorage overrides
  // stay attached to the same physical record across re-orders/re-hydration.
  // Insurance first so its address wins as the display preference.
  insuranceScenarios.forEach((ins) => {
    const norm = normalizePropertyKey(ins.address);
    const key = norm.key || `__unparsed_ins_${ins.id}`;
    const entry = ensure(key, ins.address);
    entry.insurance = ins;
    entry.sources.add("Insurance");
  });

  purchaseScenarios.forEach((p) => {
    const norm = normalizePropertyKey(p.address);
    const key = norm.key || `__unparsed_purchase_${p.id}`;
    const entry = ensure(key, p.address);
    if (!entry.insurance && entry.purchaseMatches.length === 0) entry.address = p.address;
    entry.purchaseMatches.push(p);
    entry.sources.add("Purchase");
  });

  trackedLoans.forEach((l) => {
    const norm = normalizePropertyKey(l.propertyAddress);
    const key = norm.key || `__unparsed_refi_${l.id}`;
    const entry = ensure(key, l.propertyAddress);
    if (!entry.insurance && entry.purchaseMatches.length === 0 && entry.refiMatches.length === 0) {
      entry.address = l.propertyAddress;
    }
    entry.refiMatches.push(l);
    entry.sources.add("Refinance");
  });

  // Resolve occupancy + last-updated per row.
  const rows: InsuranceRow[] = [];
  byKey.forEach((entry, key) => {
    // Auto: refi wins because it has a typed propertyType column.
    const newestRefi = [...entry.refiMatches].sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    )[0];

    const override = getOccupancyOverride(key);
    let occupancy: OccupancyType = "unknown";
    let occupancySource: InsuranceRow["occupancySource"] = "unknown";
    if (override) {
      occupancy = override;
      occupancySource = "manual_override";
    } else if (newestRefi) {
      occupancy = newestRefi.propertyType;
      occupancySource = "refinance";
    }

    // Last-updated: max of all contributing record timestamps.
    const timestamps: string[] = [];
    if (entry.insurance) timestamps.push(entry.insurance.savedAt);
    entry.purchaseMatches.forEach(p => timestamps.push(p.savedAt));
    entry.refiMatches.forEach(l => timestamps.push(l.addedAt));
    const lastUpdated = timestamps.sort().pop() ?? new Date().toISOString();

    rows.push({
      key,
      address: entry.address,
      insurance: entry.insurance,
      purchaseMatches: entry.purchaseMatches,
      refiMatches: entry.refiMatches,
      occupancy,
      occupancySource,
      lastUpdated,
      linkedSources: Array.from(entry.sources),
    });
  });

  // Newest first.
  rows.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  return rows;
}

function InsuranceTab() {
  const [, setLocation] = useLocation();

  // Mirror auth caches into state so the tab re-renders when scenarios
  // load from Supabase or when other tabs update them.
  const [insurance, setInsurance] = useState<InsuranceScenario[]>([]);
  const [purchases, setPurchases] = useState<PurchaseScenario[]>([]);
  const [loans, setLoans] = useState<TrackedLoan[]>([]);
  // Bump to re-resolve rows after a localStorage override change.
  const [overrideBump, setOverrideBump] = useState(0);

  useEffect(() => {
    function sync() {
      setInsurance(getInsuranceScenarios());
      setPurchases(getPurchaseScenarios());
      setLoans(getTrackedLoans() as TrackedLoan[]);
    }
    sync();
    return subscribeAuthChange(sync);
  }, []);

  const rows = buildInsuranceRows(insurance, purchases, loans);
  // overrideBump deliberately participates in render via this ref read so
  // the lint rule below stays happy without complicating the hook deps.
  void overrideBump;

  function handleOccupancyChange(key: string, next: OccupancyType) {
    setOccupancyOverride(key, next);
    setOverrideBump(n => n + 1);
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Shield className="h-12 w-12" />}
        title="No saved properties yet"
        body="Once you search for a property, analyze a refinance, or get an insurance quote, the property will appear here."
        cta="Search a Property"
        href="/"
      />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(row => (
        <InsuranceRowCard
          key={row.key}
          row={row}
          onOccupancyChange={next => handleOccupancyChange(row.key, next)}
          onOpen={() => setLocation(`/insurance?address=${encodeURIComponent(row.address)}`)}
        />
      ))}
    </div>
  );
}

function InsuranceRowCard({
  row, onOccupancyChange, onOpen,
}: {
  row: InsuranceRow;
  onOccupancyChange: (next: OccupancyType) => void;
  onOpen: () => void;
}) {
  const ins = row.insurance;
  const annual = ins?.annualPremium;
  const monthly = typeof annual === "number" ? annual / 12 : undefined;
  const occupancyBadgeClass = PROPERTY_TYPE_COLORS[row.occupancy] ?? "bg-muted text-muted-foreground border";

  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardContent className="py-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Address + meta */}
          <div className="flex-1 min-w-0 lg:max-w-xs">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-snug line-clamp-2">{row.address}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Updated {formatDate(row.lastUpdated)}
                </p>
                {row.linkedSources.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {row.linkedSources.map(src => (
                      <Badge key={src} variant="secondary" className="text-[10px] py-0 px-1.5">{src}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Occupancy + override */}
          <div className="flex lg:flex-col items-start gap-1.5 lg:min-w-[150px]">
            <Badge variant="outline" className={`text-xs ${occupancyBadgeClass}`}>
              {OCCUPANCY_LABELS[row.occupancy]}
            </Badge>
            <Select
              value={row.occupancy}
              onValueChange={(v) => onOccupancyChange(v as OccupancyType)}
            >
              <SelectTrigger className="h-7 text-xs w-[150px]" aria-label="Change occupancy">
                <SelectValue placeholder="Change occupancy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary Residence</SelectItem>
                <SelectItem value="secondary">Second Home</SelectItem>
                <SelectItem value="investment">Investment</SelectItem>
                <SelectItem value="unknown">Not selected (auto)</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[10px] text-muted-foreground">
              {row.occupancySource === "manual_override" && "Manual"}
              {row.occupancySource === "refinance" && "From Refinance"}
              {row.occupancySource === "purchase" && "From Purchase"}
              {row.occupancySource === "unknown" && "Auto-match"}
            </span>
          </div>

          {/* Insurance stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm flex-1">
            <div>
              <p className="text-xs text-muted-foreground">Annual Premium</p>
              <p className="font-semibold">{annual != null ? `${formatCurrency(annual)}/yr` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly</p>
              <p className="font-semibold">{monthly != null ? `${formatCurrency(monthly)}/mo` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Policy Type</p>
              <p className="font-semibold truncate">{ins?.coverageType ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-semibold">{ins ? "Estimate" : "Not started"}</p>
            </div>
            {/* Future-data placeholders — surface once schema lands. */}
            <div className="col-span-2 sm:col-span-4 text-[10px] text-muted-foreground/80">
              Rebuild · — &nbsp;·&nbsp; AOP — &nbsp;·&nbsp; Hurricane — &nbsp;·&nbsp; Flood — &nbsp;·&nbsp; Carrier —
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 lg:shrink-0">
            <Button size="sm" className="gap-2" onClick={onOpen}>
              {ins ? "View / Edit" : "Get Quote"} <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    setLocation("/");
    return null;
  }

  const initials = user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  function handleLogout() {
    logout();
    setLocation("/");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Dashboard header bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setLocation("/")}
            >
              <Search className="h-4 w-4" /> Search Property
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" /> Log Out
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">My Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your saved property scenarios, all in one place.</p>
        </div>

        <DashboardTabs />
      </main>
    </div>
  );
}

// ── Top-level Tabs wrapper — keeps the active tab in the URL (?tab=) ──
// Lets sibling pages (e.g. the new seller detail page) deep-link back to
// the dashboard on a specific tab via /dashboard?tab=sellers without
// breaking the existing default-of-Purchase behavior for /dashboard.
const VALID_TABS = ["purchase", "refinance", "insurance", "sellers"] as const;
type DashboardTabValue = typeof VALID_TABS[number];

function readTabFromSearch(search: string): DashboardTabValue {
  const params = new URLSearchParams(search);
  const t = params.get("tab");
  return (VALID_TABS as readonly string[]).includes(t ?? "") ? (t as DashboardTabValue) : "purchase";
}

function DashboardTabs() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<DashboardTabValue>(() => readTabFromSearch(search));

  // Keep state in sync if the URL changes externally (e.g. user clicks a
  // link, hits Back/Forward, or another component sets ?tab=sellers).
  useEffect(() => {
    const next = readTabFromSearch(search);
    setTab(prev => (prev === next ? prev : next));
  }, [search]);

  function handleChange(value: string) {
    const next = (VALID_TABS as readonly string[]).includes(value)
      ? (value as DashboardTabValue)
      : "purchase";
    setTab(next);
    // Only mirror non-default selections into the URL so /dashboard stays
    // a clean default route. Use replaceState so back-button works.
    const qs = next === "purchase" ? "" : `?tab=${next}`;
    setLocation(`/dashboard${qs}`, { replace: true });
  }

  return (
    <Tabs value={tab} onValueChange={handleChange}>
      <TabsList className="mb-6">
        <TabsTrigger value="purchase" className="gap-2">
          <Home className="h-4 w-4" /> Purchase
        </TabsTrigger>
        <TabsTrigger value="refinance" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refinance
        </TabsTrigger>
        <TabsTrigger value="insurance" className="gap-2">
          <Shield className="h-4 w-4" /> Insurance
        </TabsTrigger>
        <TabsTrigger value="sellers" className="gap-2">
          <Tag className="h-4 w-4" /> For Sale
        </TabsTrigger>
      </TabsList>

      <TabsContent value="purchase">
        <PurchaseTab />
      </TabsContent>

      <TabsContent value="refinance">
        <RefiTab />
      </TabsContent>

      <TabsContent value="insurance">
        <InsuranceTab />
      </TabsContent>

      <TabsContent value="sellers">
        <SellersTab />
      </TabsContent>
    </Tabs>);
}

// ── Sellers Tab — saved seller scenarios ─────────────────────────────
// Compact row style mirrors Purchase / Refinance / Insurance. Tapping the
// row (or its "Open" button) routes to /seller?address=&id= where the
// live net-proceeds calculator + Zillow pre-fill lives.
const SELLER_STATUS_LABEL: Record<SellerScenarioStatus, string> = {
  draft: "Draft",
  reviewing: "Reviewing",
  ready_to_list: "Ready to List",
  listed: "Listed",
  sold: "Sold",
};

const SELLER_STATUS_CLASS: Record<SellerScenarioStatus, string> = {
  draft:         "bg-muted text-muted-foreground border-muted-foreground/20",
  reviewing:     "bg-blue-50 text-blue-700 border-blue-200",
  ready_to_list: "bg-amber-50 text-amber-700 border-amber-200",
  listed:        "bg-violet-50 text-violet-700 border-violet-200",
  sold:          "bg-green-50 text-green-700 border-green-200",
};

function computeSellerNetProceeds(s: SellerScenario): number | null {
  const sale = s.estimatedSalePrice;
  if (sale == null) return null;
  const commission = sale * ((s.realtorCommissionPct ?? 0) / 100);
  const total =
    sale -
    (s.mortgagePayoff ?? 0) -
    (s.sellerClosingCosts ?? 0) -
    commission -
    (s.buyerConcessions ?? 0) -
    (s.repairBudget ?? 0) -
    (s.otherSellingCosts ?? 0);
  return Math.round(total);
}

// "—" fallback for unset numeric/date row fields — matches the dashboard
// convention for partially-populated scenarios.
const EMDASH = "—";
function fmtMoneyOrDash(n: number | null | undefined): string {
  return n == null ? EMDASH : formatCurrency(n);
}

function makeSellerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `seller_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function SellersTab() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [scenarios, setScenarios] = useState<SellerScenario[]>([]);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);

  useEffect(() => {
    setScenarios(getSellerScenarios());
    const unsub = subscribeAuthChange(() => setScenarios(getSellerScenarios()));
    const unsubErr = subscribePersistenceError(e => {
      if (e.table !== "seller_scenarios") return;
      setPersistError(e.message);
      toast({
        title: "For Sale property didn't save",
        description:
          e.message +
          " — apply supabase/migrations/2026_05_22_seller_and_market_analysis.sql in the Supabase SQL editor.",
        variant: "destructive",
      });
    });
    return () => { unsub(); unsubErr(); };
  }, [toast]);

  // Create a seller record immediately on address selection (per task spec)
  // so it shows up in the dashboard even if the user never opens the detail
  // page. If a record already exists for the same address, reuse it instead
  // of creating a duplicate.
  function openOrCreate(addr: string) {
    const existing = scenarios.find(
      s => s.address.toLowerCase().trim() === addr.toLowerCase().trim()
    );
    if (existing) {
      setLocation(
        `/seller?address=${encodeURIComponent(existing.address)}&id=${encodeURIComponent(existing.id)}`
      );
      return;
    }
    const now = new Date().toISOString();
    const id = makeSellerId();
    const norm = normalizePropertyKey(addr).key || undefined;
    const fresh: SellerScenario = {
      id,
      address: addr,
      normalizedPropertyKey: norm,
      savedAt: now,
      updatedAt: now,
      realtorCommissionPct: 6,
      sellerClosingCosts: 0,
      buyerConcessions: 0,
      repairBudget: 0,
      otherSellingCosts: 0,
      mortgagePayoff: 0,
      status: "draft",
    };
    console.log("[seller-create] address selected", {
      address: addr,
      id,
      normalizedPropertyKey: norm,
      flow: "for_sale",
      record: fresh,
    });
    const next = [fresh, ...scenarios];
    setScenarios(next);
    saveSellerScenarios(next);
    setLocation(`/seller?address=${encodeURIComponent(addr)}&id=${encodeURIComponent(id)}`);
  }

  function openExisting(s: SellerScenario) {
    setLocation(`/seller?address=${encodeURIComponent(s.address)}&id=${encodeURIComponent(s.id)}`);
  }

  function remove(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    const updated = scenarios.filter(s => s.id !== id);
    setScenarios(updated);
    saveSellerScenarios(updated);
  }

  if (scenarios.length === 0 && !showAddSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-xl text-center space-y-4">
          <Tag className="h-10 w-10 mx-auto text-primary" />
          <h2 className="text-2xl font-bold">Thinking about selling?</h2>
          <p className="text-muted-foreground">
            Add your property address to see your estimated sale price and net proceeds after payoff, commission, and closing costs.
          </p>
          <div className="pt-2">
            <AddressSearchBar onNavigate={openOrCreate} compact />
            <p className="text-xs text-muted-foreground mt-2">
              We'll save it to your dashboard so you can come back any time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {persistError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm px-3 py-2">
          <strong>Saving to Supabase failed.</strong> {persistError}
          <div className="text-xs mt-1 opacity-90">
            Apply <code>supabase/migrations/2026_05_22_seller_and_market_analysis.sql</code> in your Supabase SQL editor, then refresh.
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {scenarios.map(s => (
          <button
            key={s.id}
            onClick={() => openExisting(s)}
            className="group flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-background hover:border-primary hover:bg-accent transition-colors text-sm font-medium max-w-[220px]"
          >
            <MapPin className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
            <span className="truncate">{s.address.split(",")[0]}</span>
            <span
              role="button"
              onClick={e => remove(s.id, e)}
              className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}
        <button
          onClick={() => setShowAddSearch(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Search className="h-3.5 w-3.5" /> Add Seller Property
        </button>
      </div>

      {showAddSearch && (
        <div className="flex items-center gap-2">
          <AddressSearchBar
            onNavigate={addr => { setShowAddSearch(false); openOrCreate(addr); }}
            compact
          />
          <Button variant="ghost" size="sm" className="h-10" onClick={() => setShowAddSearch(false)}>Cancel</Button>
        </div>
      )}

      <div className="space-y-3">
        {scenarios.map(s => {
          const net = computeSellerNetProceeds(s);
          return (
            <Card
              key={s.id}
              className="hover:shadow-md transition-shadow cursor-pointer group relative"
              onClick={() => openExisting(s)}
            >
              <CardContent className="py-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {s.primaryPhotoUrl ? (
                    <img
                      src={s.primaryPhotoUrl}
                      alt=""
                      className="h-16 w-24 object-cover rounded-md border shrink-0 hidden sm:block"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : null}

                  <div className="flex-1 min-w-0 lg:max-w-xs">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-snug line-clamp-2">{s.address}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Updated {formatDate(s.updatedAt ?? s.savedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex lg:block">
                    <Badge variant="outline" className={`text-xs ${SELLER_STATUS_CLASS[s.status]}`}>
                      {SELLER_STATUS_LABEL[s.status]}
                    </Badge>
                  </div>

                  {/* Required row stats — always rendered with "—" when unset,
                      per task spec ("never empty boxes"). */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm flex-1">
                    <div>
                      <p className="text-xs text-muted-foreground">Est. Sale Price</p>
                      <p className="font-semibold">{fmtMoneyOrDash(s.estimatedSalePrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Closing Costs</p>
                      <p className="font-semibold">{fmtMoneyOrDash(s.sellerClosingCosts)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payoff</p>
                      <p className="font-semibold">{fmtMoneyOrDash(s.mortgagePayoff)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net Proceeds</p>
                      <p className={`font-semibold ${net == null ? "" : net >= 0 ? "text-green-700" : "text-destructive"}`}>
                        {fmtMoneyOrDash(net)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 lg:shrink-0">
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={e => { e.stopPropagation(); openExisting(s); }}
                    >
                      View / Edit <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive px-2"
                          onClick={e => e.stopPropagation()}
                          aria-label="Delete seller scenario"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={e => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this seller scenario?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {s.address.split(",")[0]} from your dashboard. You can always add it back later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove(s.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
