import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  ChevronDown, ChevronUp, Trash2, MapPin, TrendingDown, TrendingUp,
  Minus, Clock, DollarSign, AlertCircle, Wallet, ArrowLeftRight,
  Banknote, Pencil, Check, X, Info, Landmark, Home, Building2,
} from "lucide-react";
import { calculateRefinance, calculateMonthlyPayment, formatCurrency, amortizeBalance, monthsBetween } from "@/lib/refi-calculations";

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

export const PROPERTY_TYPE_ADJUSTMENTS: Record<PropertyType, number> = { primary: 0.00, secondary: 0.25, investment: 0.75 };
const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = { primary: "Primary Home", secondary: "2nd Home", investment: "Investment" };
const PROPERTY_TYPE_COLORS: Record<PropertyType, string> = { primary: "bg-background text-foreground border", secondary: "bg-amber-600 text-white border-amber-600", investment: "bg-red-600 text-white border-red-600" };

export const CLOSING_COST_PERCENT = 0.60;
export const CLOSING_COST_FIXED = 4065;
export const NEW_TERM_YEARS = 30;
export const HE_RATE_MARGIN = 2.0;
export const HE_MAX_CLTV: Record<PropertyType, number> = { primary: 0.90, secondary: 0.80, investment: 0.80 };
const HELOC_DRAW_YEARS = 10;
const HELOC_REPAY_YEARS = 20;
const HE_LOAN_TERM_YEARS = 15;
const CASH_OUT_MAX_LTV = 0.75;

type HeProduct = "heloc" | "he_loan";

export function getBestConventionalRate(rates: LiveRate[]): LiveRate | null {
  return rates.find(r => r.name === "30 Yr. Fixed") ?? rates.find(r => r.type === "Conventional") ?? rates[0] ?? null;
}

