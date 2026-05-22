import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { Home, ArrowLeft, Building2, Landmark } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LiveRatesCard } from "@/components/refi/live-rates-card";
import { StatementAnalyzer } from "@/components/refi/statement-analyzer";
import { LoanTracker, type MortgageAnalysis, type LiveRate, type PropertyType } from "@/components/refi/loan-tracker";
import { formatCurrency } from "@/lib/refi-calculations";
import { useQuery } from "@tanstack/react-query";
import LeadCaptureDialog from "@/components/ui/lead-capture-dialog";
import { getTrackedLoans, saveTrackedLoans, subscribeAuthChange, type TrackedLoan } from "@/lib/auth";
import PropertyLookupDialog, { type LookedUpProperty } from "@/components/property-lookup-dialog";
import { useToast } from "@/hooks/use-toast";

const MAX_TRACKED_LOANS = 10;

function analysisToTrackedLoan(analysis: MortgageAnalysis, propertyType: PropertyType): TrackedLoan {
  const now = new Date().toISOString();
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    propertyAddress: analysis.propertyAddress || "Unknown address",
    lender: analysis.lender || "Unknown lender",
    loanBalance: analysis.loanBalance,
    currentRate: analysis.interestRate,
    currentPI: analysis.principalAndInterest,
    monthlyPayment: analysis.monthlyPayment,
    estimatedHomeValue: analysis.estimatedHomeValue,
    estimatedRemainingYears: analysis.estimatedRemainingYears,
    addedAt: now,
    balanceAsOf: now,
    propertyType,
  };
}

function buildScenarioDetails(analysis: MortgageAnalysis): string {
  const parts = [
    `Refinance Analysis`,
    `Property: ${analysis.propertyAddress || "Unknown"}`,
    `Lender: ${analysis.lender || "Unknown"}`,
    `Loan Balance: ${formatCurrency(analysis.loanBalance)}`,
    `Interest Rate: ${analysis.interestRate}%`,
    `Monthly P&I: ${formatCurrency(analysis.principalAndInterest)}`,
    `Est. Home Value: ${formatCurrency(analysis.estimatedHomeValue)}`,
    `Remaining Term: ${analysis.estimatedRemainingYears} years`,
  ];
  if (analysis.potentialSavings > 0) {
    parts.push(`Potential Monthly Savings: ${formatCurrency(analysis.potentialSavings)}`);
  }
  return parts.join(" | ");
}

const PROPERTY_OPTIONS: { type: PropertyType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    type: "primary",
    label: "Primary Home",
    description: "Where you live full-time",
    icon: <Home className="h-6 w-6" />,
  },
  {
    type: "secondary",
    label: "Secondary Home",
    description: "Vacation or part-time residence",
    icon: <Landmark className="h-6 w-6" />,
  },
  {
    type: "investment",
    label: "Investment Property",
    description: "Rented out or income-generating",
    icon: <Building2 className="h-6 w-6" />,
  },
];

interface LiveRatesResponse {
  rates: LiveRate[];
  source: string;
  disclaimer: string;
  asOf: string;
}

