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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/auth-context";
import { getPurchaseScenarios, savePurchaseScenarios } from "@/lib/auth";
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

const REFI_KEY = "refinance-tracked-loans";
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

function loadRefiLoans(): TrackedLoan[] {
  try {
    const loans = JSON.parse(localStorage.getItem(REFI_KEY) || "[]") as TrackedLoan[];
    return loans.map(l => ({ ...l, propertyType: l.propertyType ?? "primary" }));
  } catch { return []; }
}
function saveRefiLoans(loans: TrackedLoan[]) {
  try { localStorage.setItem(REFI_KEY, JSON.stringify(loans)); } catch {}
}

function RecStat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-md border bg-background/80 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className={`text-sm font-bold ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

function RecOverview({ loan, details }: { loan: TrackedLoan; details: { rec: BestOption; adjustedTodayRate: number; rateTermNewPI: number; rateTermMonthlySavings: number; rateTermBreakEvenMonths: number; heAvailable: number; heRate: number; heMonthly: number } }) {
  const { rec, adjustedTodayRate, rateTermNewPI, rateTermMonthlySavings, rateTermBreakEvenMonths, heAvailable, heRate, heMonthly } = details;

  if (rec.type === "rate_term") {
    const savingsClass = rateTermMonthlySavings > 0 ? "text-green-700" : "text-red-600";
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <RecStat label="New Rate" value={`${adjustedTodayRate.toFixed(2)}%`} valueClass="text-blue-700" />
        <RecStat label="New Monthly P&I" value={`${formatCurrency(rateTermNewPI)}/mo`} />
        <RecStat
          label="Monthly Savings"
          value={`${rateTermMonthlySavings > 0 ? "+" : ""}${formatCurrency(rateTermMonthlySavings)}`}
          valueClass={savingsClass}
        />
        <RecStat
          label="Break-Even"
          value={rateTermBreakEvenMonths > 0 ? `${rateTermBreakEvenMonths} mo` : "N/A"}
        />
      </div>
    );
  }

  if (rec.type === "second_lien") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <RecStat label="Equity Available" value={formatCurrency(heAvailable)} valueClass="text-yellow-800" />
        <RecStat label="2nd Lien Rate" value={`${heRate.toFixed(2)}%`} />
        <RecStat label="Est. Monthly Pmt" value={heMonthly > 0 ? `${formatCurrency(heMonthly)}/mo` : "—"} />
        <RecStat label="1st Lien Stays" value={`${loan.currentRate}%`} />
      </div>
    );
  }

  // hold
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <RecStat label="Your Rate" value={`${loan.currentRate}%`} valueClass="text-green-700" />
      <RecStat label="Today's Rate" value={`${adjustedTodayRate.toFixed(2)}%`} />
      <RecStat label="Monthly P&I" value={`${formatCurrency(loan.currentPI)}/mo`} />
      <RecStat label="Action" value="Hold — keep loan" />
    </div>
  );
}

function HomeValueEditor({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(String(Math.round(value)));

  function commit() {
    const parsed = parseFloat(input.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed) && parsed > 0) onSave(parsed);
    setEditing(false);
  }

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md border bg-background/80 p-3 flex-wrap"
      onClick={e => e.stopPropagation()}
    >
      <div className="space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Est. Home Value</p>
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">$</span>
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm w-36 bg-background"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
            />
            <Button size="sm" variant="ghost" onClick={commit} className="h-7 px-2"><Check className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 px-2"><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-bold text-base">{formatCurrency(value)}</span>
            <button
              onClick={() => { setInput(String(Math.round(value))); setEditing(true); }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Edit estimated home value"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground max-w-xs">
        Update this to refine the recommendation based on your actual equity.
      </p>
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
  rateTermNewPI: number;
  rateTermMonthlySavings: number;
  rateTermBreakEvenMonths: number;
  heAvailable: number;
  heRate: number;
  heMonthly: number;
}

function RefiTab() {
  const [, setLocation] = useLocation();
  const [loans, setLoans] = useState<TrackedLoan[]>(loadRefiLoans);

  const { data: ratesData } = useQuery<LiveRatesResponse>({ queryKey: ["/api/rates"] });
  const liveRates = ratesData?.rates ?? [];

  function remove(id: string) {
    const updated = loans.filter(l => l.id !== id);
    setLoans(updated);
    saveRefiLoans(updated);
  }

  function updateHomeValue(id: string, newValue: number) {
    const updated = loans.map(l => l.id === id ? { ...l, estimatedHomeValue: newValue } : l);
    setLoans(updated);
    saveRefiLoans(updated);
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

    const rateTerm = calculateRefinance({
      appraisedValue: loan.estimatedHomeValue,
      loanBalance: currentBalance,
      currentInterestRate: loan.currentRate,
      newInterestRate: adjustedTodayRate,
      currentTermRemainingYears: Math.max(1, Math.round(loan.estimatedRemainingYears)),
      newLoanTermYears: NEW_TERM_YEARS,
      closingCostsPercent: CLOSING_COST_PERCENT,
      closingCostsFixed: CLOSING_COST_FIXED,
      includeClosingCostsInLoan: true,
      refinanceType: "rate_and_term",
    });

    const maxCltv = HE_MAX_CLTV[loan.propertyType] ?? 0.9;
    const heAvailable = Math.max(0, Math.floor(loan.estimatedHomeValue * maxCltv - currentBalance));
    const heRate = adjustedTodayRate + HE_RATE_MARGIN;
    const heMonthly = heAvailable > 0 ? calculateMonthlyPayment(heAvailable, heRate, 15) : 0;

    return {
      rec,
      adjustedTodayRate,
      currentBalance,
      rateTermNewPI: rateTerm.monthlyPaymentNew,
      rateTermMonthlySavings: rateTerm.monthlySavings,
      rateTermBreakEvenMonths: rateTerm.breakEvenMonths,
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

              <RecOverview loan={loan} details={details} />

              <HomeValueEditor
                value={loan.estimatedHomeValue}
                onSave={v => updateHomeValue(loan.id, v)}
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

  // Reload on mount so changes from estimate page are picked up
  useEffect(() => { setScenarios(getPurchaseScenarios()); }, []);

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

// ── Insurance Tab — aggregates addresses from purchase + refinance ───
function InsuranceTab() {
  const [, setLocation] = useLocation();

  // Collect unique addresses from purchase scenarios and refi loans
  const addresses = (() => {
    const seen = new Set<string>();
    const list: { address: string; source: string }[] = [];

    getPurchaseScenarios().forEach(s => {
      const key = s.address.trim().toLowerCase();
      if (!seen.has(key)) { seen.add(key); list.push({ address: s.address, source: "Purchase" }); }
    });

    loadRefiLoans().forEach(l => {
      const key = l.propertyAddress.trim().toLowerCase();
      if (!seen.has(key)) { seen.add(key); list.push({ address: l.propertyAddress, source: "Refinance" }); }
    });

    return list;
  })();

  if (addresses.length === 0) {
    return (
      <EmptyState
        icon={<Shield className="h-12 w-12" />}
        title="No saved addresses yet"
        body="Once you search for a property or analyze a refinance loan, those addresses will appear here so you can quickly get an insurance quote."
        cta="Search a Property"
        href="/"
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        These addresses are pulled from your saved purchase and refinance scenarios. Click any to get an insurance quote.
      </p>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {addresses.map(({ address, source }) => (
          <Card key={address} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm leading-snug flex-1">
                  <MapPin className="inline h-3.5 w-3.5 mr-1 text-muted-foreground shrink-0" />
                  {address}
                </p>
                <Badge variant="secondary" className="text-xs shrink-0">{source}</Badge>
              </div>
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={() => setLocation(`/insurance?address=${encodeURIComponent(address)}`)}
              >
                <Shield className="h-4 w-4" /> Get Insurance Quote
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
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