function getRateDelta(currentRate: number, newRate: number) {
  const delta = currentRate - newRate;
  if (delta >= 0.75) return { label: "Good time to refi", color: "text-green-600", bg: "bg-green-50 border-green-200" };
  if (delta >= 0.25) return { label: "Marginal savings", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" };
  return { label: "Rates similar", color: "text-muted-foreground", bg: "bg-muted/40 border-border" };
}

export type BestOption = { type: "rate_term" | "second_lien" | "hold"; label: string; reason: string; badgeClass: string; cardBg: string; Icon: React.ElementType };

export function getBestOption(loan: TrackedLoan, adjustedTodayRate: number, propertyType: PropertyType): BestOption {
  const { loanBalance, estimatedHomeValue: homeValue, currentRate } = loan;
  const rateDelta = currentRate - adjustedTodayRate;
  const maxCltv = HE_MAX_CLTV[propertyType];
  const hasSecondLienEquity = homeValue > 0 && homeValue * maxCltv - loanBalance > 10_000;

  if (rateDelta <= 0) {
    if (hasSecondLienEquity) return { type: "second_lien", label: "2nd Lien Home Equity", reason: `Your ${currentRate.toFixed(2)}% rate is below today's market — protect it and tap equity via a 2nd lien instead`, badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300", cardBg: "bg-yellow-50 border-yellow-200", Icon: Landmark };
    return { type: "hold", label: "Hold — no action needed", reason: `Your ${currentRate.toFixed(2)}% rate is at or below today's market and equity is limited — wait for conditions to improve`, badgeClass: "bg-muted text-muted-foreground border", cardBg: "bg-muted/40 border-border", Icon: Home };
  }
  if (rateDelta >= 0.75) return { type: "rate_term", label: "Rate & Term Refinance", reason: `${rateDelta.toFixed(2)}% rate drop from ${currentRate.toFixed(2)}% → ${adjustedTodayRate.toFixed(2)}% — strongest savings opportunity right now`, badgeClass: "bg-blue-100 text-blue-800 border-blue-300", cardBg: "bg-blue-50 border-blue-200", Icon: ArrowLeftRight };
  if (hasSecondLienEquity) return { type: "second_lien", label: "2nd Lien Home Equity", reason: `Only a modest ${rateDelta.toFixed(2)}% rate gap — a 2nd lien lets you tap equity while keeping your current rate`, badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300", cardBg: "bg-yellow-50 border-yellow-200", Icon: Landmark };
  return { type: "rate_term", label: "Rate & Term Refinance", reason: `${rateDelta.toFixed(2)}% rate drop available — only viable option since equity is limited`, badgeClass: "bg-blue-100 text-blue-800 border-blue-300", cardBg: "bg-blue-50 border-blue-200", Icon: ArrowLeftRight };
}

function RateCompare({ current, today }: { current: number; today: number }) {
  const delta = current - today;
  return (
    <div className="flex items-center gap-2 text-sm flex-wrap">
      <span className="font-bold text-base">{current.toFixed(3)}%</span>
      <span className="text-muted-foreground">current</span>
      <span className="text-muted-foreground">→</span>
      <span className={`font-bold text-base ${delta > 0 ? "text-green-600" : "text-muted-foreground"}`}>{today.toFixed(2)}%</span>
      <span className="text-muted-foreground">today</span>
      {delta > 0 ? <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium"><TrendingDown className="h-3 w-3" />{delta.toFixed(2)}% lower</span>
        : delta < 0 ? <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium"><TrendingUp className="h-3 w-3" />{Math.abs(delta).toFixed(2)}% higher</span>
        : <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />Same</span>}
    </div>
  );
}

function CashOutSection({ loan, newRate, homeValue, onChangeHomeValue }: { loan: TrackedLoan; newRate: LiveRate; homeValue: number; onChangeHomeValue: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [editInput, setEditInput] = useState(String(Math.round(homeValue)));

  const maxNewLoan = Math.floor((homeValue * CASH_OUT_MAX_LTV - CLOSING_COST_FIXED) / (1 + CLOSING_COST_PERCENT / 100));
  const currentLTV = homeValue > 0 ? loan.loanBalance / homeValue : 1;
  const isLTVTooHigh = currentLTV >= CASH_OUT_MAX_LTV;
  const [newLoanAmount, setNewLoanAmount] = useState(isLTVTooHigh ? loan.loanBalance : maxNewLoan);
  const clampedLoan = Math.min(Math.max(newLoanAmount, loan.loanBalance), maxNewLoan);
  const cashOut = Math.max(0, clampedLoan - loan.loanBalance);
  const closingCosts = (clampedLoan * CLOSING_COST_PERCENT) / 100 + CLOSING_COST_FIXED;
  const finalLoanWithCosts = clampedLoan + closingCosts;
  const newMonthlyPI = calculateMonthlyPayment(finalLoanWithCosts, newRate.rate, NEW_TERM_YEARS);
  const newLTV = homeValue > 0 ? (finalLoanWithCosts / homeValue) * 100 : 0;

  function commitEdit() {
    const parsed = parseFloat(editInput.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed) && parsed > 0) { onChangeHomeValue(parsed); }
    setEditing(false);
  }

  if (isLTVTooHigh) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-sm text-red-700">1st lien cash-out refinance is not possible due to LTV limits</p>
          <p className="text-sm text-red-600">Your current LTV is <strong>{(currentLTV * 100).toFixed(1)}%</strong>, which exceeds the 75% maximum.</p>
          <div className="flex items-start gap-1 mt-2 text-xs text-red-500">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>Home value used: {formatCurrency(homeValue)} (AI estimate). <button className="underline" onClick={() => setEditing(true)}>Edit value</button></span>
          </div>
          {editing && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-red-700">$</span>
              <input type="text" className="border rounded px-2 py-1 text-sm w-36 bg-background" value={editInput} onChange={e => setEditInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }} autoFocus />
              <Button size="sm" variant="ghost" onClick={commitEdit} className="h-7 px-2"><Check className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 px-2"><X className="h-3 w-3" /></Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30 flex-wrap gap-2">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Est. Home Value</p>
          {editing ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">$</span>
              <input type="text" className="border rounded px-2 py-1 text-sm w-36 bg-background" value={editInput} onChange={e => setEditInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }} autoFocus />
              <Button size="sm" variant="ghost" onClick={commitEdit} className="h-7 px-2"><Check className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 px-2"><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">{formatCurrency(homeValue)}</span>
              <button onClick={() => { setEditInput(String(Math.round(homeValue))); setEditing(true); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <p className="text-xs text-amber-600">AI estimate — edit to use your actual value</p>
        </div>
        <div className="text-right space-y-0.5">
          <p className="text-xs text-muted-foreground">Current LTV</p>
          <p className="font-bold text-lg">{(currentLTV * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">75% max for cash-out</p>
        </div>
      </div>

      <div className="space-y-3 p-3 rounded-md border bg-background">
        <div className="flex items-baseline justify-between flex-wrap gap-1">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">New Loan Amount</p>
            <p className="font-bold text-2xl">{formatCurrency(finalLoanWithCosts)}</p>
          </div>
          <div className="text-right space-y-1">
            <div><p className="text-xs text-muted-foreground">Cash you'd receive</p><p className="font-bold text-xl text-green-600">{formatCurrency(cashOut)}</p></div>
            <div><p className="text-xs text-muted-foreground">Combined LTV</p><p className={`font-semibold text-sm ${newLTV > CASH_OUT_MAX_LTV * 100 ? "text-red-500" : ""}`}>{newLTV.toFixed(1)}%</p></div>
          </div>
        </div>
        <Slider min={loan.loanBalance} max={maxNewLoan} step={1000} value={[clampedLoan]} onValueChange={([val]) => setNewLoanAmount(val)} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Loan</p>
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">Monthly P&I</span><span className="font-semibold">{formatCurrency(loan.currentPI)}</span></div>
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">Loan Balance</span><span className="font-semibold">{formatCurrency(loan.loanBalance)}</span></div>
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">LTV</span><span className="font-semibold">{(currentLTV * 100).toFixed(1)}%</span></div>
        </div>
        <div className="rounded-lg border bg-green-50 border-green-200 p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">After Cash-Out</p>
            <Badge variant="outline" className="text-xs">{newRate.name} · {newRate.type}</Badge>
          </div>
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">New Rate</span><span className="font-bold text-lg">{newRate.rate.toFixed(2)}%</span></div>
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">New Monthly P&I</span><span className="font-semibold">{formatCurrency(newMonthlyPI)}</span></div>
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">New Loan Amount</span><span className="font-semibold">{formatCurrency(finalLoanWithCosts)} <span className="text-xs text-muted-foreground">(incl. costs)</span></span></div>
          <div className="flex justify-between"><span className="text-sm text-muted-foreground">Est. Closing Costs</span><span className="font-semibold">{formatCurrency(closingCosts)}</span></div>
        </div>
      </div>
    </div>
  );
}

function LoanCard({ loan, liveRates, onRemove, onUpdate }: { loan: TrackedLoan; liveRates: LiveRate[]; onRemove: () => void; onUpdate: (u: Partial<TrackedLoan>) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"rate_term" | "cash_out" | "home_equity">("rate_term");
  const [homeValue, setHomeValue] = useState(loan.estimatedHomeValue);
  const [propertyType, setPropertyType] = useState<PropertyType>(loan.propertyType);

  const bestRate = getBestConventionalRate(liveRates);
  const rateAdj = PROPERTY_TYPE_ADJUSTMENTS[propertyType];
  const adjustedRate = bestRate ? bestRate.rate + rateAdj : 6.65 + rateAdj;
  const heRate = adjustedRate + HE_RATE_MARGIN;

  const liveMonths = monthsBetween(loan.balanceAsOf ?? loan.addedAt);
  const currentBalance = liveMonths > 0 && loan.currentPI > 0 ? amortizeBalance(loan.loanBalance, loan.currentRate, loan.currentPI, liveMonths) : loan.loanBalance;

  const delta = getRateDelta(loan.currentRate, adjustedRate);
  const bestOption = getBestOption({ ...loan, loanBalance: currentBalance, estimatedHomeValue: homeValue }, adjustedRate, propertyType);

  const rateTerm = calculateRefinance({
    appraisedValue: homeValue,
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
    <Card className="overflow-hidden">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-base truncate flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary shrink-0" />{loan.propertyAddress}</p>
              <Badge variant="outline" className={`text-xs shrink-0 ${PROPERTY_TYPE_COLORS[propertyType]}`}>{PROPERTY_TYPE_LABELS[propertyType]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{loan.lender} · Added {new Date(loan.addedAt).toLocaleDateString()}</p>
            <RateCompare current={loan.currentRate} today={adjustedRate} />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className={`px-3 py-1.5 rounded-md border text-xs font-semibold ${delta.bg} ${delta.color}`}>{delta.label}</div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={e => { e.stopPropagation(); onRemove(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
            {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div><p className="text-xs text-muted-foreground">Balance</p><p className="font-bold">{formatCurrency(currentBalance)}</p>{liveMonths > 0 && <p className="text-xs text-muted-foreground">amortized {liveMonths}mo</p>}</div>
          <div><p className="text-xs text-muted-foreground">Current P&I</p><p className="font-bold">{formatCurrency(loan.currentPI)}/mo</p></div>
          <div><p className="text-xs text-muted-foreground">New P&I (est.)</p><p className={`font-bold ${rateTerm.monthlySavings > 0 ? "text-green-600" : "text-muted-foreground"}`}>{formatCurrency(rateTerm.monthlyPaymentNew)}/mo</p></div>
          <div><p className="text-xs text-muted-foreground">Monthly Savings</p><p className={`font-bold ${rateTerm.monthlySavings > 0 ? "text-green-600" : "text-red-500"}`}>{rateTerm.monthlySavings > 0 ? "+" : ""}{formatCurrency(rateTerm.monthlySavings)}</p></div>
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-4">
          {/* Property type selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Property Type:</span>
            {(["primary", "secondary", "investment"] as PropertyType[]).map(pt => (
              <button key={pt} onClick={() => { setPropertyType(pt); onUpdate({ propertyType: pt }); }} className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${propertyType === pt ? PROPERTY_TYPE_COLORS[pt] : "border-border text-muted-foreground hover:border-primary"}`}>
                {PROPERTY_TYPE_LABELS[pt]}
              </button>
            ))}
            {rateAdj > 0 && <span className="text-xs text-amber-600">+{rateAdj.toFixed(2)}% LLPA for {PROPERTY_TYPE_LABELS[propertyType].toLowerCase()}</span>}
          </div>

          {/* Best option banner */}
          <div className={`rounded-lg border p-4 ${bestOption.cardBg}`}>
            <div className="flex items-start gap-3">
              <bestOption.Icon className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-sm">Recommended:</p>
                  <Badge variant="outline" className={`text-xs ${bestOption.badgeClass}`}>{bestOption.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{bestOption.reason}</p>
              </div>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex rounded-md border overflow-hidden text-sm font-medium">
            {([["rate_term", "Rate & Term", ArrowLeftRight], ["cash_out", "Cash-Out Refi", Banknote], ["home_equity", "2nd Lien / Home Equity", Wallet]] as const).map(([tab, label, Icon]) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-2 px-3 flex items-center justify-center gap-1.5 transition-colors text-xs ${activeTab === tab ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          {/* Rate & Term */}
          {activeTab === "rate_term" && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Loan</p>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Rate</span><span className="font-bold text-lg">{loan.currentRate.toFixed(3)}%</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Monthly P&I</span><span className="font-semibold">{formatCurrency(loan.currentPI)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Balance</span><span className="font-semibold">{formatCurrency(currentBalance)}</span></div>
                </div>
                <div className="rounded-lg border bg-green-50 border-green-200 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">After Refinance ({NEW_TERM_YEARS} yr)</p>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Rate</span><span className="font-bold text-lg text-green-700">{adjustedRate.toFixed(2)}%</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">New Monthly P&I</span><span className="font-semibold">{formatCurrency(rateTerm.monthlyPaymentNew)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">New Loan Amount</span><span className="font-semibold">{formatCurrency(rateTerm.newLoanAmount)}</span></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-md p-3 text-center ${rateTerm.monthlySavings > 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  <p className="text-xs text-muted-foreground mb-1">Monthly Savings</p>
                  <p className={`text-xl font-bold ${rateTerm.monthlySavings > 0 ? "text-green-700" : "text-red-700"}`}>{rateTerm.monthlySavings > 0 ? "+" : ""}{formatCurrency(rateTerm.monthlySavings)}</p>
                </div>
                <div className="rounded-md p-3 text-center bg-muted/30 border">
                  <p className="text-xs text-muted-foreground mb-1">Break-Even</p>
                  <p className="text-xl font-bold">{rateTerm.breakEvenMonths > 0 ? `${rateTerm.breakEvenMonths} mo` : "N/A"}</p>
                </div>
                <div className={`rounded-md p-3 text-center ${rateTerm.totalSavings > 0 ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                  <p className="text-xs text-muted-foreground mb-1">Lifetime Net</p>
                  <p className={`text-xl font-bold ${rateTerm.totalSavings > 0 ? "text-green-700" : "text-amber-700"}`}>{formatCurrency(Math.abs(rateTerm.totalSavings))}{rateTerm.totalSavings < 0 ? " loss" : ""}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Closing costs est. {formatCurrency(rateTerm.totalClosingCosts)} (rolled into new loan). Rates include {rateAdj > 0 ? `+${rateAdj.toFixed(2)}% LLPA for ${PROPERTY_TYPE_LABELS[propertyType].toLowerCase()}.` : "no LLPA adjustment for primary home."}</p>
            </div>
          )}

          {/* Cash-Out */}
          {activeTab === "cash_out" && bestRate && (
            <CashOutSection loan={{ ...loan, loanBalance: currentBalance, estimatedHomeValue: homeValue }} newRate={bestRate} homeValue={homeValue} onChangeHomeValue={setHomeValue} />
          )}

          {/* Home Equity */}
          {activeTab === "home_equity" && (
            <div className="space-y-4">
              <HomeEquitySection loan={{ ...loan, loanBalance: currentBalance }} heRate={heRate} rateAdjustment={rateAdj} propertyType={propertyType} homeValue={homeValue} onChangeHomeValue={setHomeValue} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function HomeEquitySection({ loan, heRate, rateAdjustment, propertyType, homeValue, onChangeHomeValue }: { loan: TrackedLoan; heRate: number; rateAdjustment: number; propertyType: PropertyType; homeValue: number; onChangeHomeValue: (v: number) => void }) {
  const [product, setProduct] = useState<HeProduct>("heloc");
  const [borrowAmount, setBorrowAmount] = useState(Infinity);
  const [editing, setEditing] = useState(false);
  const [editInput, setEditInput] = useState(String(Math.round(homeValue)));

  const maxCltv = HE_MAX_CLTV[propertyType];
  const maxHEAmount = Math.max(0, Math.floor(homeValue * maxCltv - loan.loanBalance));
  const clampedBorrow = Math.min(Math.max(borrowAmount === Infinity ? maxHEAmount : borrowAmount, 0), maxHEAmount);
  const cltv = homeValue > 0 ? (loan.loanBalance + clampedBorrow) / homeValue : 1;
  const notEnoughEquity = maxHEAmount <= 0;

  function commitEdit() {
    const parsed = parseFloat(editInput.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed) && parsed > 0) { onChangeHomeValue(parsed); setBorrowAmount(Infinity); }
    setEditing(false);
  }

  const helocInterestOnly = clampedBorrow > 0 ? clampedBorrow * (heRate / 100 / 12) : 0;
  const helocRepayment = calculateMonthlyPayment(clampedBorrow, heRate, HELOC_REPAY_YEARS);
  const heLoanMonthly = calculateMonthlyPayment(clampedBorrow, heRate, HE_LOAN_TERM_YEARS);
  const heLoanTotalInterest = clampedBorrow > 0 ? heLoanMonthly * HE_LOAN_TERM_YEARS * 12 - clampedBorrow : 0;

  if (notEnoughEquity) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm text-red-700">Not enough equity for a 2nd lien product</p>
          <p className="text-sm text-red-600">Your LTV leaves no room below the {(maxCltv * 100).toFixed(0)}% CLTV limit. Pay down your balance or wait for home value to increase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30 flex-wrap gap-2">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2nd Lien Rate</p>
            <p className="font-bold text-xl">{heRate.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">30yr + {HE_RATE_MARGIN.toFixed(2)}% 2nd-lien margin{rateAdjustment > 0 ? ` + ${rateAdjustment.toFixed(2)}% occupancy` : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Max Available</p>
            <p className="font-bold text-xl">{formatCurrency(maxHEAmount)}</p>
            <p className="text-xs text-muted-foreground">{(maxCltv * 100).toFixed(0)}% CLTV limit</p>
          </div>
        </div>
        <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30 flex-wrap gap-2">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Est. Home Value</p>
            {editing ? (
              <div className="flex items-center gap-1">
                <span className="text-sm">$</span>
                <input type="text" className="border rounded px-2 py-1 text-sm w-28 bg-background" value={editInput} onChange={e => setEditInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }} autoFocus />
                <Button size="sm" variant="ghost" onClick={commitEdit} className="h-7 px-1"><Check className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 px-1"><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl">{formatCurrency(homeValue)}</span>
                <button onClick={() => { setEditInput(String(Math.round(homeValue))); setEditing(true); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              </div>
            )}
            <p className="text-xs text-amber-600">AI estimate · edit to refine</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Current CLTV</p>
            <p className="font-bold text-xl">{homeValue > 0 ? ((loan.loanBalance / homeValue) * 100).toFixed(1) : "—"}%</p>
          </div>
        </div>
      </div>

      <div className="flex rounded-md border overflow-hidden text-sm font-medium">
        <button className={`flex-1 py-2 px-4 transition-colors ${product === "heloc" ? "bg-yellow-400 text-yellow-900 font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`} onClick={() => setProduct("heloc")}>
          HELOC <span className="text-xs font-normal opacity-80">(variable, interest-only draw)</span>
        </button>
        <button className={`flex-1 py-2 px-4 transition-colors ${product === "he_loan" ? "bg-yellow-400 text-yellow-900 font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`} onClick={() => setProduct("he_loan")}>
          Fixed HE Loan <span className="text-xs font-normal opacity-80">({HE_LOAN_TERM_YEARS}-yr fully amortizing)</span>
        </button>
      </div>

      <div className="space-y-3 p-3 rounded-md border bg-background">
        <div className="flex items-baseline justify-between flex-wrap gap-1">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{product === "heloc" ? "Line Amount" : "Loan Amount"}</p>
            <p className="font-bold text-2xl">{formatCurrency(clampedBorrow)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Combined LTV after</p>
            <p className={`font-bold text-lg ${cltv > maxCltv ? "text-red-500" : ""}`}>{(cltv * 100).toFixed(1)}%</p>
          </div>
        </div>
        <Slider min={0} max={maxHEAmount} step={1000} value={[clampedBorrow]} onValueChange={([val]) => setBorrowAmount(val)} />
        <div className="flex justify-between text-xs text-muted-foreground"><span>$0</span><span>Max {formatCurrency(maxHEAmount)}</span></div>
      </div>

      {clampedBorrow > 0 && product === "heloc" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-yellow-50 border-yellow-200 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Draw Period · {HELOC_DRAW_YEARS} yrs</p>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Monthly interest</span><span className="font-bold text-xl">{formatCurrency(helocInterestOnly)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Rate</span><span className="font-semibold">{heRate.toFixed(2)}%</span></div>
          </div>
          <div className="rounded-lg border bg-yellow-50 border-yellow-200 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Repayment Period · {HELOC_REPAY_YEARS} yrs</p>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Monthly P&I</span><span className="font-bold text-xl">{formatCurrency(helocRepayment)}</span></div>
            <div className="flex justify-between border-t pt-2 mt-1"><span className="text-sm font-medium">Combined monthly</span><span className="font-bold">{formatCurrency(loan.currentPI + helocRepayment)}</span></div>
          </div>
        </div>
      )}

      {clampedBorrow > 0 && product === "he_loan" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current 1st Mortgage</p>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Monthly P&I</span><span className="font-semibold">{formatCurrency(loan.currentPI)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Balance</span><span className="font-semibold">{formatCurrency(loan.loanBalance)}</span></div>
          </div>
          <div className="rounded-lg border bg-yellow-50 border-yellow-200 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fixed HE Loan · {HE_LOAN_TERM_YEARS} yrs</p>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Monthly P&I</span><span className="font-bold text-xl">{formatCurrency(heLoanMonthly)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Rate</span><span className="font-semibold">{heRate.toFixed(2)}%</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total interest</span><span className="font-semibold">{formatCurrency(heLoanTotalInterest)}</span></div>
            <div className="flex justify-between border-t pt-2 mt-1"><span className="text-sm font-medium">Combined monthly</span><span className="font-bold">{formatCurrency(loan.currentPI + heLoanMonthly)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

interface LoanTrackerProps {
  loans: TrackedLoan[];
  liveRates: LiveRate[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TrackedLoan>) => void;
  maxLoans?: number;
}

export function LoanTracker({ loans, liveRates, onRemove, onUpdate, maxLoans = 10 }: LoanTrackerProps) {
  if (loans.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" />Loan Dashboard <Badge variant="secondary">{loans.length}/{maxLoans}</Badge></h3>
      </div>
      <div className="space-y-3">
        {loans.map(loan => (
          <LoanCard key={loan.id} loan={loan} liveRates={liveRates} onRemove={() => onRemove(loan.id)} onUpdate={u => onUpdate(loan.id, u)} />
        ))}
      </div>
    </div>
  );
}