export default function Refinance() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const address = new URLSearchParams(search).get("address") || "";
  // ?debug=1 re-exposes the manual "Pull from Zillow" button. The normal
  // flow now auto-runs a Zillow lookup whenever a tracked loan is added.
  const debugMode = new URLSearchParams(search).get("debug") === "1";

  const [statementData, setStatementData] = useState<MortgageAnalysis | null>(null);
  const [trackedLoans, setTrackedLoansState] = useState<TrackedLoan[]>(() => getTrackedLoans());

  // Keep local state in sync with auth cache (login, logout, hydration completes).
  useEffect(() => {
    const unsub = subscribeAuthChange(() => setTrackedLoansState(getTrackedLoans()));
    return unsub;
  }, []);

  // Wrap setter so any update also persists to Supabase via the auth helper.
  function updateLoans(updater: TrackedLoan[] | ((prev: TrackedLoan[]) => TrackedLoan[])) {
    setTrackedLoansState(prev => {
      const next = typeof updater === "function" ? (updater as (p: TrackedLoan[]) => TrackedLoan[])(prev) : updater;
      saveTrackedLoans(next);
      return next;
    });
  }

  const { toast } = useToast();
  const [analyzerLocked, setAnalyzerLocked] = useState(false);
  const [showZillowLookup, setShowZillowLookup] = useState(false);
  const [showLeadDialog, setShowLeadDialog] = useState(false);

  // Refinance only needs estimatedHomeValue from Zillow — the rest of the
  // tracked loan (rate, P&I, balance) still comes from the user's statement.
  function handleZillowApply(p: LookedUpProperty) {
    const homeValue = p.estimatedHomeValue ?? p.zestimate ?? p.listingPrice;
    if (!homeValue || !p.address) {
      toast({ title: "No home value found", description: "Zillow didn't return a valuation for this property.", variant: "destructive" });
      return;
    }
    const key = p.address.trim().toLowerCase();
    const matchCount = trackedLoans.filter(l => l.propertyAddress.trim().toLowerCase() === key).length;
    if (matchCount === 0) {
      // No-op silently is confusing — tell the user why nothing changed.
      toast({
        title: `Zestimate: $${homeValue.toLocaleString()}`,
        description: "Add a tracked loan for this address first (upload your statement), then run the Zillow lookup again to update its home value.",
      });
      return;
    }
    updateLoans(prev => prev.map(l =>
      l.propertyAddress.trim().toLowerCase() === key
        ? { ...l, estimatedHomeValue: homeValue }
        : l
    ));
    toast({ title: "Home value updated", description: `${matchCount} loan${matchCount > 1 ? "s" : ""} updated to $${homeValue.toLocaleString()}.` });
  }
  const [analysisForSave, setAnalysisForSave] = useState<MortgageAnalysis | null>(null);

  // Property type dialog state
  const [pendingAnalysis, setPendingAnalysis] = useState<MortgageAnalysis | null>(null);
  const [showPropertyTypeDialog, setShowPropertyTypeDialog] = useState(false);

  const { data: ratesData } = useQuery<LiveRatesResponse>({
    queryKey: ["/api/rates"],
    staleTime: 15 * 60 * 1000,
  });

  const handleAnalysisComplete = (analysis: MortgageAnalysis) => {
    setStatementData(analysis);
  };

  const handleAnalyzed = (analysis: MortgageAnalysis) => {
    if (trackedLoans.length >= MAX_TRACKED_LOANS) return;
    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const incoming = normalize(analysis.propertyAddress || "");
    const duplicate = trackedLoans.find(l => normalize(l.propertyAddress) === incoming);
    if (duplicate) return;
    // Show property type dialog before adding to tracker
    setPendingAnalysis(analysis);
    setShowPropertyTypeDialog(true);
  };

  const handlePropertyTypeSelect = (propertyType: PropertyType) => {
    if (!pendingAnalysis) return;
    const newLoan = analysisToTrackedLoan(pendingAnalysis, propertyType);
    updateLoans(prev => [newLoan, ...prev]);
    setPendingAnalysis(null);
    setShowPropertyTypeDialog(false);
    // Auto-pull Zillow for the newly tracked address so the user doesn't
    // need to click a separate "Pull from Zillow" button. We update the
    // loan's estimatedHomeValue (the only field refinance actually uses
    // from Zillow) and only overwrite if the Zillow value is meaningful.
    // Failures are silent — the loan is still tracked with the statement
    // value as a fallback.
    autoPullZillowForLoan(newLoan).catch(err => {
      console.warn("[refinance] auto Zillow lookup failed:", err?.message || err);
    });
  };

  // Background Zillow auto-pull for a freshly tracked loan. Keyed by
  // propertyAddress so it only updates the matching loan(s) regardless of
  // array order or later additions.
  async function autoPullZillowForLoan(loan: TrackedLoan) {
    const addr = loan.propertyAddress;
    if (!addr || addr === "Unknown address") return;
    const res = await fetch("/api/zillow-property-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressOrUrl: addr }),
    });
    if (!res.ok) return;
    const body = await res.json();
    const p = body?.property as LookedUpProperty | undefined;
    if (!p) return;
    const homeValue = p.estimatedHomeValue ?? p.zestimate ?? p.listingPrice;
    if (!homeValue) return;
    const key = addr.trim().toLowerCase();
    updateLoans(prev => prev.map(l =>
      l.propertyAddress.trim().toLowerCase() === key
        ? { ...l, estimatedHomeValue: homeValue }
        : l
    ));
  }

  const handleSavePromptAnswer = (accepted: boolean, analysis: MortgageAnalysis) => {
    if (accepted) {
      setAnalysisForSave(analysis);
      setShowLeadDialog(true);
    } else {
      setAnalyzerLocked(true);
    }
  };

  const handleLeadSuccess = () => {
    setShowLeadDialog(false);
    setAnalyzerLocked(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-[73px] z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => setLocation(address ? `/select-service?address=${encodeURIComponent(address)}` : "/select-service")} className="text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">Refinance Calculator</h1>
          </div>
          {address && <span className="text-sm text-muted-foreground hidden sm:block">· {address}</span>}
          {/* "Pull from Zillow" is now auto-run after a statement is
              tracked. Button stays available under ?debug=1 for QA. */}
          {debugMode && (
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowZillowLookup(true)}
                data-testid="refinance-open-zillow-lookup"
                title="Debug: manually open Zillow lookup"
              >
                <Home className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Pull from Zillow (debug)</span>
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Calculate Your Mortgage Refinance</h2>
          <p className="text-muted-foreground">Upload your mortgage statement to analyze your loan and track refinance opportunities.</p>
        </div>

        {/* Top row: Analyzer + Rates */}
        <div className="grid lg:grid-cols-3 gap-6 items-stretch mb-6">
          <div className="lg:col-span-2">
            <StatementAnalyzer
              onAnalysisComplete={handleAnalysisComplete}
              onAnalyzed={handleAnalyzed}
              trackedLoanCount={trackedLoans.length}
              maxLoans={MAX_TRACKED_LOANS}
              onSavePromptAnswer={handleSavePromptAnswer}
              locked={analyzerLocked}
            />
          </div>
          <LiveRatesCard
            onSelectRate={() => {}}
            selectedRate={6.65}
            className="h-full"
          />
        </div>

        {/* Loan Tracker */}
        <LoanTracker
          loans={trackedLoans}
          liveRates={ratesData?.rates ?? []}
          onRemove={id => updateLoans(prev => prev.filter(l => l.id !== id))}
          onUpdate={(id, updates) => updateLoans(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
          maxLoans={MAX_TRACKED_LOANS}
        />
      </main>

      <PropertyLookupDialog
        open={showZillowLookup}
        onOpenChange={setShowZillowLookup}
        initialAddressOrUrl={address}
        applyLabel="Update home value"
        onApply={handleZillowApply}
      />

      <footer className="border-t mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>This calculator provides estimates only. Actual rates and terms may vary. Consult with a licensed mortgage professional for personalized advice.</p>
        </div>
      </footer>

      {/* Property type dialog */}
      <Dialog open={showPropertyTypeDialog} onOpenChange={open => { if (!open) { setShowPropertyTypeDialog(false); setPendingAnalysis(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>What type of property is this?</DialogTitle>
            <DialogDescription>
              {pendingAnalysis?.propertyAddress
                ? `Select the occupancy type for ${pendingAnalysis.propertyAddress}.`
                : "Select the occupancy type for this property."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            {PROPERTY_OPTIONS.map(({ type, label, description, icon }) => (
              <button
                key={type}
                onClick={() => handlePropertyTypeSelect(type)}
                className="flex items-center gap-4 w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <div className="text-primary shrink-0">{icon}</div>
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save-to-profile lead capture dialog */}
      <LeadCaptureDialog
        open={showLeadDialog}
        onOpenChange={open => { if (!open) { setShowLeadDialog(false); setAnalyzerLocked(true); } }}
        action="save"
        address={analysisForSave?.propertyAddress || address}
        scenarioDetails={analysisForSave ? buildScenarioDetails(analysisForSave) : undefined}
        onSuccess={handleLeadSuccess}
      />
    </div>
  );
}
