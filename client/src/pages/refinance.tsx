import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { Home, ArrowLeft } from "lucide-react";
import { LiveRatesCard } from "@/components/refi/live-rates-card";
import { StatementAnalyzer } from "@/components/refi/statement-analyzer";
import { LoanTracker, type TrackedLoan, type MortgageAnalysis, type LiveRate } from "@/components/refi/loan-tracker";
import { formatCurrency } from "@/lib/refi-calculations";
import { useQuery } from "@tanstack/react-query";
import LeadCaptureDialog from "@/components/ui/lead-capture-dialog";

const STORAGE_KEY = "refinance-tracked-loans";
const MAX_TRACKED_LOANS = 10;

const defaultCalculatorInput = {
  newInterestRate: 6.65,
  newLoanTermYears: 30,
  closingCostsPercent: 2,
  closingCostsFixed: 2000,
  includeClosingCostsInLoan: true,
  refinanceType: "rate_and_term" as "rate_and_term" | "cash_out",
  cashOutAmount: 0,
};

function loadTrackedLoans(): TrackedLoan[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const loans = JSON.parse(stored) as TrackedLoan[];
    return loans.map(l => ({ ...l, propertyType: l.propertyType ?? "primary" }));
  } catch { return []; }
}

function saveTrackedLoans(loans: TrackedLoan[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loans)); } catch {}
}

function analysisToTrackedLoan(analysis: MortgageAnalysis): TrackedLoan {
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
    propertyType: "primary",
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

  const [statementData, setStatementData] = useState<MortgageAnalysis | null>(null);
  const [calculatorInput, setCalculatorInput] = useState(defaultCalculatorInput);
  const [results, setResults] = useState<RefinanceResult | null>(null);
  const [trackedLoans, setTrackedLoans] = useState<TrackedLoan[]>(loadTrackedLoans);

  const [analyzerLocked, setAnalyzerLocked] = useState(false);
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [analysisForSave, setAnalysisForSave] = useState<MortgageAnalysis | null>(null);

  const { data: ratesData } = useQuery<LiveRatesResponse>({
    queryKey: ["/api/rates"],
    staleTime: 15 * 60 * 1000,
  });

  useEffect(() => { saveTrackedLoans(trackedLoans); }, [trackedLoans]);

  useEffect(() => {
    if (!statementData) { setResults(null); return; }
    const input: RefinanceInput = {
      appraisedValue: statementData.estimatedHomeValue,
      loanBalance: statementData.loanBalance,
      currentInterestRate: statementData.interestRate,
      currentTermRemainingYears: Math.min(30, Math.max(1, Math.round(statementData.estimatedRemainingYears))),
      ...calculatorInput,
    };
    if (input.appraisedValue > 0 && input.loanBalance > 0 && input.newInterestRate > 0) {
      setResults(calculateRefinance(input));
    }
  }, [statementData, calculatorInput]);

  const updateInput = <K extends keyof typeof defaultCalculatorInput>(key: K, value: (typeof defaultCalculatorInput)[K]) => {
    setCalculatorInput(prev => ({ ...prev, [key]: value }));
  };

  const handleRefinanceTypeChange = (type: string) => {
    updateInput("refinanceType", type as "rate_and_term" | "cash_out");
    if (type === "rate_and_term") updateInput("cashOutAmount", 0);
  };

  const handleAnalysisComplete = (analysis: MortgageAnalysis) => { setStatementData(analysis); };

  const handleAnalyzed = (analysis: MortgageAnalysis) => {
    if (trackedLoans.length >= MAX_TRACKED_LOANS) return;
    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const incoming = normalize(analysis.propertyAddress || "");
    const duplicate = trackedLoans.find(l => normalize(l.propertyAddress) === incoming);
    if (duplicate) return;
    setTrackedLoans(prev => [analysisToTrackedLoan(analysis), ...prev]);
  };

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
            onSelectRate={rate => updateInput("newInterestRate", rate)}
            selectedRate={calculatorInput.newInterestRate}
            className="h-full"
          />
        </div>

        {/* Loan Tracker */}
        <LoanTracker
          loans={trackedLoans}
          liveRates={ratesData?.rates ?? []}
          onRemove={id => setTrackedLoans(prev => prev.filter(l => l.id !== id))}
          onUpdate={(id, updates) => setTrackedLoans(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
          maxLoans={MAX_TRACKED_LOANS}
        />

      </main>

      <footer className="border-t mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>This calculator provides estimates only. Actual rates and terms may vary. Consult with a licensed mortgage professional for personalized advice.</p>
        </div>
      </footer>

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
