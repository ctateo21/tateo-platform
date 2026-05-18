import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Home, Calculator, Banknote, ArrowDownToLine, AlertTriangle, FileUp, ArrowLeft } from "lucide-react";
import { CurrencyInput } from "@/components/refi/currency-input";
import { PercentInput } from "@/components/refi/percent-input";
import { ResultsCard } from "@/components/refi/results-card";
import { LiveRatesCard } from "@/components/refi/live-rates-card";
import { StatementAnalyzer } from "@/components/refi/statement-analyzer";
import { LoanTracker, type TrackedLoan, type MortgageAnalysis, type LiveRate } from "@/components/refi/loan-tracker";
import { calculateRefinance, type RefinanceInput, type RefinanceResult, formatCurrency } from "@/lib/refi-calculations";
import { useQuery } from "@tanstack/react-query";

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

        {/* Calculator + Results */}
        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-6">
            {!statementData ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <FileUp className="h-10 w-10 mb-3 opacity-40" />
                  <p className="font-medium">Upload a statement to continue</p>
                  <p className="text-sm mt-1">Once analyzed, your refinance options and savings will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Tabs value={calculatorInput.refinanceType} onValueChange={handleRefinanceTypeChange} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="rate_and_term"><Calculator className="h-4 w-4 mr-2" />Rate & Term</TabsTrigger>
                    <TabsTrigger value="cash_out"><Banknote className="h-4 w-4 mr-2" />Cash-Out</TabsTrigger>
                  </TabsList>

                  <TabsContent value="rate_and_term" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Rate & Term Refinance</CardTitle>
                        <CardDescription>Lower your interest rate or change your loan term without taking cash out.</CardDescription>
                      </CardHeader>
                    </Card>
                  </TabsContent>

                  <TabsContent value="cash_out" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Cash-Out Refinance</CardTitle>
                        <CardDescription>Access your home's equity by borrowing more than you currently owe.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Cash-Out Amount</Label>
                          <CurrencyInput value={calculatorInput.cashOutAmount || 0} onChange={val => updateInput("cashOutAmount", val)} placeholder="0" />
                          {results && <p className="text-sm text-muted-foreground">Maximum available (80% LTV): {formatCurrency(results.cashOutAvailable)}</p>}
                        </div>
                        {results?.cashOutExceedsMax && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>Cash-out amount exceeds the maximum available based on 80% LTV. Consider reducing to {formatCurrency(results.cashOutAvailable)} or less.</AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />New Loan Terms</CardTitle>
                    <CardDescription>Configure the terms for your refinanced loan.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>New Interest Rate</Label>
                        <PercentInput value={calculatorInput.newInterestRate} onChange={val => updateInput("newInterestRate", val)} placeholder="6.65" />
                        <p className="text-xs text-muted-foreground">Select from live rates above, or enter manually</p>
                      </div>
                      <div className="space-y-2">
                        <Label>New Loan Term</Label>
                        <Select value={calculatorInput.newLoanTermYears.toString()} onValueChange={val => updateInput("newLoanTermYears", parseInt(val))}>
                          <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 Years</SelectItem>
                            <SelectItem value="15">15 Years</SelectItem>
                            <SelectItem value="20">20 Years</SelectItem>
                            <SelectItem value="25">25 Years</SelectItem>
                            <SelectItem value="30">30 Years</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ArrowDownToLine className="h-5 w-5" />Closing Costs</CardTitle>
                    <CardDescription>Estimate your refinance closing costs. Typically 2–5% of the loan amount.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Closing Costs (%)</Label>
                        <PercentInput value={calculatorInput.closingCostsPercent} onChange={val => updateInput("closingCostsPercent", val)} placeholder="2" max={10} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fixed Costs</Label>
                        <CurrencyInput value={calculatorInput.closingCostsFixed} onChange={val => updateInput("closingCostsFixed", val)} placeholder="2,000" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-md">
                      <div className="space-y-0.5">
                        <Label htmlFor="includeInLoan" className="text-base">Roll Closing Costs into Loan</Label>
                        <p className="text-sm text-muted-foreground">Add closing costs to your new loan balance instead of paying upfront</p>
                      </div>
                      <Switch id="includeInLoan" checked={calculatorInput.includeClosingCostsInLoan} onCheckedChange={checked => updateInput("includeClosingCostsInLoan", checked)} />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="space-y-6">
            {results && <ResultsCard results={results} refinanceType={calculatorInput.refinanceType} />}
          </div>
        </div>
      </main>

      <footer className="border-t mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>This calculator provides estimates only. Actual rates and terms may vary. Consult with a licensed mortgage professional for personalized advice.</p>
        </div>
      </footer>
    </div>
  );
}
