import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trash2, MapPin, TrendingDown, TrendingUp, Minus, DollarSign,
} from "lucide-react";
import { calculateRefinance, formatCurrency, amortizeBalance, monthsBetween } from "@/lib/refi-calculations";

export interface MortgageAnalysis {
  loanBalance: number;
  interestRate: number;
  monthlyPayment: number;
  principalAndInterest: number;
  escrowAmount: number;
  propertyAddress: string;
  lender: string;
  estimatedRemainingYears: number;
  estimatedHomeValue: number;
  confidence: "high" | "medium" | "low";
  recommendation: string;
  potentialSavings: number;
  rawExtractedData: Record<string, string | number>;
}

export type PropertyType = "primary" | "secondary" | "investment";

export interface TrackedLoan {
  id: string;
  propertyAddress: string;
  lender: string;
  loanBalance: number;
  currentRate: number;
  currentPI: number;
  monthlyPayment: number;
  estimatedHomeValue: number;
  estimatedRemainingYears: number;
  addedAt: string;
  balanceAsOf?: string;
  propertyType: PropertyType;
}

export interface LiveRate {
  name: string;
  rate: number;
  change: number;
  type: string;
  lastUpdated: string;
}

const PROPERTY_TYPE_ADJUSTMENTS: Record<PropertyType, number> = { primary: 0.00, secondary: 0.25, investment: 0.75 };
const CLOSING_COST_PERCENT = 0.60;
const CLOSING_COST_FIXED = 4065;
const NEW_TERM_YEARS = 30;

function getBestConventionalRate(rates: LiveRate[]): number {
  const r = rates.find(r => r.name === "30 Yr. Fixed") ?? rates.find(r => r.type === "Conventional") ?? rates[0];
  return r?.rate ?? 6.65;
}

function getRateDelta(currentRate: number, newRate: number) {
  const delta = currentRate - newRate;
  if (delta >= 0.75) return { label: "Good time to refi", color: "text-green-600", bg: "bg-green-50 border-green-200" };
  if (delta >= 0.25) return { label: "Marginal savings", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" };
  return { label: "Rates similar", color: "text-muted-foreground", bg: "bg-muted/40 border-border" };
}

function RateCompare({ current, today }: { current: number; today: number }) {
  const delta = current - today;
  return (
    <div className="flex items-center gap-2 text-sm flex-wrap">
      <span className="font-bold">{current.toFixed(3)}%</span>
      <span className="text-muted-foreground">current →</span>
      <span className={`font-bold ${delta > 0 ? "text-green-600" : "text-muted-foreground"}`}>{today.toFixed(2)}%</span>
      <span className="text-muted-foreground">today</span>
      {delta > 0
        ? <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium"><TrendingDown className="h-3 w-3" />{delta.toFixed(2)}% lower</span>
        : delta < 0
        ? <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium"><TrendingUp className="h-3 w-3" />{Math.abs(delta).toFixed(2)}% higher</span>
        : <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />Same</span>}
    </div>
  );
}

function LoanCard({ loan, liveRates, onRemove }: { loan: TrackedLoan; liveRates: LiveRate[]; onRemove: () => void }) {
  const baseRate = getBestConventionalRate(liveRates);
  const rateAdj = PROPERTY_TYPE_ADJUSTMENTS[loan.propertyType];
  const adjustedRate = baseRate + rateAdj;

  const liveMonths = monthsBetween(loan.balanceAsOf ?? loan.addedAt);
  const currentBalance = liveMonths > 0 && loan.currentPI > 0
    ? amortizeBalance(loan.loanBalance, loan.currentRate, loan.currentPI, liveMonths)
    : loan.loanBalance;

  const delta = getRateDelta(loan.currentRate, adjustedRate);

  const rateTerm = calculateRefinance({
    appraisedValue: loan.estimatedHomeValue,
    loanBalance: currentBalance,
    currentInterestRate: loan.currentRate,
    newInterestRate: adjustedRate,
    currentTermRemainingYears: Math.max(1, Math.round(loan.estimatedRemainingYears)),
    newLoanTermYears: NEW_TERM_YEARS,
    closingCostsPercent: CLOSING_COST_PERCENT,
    closingCostsFixed: CLOSING_COST_FIXED,
    includeClosingCostsInLoan: true,
    refinanceType: "rate_and_term",
  });

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 min-w-0">
            <p className="font-semibold truncate flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary shrink-0" />{loan.propertyAddress}
            </p>
            <p className="text-sm text-muted-foreground">{loan.lender} · Added {new Date(loan.addedAt).toLocaleDateString()}</p>
            <RateCompare current={loan.currentRate} today={adjustedRate} />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className={`px-3 py-1.5 rounded-md border text-xs font-semibold ${delta.bg} ${delta.color}`}>{delta.label}</div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="font-bold">{formatCurrency(currentBalance)}</p>
            {liveMonths > 0 && <p className="text-xs text-muted-foreground">amortized {liveMonths}mo</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current P&I</p>
            <p className="font-bold">{formatCurrency(loan.currentPI)}/mo</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">New P&I (est.)</p>
            <p className={`font-bold ${rateTerm.monthlySavings > 0 ? "text-green-600" : "text-muted-foreground"}`}>
              {formatCurrency(rateTerm.monthlyPaymentNew)}/mo
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Monthly Savings</p>
            <p className={`font-bold ${rateTerm.monthlySavings > 0 ? "text-green-600" : "text-red-500"}`}>
              {rateTerm.monthlySavings > 0 ? "+" : ""}{formatCurrency(rateTerm.monthlySavings)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface LoanTrackerProps {
  loans: TrackedLoan[];
  liveRates: LiveRate[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TrackedLoan>) => void;
  maxLoans?: number;
}

export function LoanTracker({ loans, liveRates, onRemove, maxLoans = 10 }: LoanTrackerProps) {
  if (loans.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Loan Dashboard
          <Badge variant="secondary">{loans.length} of {maxLoans} statements uploaded</Badge>
        </h3>
      </div>
      <div className="space-y-3">
        {loans.map(loan => (
          <LoanCard
            key={loan.id}
            loan={loan}
            liveRates={liveRates}
            onRemove={() => onRemove(loan.id)}
          />
        ))}
      </div>
    </div>
  );
}
