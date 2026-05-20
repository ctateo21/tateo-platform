import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Home, RefreshCw, Shield, Search, LogOut, Trash2, ExternalLink,
  MapPin, Calendar, Plus, X, Pencil, Check,
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
  getInsuranceScenarios, saveInsuranceScenarios,
  type InsuranceScenario,
} from "@/lib/auth";
import { loadGoogleMapsApi } from "@/lib/script-loader";
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
// Minimal view per user spec: shows ONLY actual InsuranceScenario records
// for the signed-in user. No correlation with Purchase/Refinance, no
// "available properties" suggestions, no occupancy overrides. Refinance
// or Purchase addresses MUST NOT appear here unless the user has explicitly
// created an insurance estimate for them.
//
// Auto-correlation logic was intentionally removed because it was
// displaying Refinance records as if they were Insurance records. The
// helpers in lib/property-key.ts are kept in the codebase for a future
// re-introduction but are not referenced here.

function InsuranceTab() {
  const [, setLocation] = useLocation();
  const [scenarios, setScenarios] = useState<InsuranceScenario[]>([]);

  useEffect(() => {
    setScenarios(getInsuranceScenarios());
    return subscribeAuthChange(() => setScenarios(getInsuranceScenarios()));
  }, []);

  function remove(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    const updated = scenarios.filter(s => s.id !== id);
    setScenarios(updated);
    saveInsuranceScenarios(updated);
  }

  if (scenarios.length === 0) {
    return (
      <EmptyState
        icon={<Shield className="h-12 w-12" />}
        title="No insurance estimates yet"
        body="Get an insurance quote on a property to see it here. Insurance records are kept separately from Purchase and Refinance."
        cta="Get an Insurance Quote"
        href="/insurance"
      />
    );
  }

  return (
    <div className="space-y-3">
      {scenarios.map(ins => {
        const annual = ins.annualPremium;
        const monthly = typeof annual === "number" ? annual / 12 : undefined;
        return (
          <Card key={ins.id} className="hover:shadow-md transition-shadow group">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-snug line-clamp-2">{ins.address}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Saved {formatDate(ins.savedAt)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm sm:flex-1">
                  <div>
                    <p className="text-xs text-muted-foreground">Annual Premium</p>
                    <p className="font-semibold">{annual != null ? `${formatCurrency(annual)}/yr` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly</p>
                    <p className="font-semibold">{monthly != null ? `${formatCurrency(monthly)}/mo` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Coverage</p>
                    <p className="font-semibold truncate">{ins.coverageType ?? "—"}</p>
                  </div>
                </div>

                <div className="flex gap-2 sm:shrink-0">
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setLocation(`/insurance?address=${encodeURIComponent(ins.address)}`)}
                  >
                    View / Edit <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => remove(ins.id, e)}
                    aria-label="Delete insurance estimate"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
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

        <Tabs defaultValue="purchase">
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
        </Tabs>
      </main>
    </div>
  );
}
