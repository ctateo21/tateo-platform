import { useMemo, useState, useEffect, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Home, DollarSign, TrendingDown, TrendingUp,
  CheckCircle2, XCircle, AlertCircle, MapPin, Pencil,
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  ClipboardList, RefreshCw, Calendar, Shield,
} from "lucide-react";
import { estimateAnnualTax } from "@/lib/county-tax-estimator";
import LeadCaptureDialog from "@/components/ui/lead-capture-dialog";
import { useToast } from "@/hooks/use-toast";

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcPI(loanAmount: number, annualRate: number, termMonths: number): number {
  if (loanAmount <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 12;
  return loanAmount * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

function fmt(n: number) { return "$" + Math.round(n).toLocaleString(); }
function fmtPct(n: number) { return (n * 100).toFixed(1) + "%"; }
function fmtNum(n: number, d = 2) { return n.toFixed(d); }

const FALLBACK_RATES = { conventional: 6.82, fha: 6.17, va: 6.25 };

// ─── SliderInput ─────────────────────────────────────────────────────────────

function SliderInput({
  label, value, onChange, min, max, step, prefix = "", suffix = "", decimals = 0,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
  prefix?: string; suffix?: string; decimals?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="flex-1 accent-primary"
        />
        <div className="w-28 shrink-0">
          {editing ? (
            <input
              type="number"
              value={raw}
              onChange={e => setRaw(e.target.value)}
              onBlur={() => {
                const v = parseFloat(raw);
                if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
                setEditing(false);
              }}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === "Escape") {
                  const v = parseFloat(raw);
                  if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
                  setEditing(false);
                }
              }}
              autoFocus
              className="w-full text-sm border rounded px-2 py-1 text-right outline-none focus:ring-1 ring-primary"
            />
          ) : (
            <button
              onClick={() => { setRaw(value.toFixed(decimals)); setEditing(true); }}
              className="w-full text-sm font-semibold text-right bg-muted/50 hover:bg-muted rounded px-2 py-1 transition-colors"
            >
              {prefix}{decimals === 0 ? Math.round(value).toLocaleString() : value.toFixed(decimals)}{suffix}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function Row({ label, value, sub, status }: { label: string; value: string; sub?: string; status?: "green" | "yellow" | "red" }) {
  const bg = status === "green" ? "bg-green-50" : status === "yellow" ? "bg-yellow-50" : status === "red" ? "bg-red-50" : "";
  const labelColor = status === "green" ? "text-green-800" : status === "yellow" ? "text-yellow-800" : status === "red" ? "text-red-800" : "text-muted-foreground";
  const valueColor = status === "green" ? "text-green-700 font-bold" : status === "yellow" ? "text-yellow-700 font-bold" : status === "red" ? "text-red-700 font-bold" : "font-semibold";
  const subColor = status === "green" ? "text-green-600" : status === "yellow" ? "text-yellow-600" : status === "red" ? "text-red-600" : "text-muted-foreground";
  return (
    <div className={`flex justify-between items-center py-2 px-2 rounded-md ${bg}`}>
      <span className={`text-sm ${labelColor}`}>{label}</span>
      <span className={`text-sm text-right ${valueColor}`}>
        {value}
        {sub && <span className={`block text-xs font-normal ${subColor}`}>{sub}</span>}
      </span>
    </div>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0 gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-medium text-right truncate">{value}</span>
        <button onClick={onEdit} className="text-primary/50 hover:text-primary transition-colors shrink-0" title="Edit">
          <Pencil className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

interface RefiInputs {
  homeValue: number;
  currentBalance: number;
  currentRate: number;
  remainingYears: number;
  newRate: number;
  newTermYears: number;
  closingCosts: number;
  rollClosingCosts: boolean;
  cashOut: number;
  loanType: "conventional" | "fha" | "va";
  monthlyIncome: number;
  monthlyDebts: number;
  creditScore: number;
  annualTaxes: number;
  monthlyInsurance: number;
}

const DEFAULT_INPUTS: RefiInputs = {
  homeValue: 350000,
  currentBalance: 280000,
  currentRate: 7.5,
  remainingYears: 25,
  newRate: 6.65,
  newTermYears: 30,
  closingCosts: 6000,
  rollClosingCosts: false,
  cashOut: 0,
  loanType: "conventional",
  monthlyIncome: 7000,
  monthlyDebts: 500,
  creditScore: 720,
  annualTaxes: 4500,
  monthlyInsurance: 150,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Refinance() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const address = params.get("address") || "Your Property";

  const [step, setStep] = useState(1);
  const [answersOpen, setAnswersOpen] = useState(false);
  const [inputs, setInputs] = useState<RefiInputs>(() => ({
    ...DEFAULT_INPUTS,
    annualTaxes: estimateAnnualTax(address, DEFAULT_INPUTS.homeValue, true),
  }));
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const { toast } = useToast();

  function set<K extends keyof RefiInputs>(key: K, val: RefiInputs[K]) {
    setInputs(p => ({ ...p, [key]: val }));
  }

  const { data: rates } = useQuery<{ conventional: number; fha: number; va: number }>({
    queryKey: ["/api/mortgage-rates"],
    staleTime: 5 * 60 * 1000,
  });

  const liveRate = rates?.conventional ?? FALLBACK_RATES.conventional;

  useEffect(() => {
    if (rates) {
      setInputs(p => ({ ...p, newRate: rates.conventional }));
    }
  }, [rates]);

  // ─── Calculations ─────────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const currentMonths = Math.round(inputs.remainingYears * 12);
    const currentPayment = calcPI(inputs.currentBalance, inputs.currentRate / 100, currentMonths);

    const newLoanBase = inputs.currentBalance + inputs.cashOut;
    const newLoanAmount = inputs.rollClosingCosts
      ? newLoanBase + inputs.closingCosts
      : newLoanBase;
    const newMonths = inputs.newTermYears * 12;
    const newPayment = calcPI(newLoanAmount, inputs.newRate / 100, newMonths);

    const monthlySavings = currentPayment - newPayment;
    const breakEvenMonths = monthlySavings > 0 && !inputs.rollClosingCosts
      ? Math.ceil(inputs.closingCosts / monthlySavings)
      : monthlySavings > 0 && inputs.rollClosingCosts
      ? 0
      : null;

    const currentTotalInterest = currentPayment * currentMonths - inputs.currentBalance;
    const newTotalInterest = newPayment * newMonths - newLoanAmount;
    const interestSaved = currentTotalInterest - newTotalInterest;
    const netBenefit = interestSaved - (inputs.rollClosingCosts ? 0 : inputs.closingCosts);

    const ltv = newLoanAmount / inputs.homeValue;
    const equity = inputs.homeValue - newLoanAmount;

    const totalMonthly = newPayment + inputs.annualTaxes / 12 + inputs.monthlyInsurance;
    const dti = inputs.monthlyIncome > 0 ? (totalMonthly + inputs.monthlyDebts) / inputs.monthlyIncome : 1;
    const housingDTI = inputs.monthlyIncome > 0 ? totalMonthly / inputs.monthlyIncome : 1;
    const qualifies = dti <= 0.45 && ltv <= 0.97 && inputs.creditScore >= 620;

    const recs: string[] = [];
    if (dti > 0.45) recs.push(`Your DTI of ${fmtPct(dti)} exceeds 45%. Consider a lower cash-out amount or longer term.`);
    if (ltv > 0.8 && ltv <= 0.97) recs.push(`LTV of ${fmtPct(ltv)} will likely require PMI. 20% equity avoids this.`);
    if (ltv > 0.97) recs.push(`LTV exceeds 97% — most lenders require more equity for a refinance.`);
    if (inputs.creditScore < 620) recs.push("Credit score below 620 may prevent approval. Work on improving it first.");
    if (monthlySavings <= 0) recs.push("The new rate doesn't lower your payment. Verify the rate or consider other options.");
    if (breakEvenMonths !== null && breakEvenMonths > 60) recs.push(`Break-even of ${breakEvenMonths} months is over 5 years — evaluate whether you plan to stay that long.`);

    return {
      currentPayment, newPayment, newLoanAmount, monthlySavings,
      breakEvenMonths, currentTotalInterest, newTotalInterest,
      interestSaved, netBenefit, ltv, equity, totalMonthly,
      dti, housingDTI, qualifies, recs,
    };
  }, [inputs]);

  const totalSteps = 3;

  const stepLabels = ["Current Loan", "New Loan Details", "Your Profile"];

  return (
    <>
      <Helmet>
        <title>Refinance Analysis — {address}</title>
      </Helmet>

      <div className="min-h-screen bg-gray-50">

        {/* Top bar */}
        <div className="bg-white border-b shadow-sm sticky top-[73px] z-40">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <button onClick={() => setLocation("/select-service?address=" + encodeURIComponent(address))} className="text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Refinance Analysis
                </p>
                <p className="font-semibold text-sm flex items-center gap-1.5 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="leading-tight">{address}</span>
                </p>
              </div>
            </div>
            <Button size="sm" className="gap-1.5 bg-secondary hover:bg-secondary/90 text-white" onClick={() => setLeadDialogOpen(true)}>
              Save Analysis
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-6">

          {/* Progress */}
          <div className="max-w-2xl mx-auto mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">
                {step <= totalSteps ? stepLabels[step - 1] : "Your Refinance Analysis"}
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                Page {step} of {totalSteps + 1}
              </p>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps + 1 }, (_, i) => i + 1).map((s) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${s <= step ? "bg-primary" : "bg-border"}`} />
              ))}
            </div>
          </div>

          <div className="max-w-2xl mx-auto space-y-4">

            {/* ── STEP 1: Current Loan ── */}
            {step === 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Home className="h-4 w-4 text-primary" />
                    Current Loan Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <SliderInput
                    label="Estimated Home Value"
                    value={inputs.homeValue}
                    onChange={v => setInputs(p => ({
                      ...p,
                      homeValue: v,
                      annualTaxes: estimateAnnualTax(address, v, true),
                    }))}
                    min={50000} max={3000000} step={5000}
                    prefix="$"
                  />

                  <SliderInput
                    label="Current Loan Balance"
                    value={inputs.currentBalance}
                    onChange={v => set("currentBalance", v)}
                    min={10000} max={2000000} step={5000}
                    prefix="$"
                  />
                  {(() => {
                    const equity = inputs.homeValue - inputs.currentBalance;
                    const ltv = inputs.homeValue > 0 ? (inputs.currentBalance / inputs.homeValue) * 100 : 0;
                    return (
                      <p className="text-[11px] text-muted-foreground -mt-3 leading-tight">
                        LTV: {ltv.toFixed(1)}% · Equity: {fmt(equity)} ({fmtPct(equity / inputs.homeValue)})
                      </p>
                    );
                  })()}

                  <SliderInput
                    label="Current Interest Rate"
                    value={inputs.currentRate}
                    onChange={v => set("currentRate", v)}
                    min={2} max={15} step={0.125}
                    suffix="%" decimals={3}
                  />
                  <p className="text-[11px] text-muted-foreground -mt-3 leading-tight">
                    Current monthly P&I: <strong>{fmt(calcPI(inputs.currentBalance, inputs.currentRate / 100, inputs.remainingYears * 12))}</strong>
                  </p>

                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Remaining Term</p>
                    <div className="flex gap-2 flex-wrap">
                      {[30, 25, 20, 15, 10].map(y => (
                        <button
                          key={y}
                          onClick={() => set("remainingYears", y)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.remainingYears === y ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                        >
                          {y} yrs
                        </button>
                      ))}
                    </div>
                    <SliderInput
                      label=""
                      value={inputs.remainingYears}
                      onChange={v => set("remainingYears", v)}
                      min={1} max={30} step={1}
                      suffix=" yrs" decimals={0}
                    />
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Loan Type</p>
                    <div className="flex gap-2">
                      {(["conventional", "fha", "va"] as const).map(lt => (
                        <button
                          key={lt}
                          onClick={() => set("loanType", lt)}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.loanType === lt ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                        >
                          {lt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 1 && (
              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} className="gap-2">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* ── STEP 2: New Loan Details ── */}
            {step === 2 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    New Loan Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">New Interest Rate</span>
                      {rates && <span className="text-[10px] font-semibold bg-green-100 text-green-700 rounded px-1 py-0.5 leading-none">LIVE</span>}
                    </div>
                    <SliderInput
                      label=""
                      value={inputs.newRate}
                      onChange={v => set("newRate", v)}
                      min={3} max={12} step={0.005}
                      suffix="%" decimals={3}
                    />
                    {rates && (
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        Live {inputs.loanType.toUpperCase()} rate: {(rates as any)[inputs.loanType]?.toFixed(3) ?? liveRate.toFixed(3)}%
                        {" · "}
                        {inputs.newRate < inputs.currentRate
                          ? <span className="text-green-700 font-medium">↓ {(inputs.currentRate - inputs.newRate).toFixed(3)}% lower than your current rate</span>
                          : <span className="text-amber-600 font-medium">↑ {(inputs.newRate - inputs.currentRate).toFixed(3)}% higher than current rate</span>
                        }
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">New Loan Term</p>
                    <div className="flex gap-2 flex-wrap">
                      {[30, 20, 15, 10].map(y => (
                        <button
                          key={y}
                          onClick={() => set("newTermYears", y)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.newTermYears === y ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                        >
                          {y} yr
                        </button>
                      ))}
                    </div>
                  </div>

                  <SliderInput
                    label="Estimated Closing Costs"
                    value={inputs.closingCosts}
                    onChange={v => set("closingCosts", v)}
                    min={0} max={25000} step={250}
                    prefix="$"
                  />
                  <p className="text-[11px] text-muted-foreground -mt-3 leading-tight">
                    Typically 2–3% of loan amount ({fmt(inputs.currentBalance * 0.02)}–{fmt(inputs.currentBalance * 0.03)})
                  </p>

                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Roll closing costs into the loan?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => set("rollClosingCosts", true)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.rollClosingCosts ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                      >
                        Yes — add to balance
                      </button>
                      <button
                        onClick={() => set("rollClosingCosts", false)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${!inputs.rollClosingCosts ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                      >
                        No — pay at closing
                      </button>
                    </div>
                  </div>

                  <SliderInput
                    label="Cash-Out Amount (optional)"
                    value={inputs.cashOut}
                    onChange={v => set("cashOut", v)}
                    min={0} max={200000} step={1000}
                    prefix="$"
                  />
                  {inputs.cashOut > 0 && (
                    <p className="text-[11px] text-muted-foreground -mt-3 leading-tight">
                      Cash-out adds to your new loan balance. New balance: <strong>{fmt(inputs.currentBalance + inputs.cashOut + (inputs.rollClosingCosts ? inputs.closingCosts : 0))}</strong>
                    </p>
                  )}

                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={() => setStep(3)} className="gap-2">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* ── STEP 3: Your Profile ── */}
            {step === 3 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Your Profile
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Used to check qualification for the new loan.</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <SliderInput
                    label="Monthly Gross Income"
                    value={inputs.monthlyIncome}
                    onChange={v => set("monthlyIncome", v)}
                    min={1000} max={50000} step={100}
                    prefix="$"
                  />
                  <SliderInput
                    label="Other Monthly Debts (auto, cards, etc.)"
                    value={inputs.monthlyDebts}
                    onChange={v => set("monthlyDebts", v)}
                    min={0} max={10000} step={50}
                    prefix="$"
                  />
                  <SliderInput
                    label="Credit Score"
                    value={inputs.creditScore}
                    onChange={v => set("creditScore", v)}
                    min={580} max={850} step={10}
                  />
                  <Separator />
                  <SliderInput
                    label="Annual Property Taxes"
                    value={inputs.annualTaxes}
                    onChange={v => set("annualTaxes", v)}
                    min={0} max={30000} step={100}
                    prefix="$"
                  />
                  <SliderInput
                    label="Monthly Homeowners Insurance"
                    value={inputs.monthlyInsurance}
                    onChange={v => set("monthlyInsurance", v)}
                    min={0} max={2000} step={10}
                    prefix="$"
                  />
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={() => setStep(4)} className="gap-2">
                  See My Analysis <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* ── STEP 4: Results ── */}
            {step === 4 && (
              <div className="space-y-4">

                {/* Answers accordion */}
                <div className="border border-border rounded-xl overflow-hidden bg-white shadow-sm">
                  <button
                    onClick={() => setAnswersOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      Review Your Answers (Pages 1–3)
                    </span>
                    {answersOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {answersOpen && (
                    <div className="border-t border-border px-4 py-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Page 1 — Current Loan</p>
                        <SummaryRow label="Home Value" value={fmt(inputs.homeValue)} onEdit={() => setStep(1)} />
                        <SummaryRow label="Balance" value={fmt(inputs.currentBalance)} onEdit={() => setStep(1)} />
                        <SummaryRow label="Current Rate" value={`${fmtNum(inputs.currentRate, 3)}%`} onEdit={() => setStep(1)} />
                        <SummaryRow label="Remaining Term" value={`${inputs.remainingYears} yrs`} onEdit={() => setStep(1)} />
                        <SummaryRow label="Loan Type" value={inputs.loanType.toUpperCase()} onEdit={() => setStep(1)} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Page 2 — New Loan</p>
                        <SummaryRow label="New Rate" value={`${fmtNum(inputs.newRate, 3)}%`} onEdit={() => setStep(2)} />
                        <SummaryRow label="New Term" value={`${inputs.newTermYears} yrs`} onEdit={() => setStep(2)} />
                        <SummaryRow label="Closing Costs" value={fmt(inputs.closingCosts)} onEdit={() => setStep(2)} />
                        <SummaryRow label="Roll Costs In?" value={inputs.rollClosingCosts ? "Yes" : "No"} onEdit={() => setStep(2)} />
                        {inputs.cashOut > 0 && <SummaryRow label="Cash-Out" value={fmt(inputs.cashOut)} onEdit={() => setStep(2)} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Page 3 — Profile</p>
                        <SummaryRow label="Monthly Income" value={fmt(inputs.monthlyIncome)} onEdit={() => setStep(3)} />
                        <SummaryRow label="Monthly Debts" value={fmt(inputs.monthlyDebts)} onEdit={() => setStep(3)} />
                        <SummaryRow label="Credit Score" value={String(inputs.creditScore)} onEdit={() => setStep(3)} />
                        <SummaryRow label="Annual Taxes" value={fmt(inputs.annualTaxes)} onEdit={() => setStep(3)} />
                        <SummaryRow label="Insurance" value={fmt(inputs.monthlyInsurance) + "/mo"} onEdit={() => setStep(3)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Qualification banner */}
                <div className="overflow-hidden rounded-xl border-2 border-primary/20">
                  <div className={`w-full py-2 px-4 text-center text-sm font-semibold tracking-wide ${calc.qualifies ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
                    {calc.qualifies ? "✓ Likely Qualifies for Refinance" : "⚠ Needs Review — See Recommendations"}
                  </div>
                  <div className="bg-primary/5 px-5 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">New Monthly Payment</p>
                        <p className="text-2xl font-bold text-primary">{fmt(calc.newPayment)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Monthly Savings</p>
                        <p className={`text-2xl font-bold ${calc.monthlySavings > 0 ? "text-green-600" : "text-red-600"}`}>
                          {calc.monthlySavings > 0 ? "+" : ""}{fmt(calc.monthlySavings)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Break-Even</p>
                        <p className="text-2xl font-bold text-primary">
                          {calc.breakEvenMonths !== null ? `${calc.breakEvenMonths} mo` : "N/A"}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Interest Saved</p>
                        <p className={`text-2xl font-bold ${calc.netBenefit > 0 ? "text-green-600" : "text-red-600"}`}>
                          {calc.netBenefit > 0 ? "+" : ""}{fmt(calc.netBenefit)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Comparison */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-primary">
                      <TrendingDown className="h-4 w-4" /> Payment Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                        <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">Current Loan</p>
                        <p className="text-xl font-bold text-red-700">{fmt(calc.currentPayment)}<span className="text-xs font-normal">/mo</span></p>
                        <p className="text-[10px] text-red-500 mt-1">{inputs.currentRate.toFixed(3)}% · {inputs.remainingYears} yr remaining</p>
                      </div>
                      <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                        <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-1">New Loan</p>
                        <p className="text-xl font-bold text-green-700">{fmt(calc.newPayment)}<span className="text-xs font-normal">/mo</span></p>
                        <p className="text-[10px] text-green-500 mt-1">{inputs.newRate.toFixed(3)}% · {inputs.newTermYears} yr term</p>
                      </div>
                    </div>
                    <Separator />
                    <Row label="Current Loan Balance" value={fmt(inputs.currentBalance)} />
                    <Row label="Cash-Out Amount" value={fmt(inputs.cashOut)} />
                    <Row label="Closing Costs" value={`${fmt(inputs.closingCosts)} ${inputs.rollClosingCosts ? "(rolled in)" : "(paid at closing)"}`} />
                    <Separator />
                    <Row label="New Loan Balance" value={fmt(calc.newLoanAmount)} sub={`LTV ${fmtPct(calc.ltv)} · Equity ${fmt(calc.equity)}`} />
                    <Row
                      label="Monthly Savings"
                      value={`${calc.monthlySavings > 0 ? "+" : ""}${fmt(calc.monthlySavings)}/mo`}
                      status={calc.monthlySavings > 50 ? "green" : calc.monthlySavings > 0 ? "yellow" : "red"}
                    />
                    {calc.breakEvenMonths !== null && (
                      <Row
                        label="Break-Even Point"
                        value={`${calc.breakEvenMonths} months`}
                        sub={calc.breakEvenMonths <= 24 ? "Excellent — under 2 years" : calc.breakEvenMonths <= 48 ? "Good — under 4 years" : "Long — consider how long you'll stay"}
                        status={calc.breakEvenMonths <= 24 ? "green" : calc.breakEvenMonths <= 48 ? "yellow" : "red"}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Interest Savings */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-primary">
                      <DollarSign className="h-4 w-4" /> Lifetime Interest Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Row label="Current Remaining Interest" value={fmt(calc.currentTotalInterest)} sub={`Over ${inputs.remainingYears} yrs`} />
                    <Row label="New Total Interest" value={fmt(calc.newTotalInterest)} sub={`Over ${inputs.newTermYears} yrs`} />
                    <Separator />
                    <Row
                      label="Total Interest Saved"
                      value={fmt(calc.interestSaved)}
                      status={calc.interestSaved > 0 ? "green" : "red"}
                    />
                    <Row
                      label="Net Benefit (after closing costs)"
                      value={fmt(calc.netBenefit)}
                      status={calc.netBenefit > 0 ? "green" : "red"}
                    />
                    {inputs.cashOut > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                          <strong>Cash-Out Note:</strong> You're taking out {fmt(inputs.cashOut)} in equity. This increases your balance and interest paid, but provides liquidity for other goals.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Qualification */}
                <Card className={`border-2 ${calc.qualifies ? "border-green-200" : "border-red-200"}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      Qualification Check
                      {calc.qualifies ? (
                        <Badge className="ml-auto bg-green-100 text-green-700 border border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Likely Qualifies
                        </Badge>
                      ) : (
                        <Badge className="ml-auto bg-red-100 text-red-700 border border-red-300">
                          <XCircle className="h-3 w-3 mr-1" /> Needs Review
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Row label="New Monthly P&I" value={fmt(calc.newPayment)} />
                    <Row label="Taxes + Insurance" value={`${fmt(inputs.annualTaxes / 12 + inputs.monthlyInsurance)}/mo`} />
                    <Row label="Total Housing Payment" value={fmt(calc.totalMonthly)} />
                    <Separator />
                    <Row
                      label="Housing DTI"
                      value={fmtPct(calc.housingDTI)}
                      sub="New housing ÷ gross income · Max ~28–31%"
                      status={calc.housingDTI <= 0.28 ? "green" : calc.housingDTI <= 0.36 ? "yellow" : "red"}
                    />
                    <Row
                      label="Total DTI"
                      value={fmtPct(calc.dti)}
                      sub="Housing + debts ÷ gross income · Max 45%"
                      status={calc.dti <= 0.36 ? "green" : calc.dti <= 0.45 ? "yellow" : "red"}
                    />
                    <Separator />
                    <Row
                      label="LTV"
                      value={fmtPct(calc.ltv)}
                      sub={calc.ltv > 0.8 ? "Over 80% — PMI likely required" : "Under 80% — no PMI needed"}
                      status={calc.ltv <= 0.8 ? "green" : calc.ltv <= 0.97 ? "yellow" : "red"}
                    />
                    <Row
                      label="Credit Score"
                      value={String(inputs.creditScore)}
                      status={inputs.creditScore >= 740 ? "green" : inputs.creditScore >= 620 ? "yellow" : "red"}
                    />

                    {calc.recs.length > 0 && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                        <p className="text-xs font-semibold text-amber-800 flex items-center gap-1 uppercase tracking-wide">
                          <AlertCircle className="h-3 w-3" /> Recommendations
                        </p>
                        {calc.recs.map((rec, i) => (
                          <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                            <TrendingUp className="h-3 w-3 mt-0.5 shrink-0" />
                            {rec}
                          </p>
                        ))}
                      </div>
                    )}

                    {calc.qualifies && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs font-semibold text-green-800 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Based on the information provided, this refinance looks favorable. Connect with a licensed mortgage professional to get started.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <p className="text-xs text-muted-foreground text-center px-4 pb-4">
                  All estimates are for informational purposes only and are not a commitment to lend. Actual rates, payments, and qualification requirements may vary. Contact a licensed mortgage professional for a full analysis.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>

      <LeadCaptureDialog
        open={leadDialogOpen}
        onOpenChange={setLeadDialogOpen}
        action="save"
        address={address}
        onSuccess={() => {
          toast({ title: "Saved!", description: "Your refinance analysis has been saved." });
        }}
      />
    </>
  );
}
