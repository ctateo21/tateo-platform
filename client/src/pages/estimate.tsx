import { useMemo, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Home,
  Building2,
  Shield,
  UserCheck,
  ArrowLeft,
  Share2,
  Save,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  Percent,
} from "lucide-react";

// ─── Calculation helpers ────────────────────────────────────────────────────

function calcPI(loanAmount: number, annualRate: number, termMonths = 360): number {
  if (loanAmount <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 12;
  return loanAmount * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

function calcConventionalPMI(loanAmount: number, purchasePrice: number, creditScore: number): number {
  const ltv = loanAmount / purchasePrice;
  if (ltv <= 0.8) return 0;
  let baseRate = 0.012;
  if (ltv <= 0.85) baseRate = 0.005;
  else if (ltv <= 0.90) baseRate = 0.007;
  else if (ltv <= 0.95) baseRate = 0.010;
  if (creditScore >= 760) baseRate -= 0.002;
  else if (creditScore >= 720) baseRate -= 0.001;
  else if (creditScore < 680) baseRate += 0.002;
  return (loanAmount * Math.max(baseRate, 0)) / 12;
}

function calcFHAMIP(loanAmount: number, purchasePrice: number): number {
  const ltv = loanAmount / purchasePrice;
  const annualMIP = ltv > 0.9 ? 0.0085 : 0.0055;
  return (loanAmount * annualMIP) / 12;
}

function calcVAFundingFee(loanAmount: number, downPaymentPct: number): number {
  let rate = 0.023;
  if (downPaymentPct >= 10) rate = 0.014;
  else if (downPaymentPct >= 5) rate = 0.0165;
  return (loanAmount * rate) / 12;
}

function getMaxDTI(creditScore: number): number {
  if (creditScore >= 740) return 0.45;
  if (creditScore >= 700) return 0.43;
  if (creditScore >= 660) return 0.41;
  if (creditScore >= 640) return 0.38;
  return 0.36;
}

function calcInsuranceEstimate(
  purchasePrice: number,
  impactWindows: boolean,
  roofAttachment: string,
  swr: boolean
): number {
  let base = purchasePrice * 0.0075;
  if (impactWindows) base *= 0.85;
  if (swr) base *= 0.95;
  const roofMultiplier: Record<string, number> = {
    toenails: 1.0,
    clips: 0.92,
    "single-wraps": 0.88,
    "double-wraps": 0.82,
  };
  base *= roofMultiplier[roofAttachment] ?? 1.0;
  return Math.round(base);
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Inputs {
  purchasePrice: number;
  downPaymentPct: number;
  loanType: "conventional" | "fha" | "va";
  creditScore: number;
  interestRate: number;
  annualTaxes: number;
  hoaMonthly: number;
  cddAnnual: number;
  annualHOIns: number;
  annualFloodIns: number;
  monthlyDebts: number;
  monthlyIncome: number;
  reserves: number;
  impactWindows: boolean;
  roofAttachment: string;
  swr: boolean;
}

const RATES = { conventional: 0.069, fha: 0.066, va: 0.0668 };

// ─── Main component ──────────────────────────────────────────────────────────

export default function Estimate() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const address = params.get("address") || "Unknown Address";

  const defaultPrice = 400000;

  const [inputs, setInputs] = useState<Inputs>({
    purchasePrice: defaultPrice,
    downPaymentPct: 20,
    loanType: "conventional",
    creditScore: 740,
    interestRate: RATES.conventional * 100,
    annualTaxes: Math.round(defaultPrice * 0.015),
    hoaMonthly: 0,
    cddAnnual: 0,
    annualHOIns: Math.round(defaultPrice * 0.0075),
    annualFloodIns: 2000,
    monthlyDebts: 500,
    monthlyIncome: 8000,
    reserves: 15000,
    impactWindows: false,
    roofAttachment: "toenails",
    swr: false,
  });

  // Sync interest rate when loan type changes
  function setLoanType(lt: "conventional" | "fha" | "va") {
    setInputs((p) => ({ ...p, loanType: lt, interestRate: RATES[lt] * 100 }));
  }

  function set<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs((p) => ({ ...p, [key]: value }));
  }

  // ─── All calculations ──────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const { purchasePrice, downPaymentPct, loanType, creditScore, interestRate,
      annualTaxes, hoaMonthly, cddAnnual, annualHOIns, annualFloodIns,
      monthlyDebts, monthlyIncome, reserves, impactWindows, roofAttachment, swr } = inputs;

    const downPaymentAmt = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPaymentAmt;
    const rate = interestRate / 100;
    const ltv = loanAmount / purchasePrice;

    // PITI components
    const pi = calcPI(loanAmount, rate);
    const monthlyTax = annualTaxes / 12;
    const monthlyHOIns = annualHOIns / 12;
    const monthlyFlood = annualFloodIns / 12;
    const monthlyCDD = cddAnnual / 12;

    // PMI / MIP / VA
    const pmi = loanType === "conventional" ? calcConventionalPMI(loanAmount, purchasePrice, creditScore) : 0;
    const mip = loanType === "fha" ? calcFHAMIP(loanAmount, purchasePrice) : 0;
    const vaFee = loanType === "va" ? calcVAFundingFee(loanAmount, downPaymentPct) : 0;
    const mortgageInsurance = pmi + mip + vaFee;

    // Total housing payment
    const totalHousing = pi + monthlyTax + monthlyHOIns + monthlyFlood + hoaMonthly + monthlyCDD + mortgageInsurance;

    // Closing costs & cash to close
    const closingCosts = Math.round(purchasePrice * 0.03);
    const cashToClose = Math.round(downPaymentAmt + closingCosts);

    // DTI & qualification
    const dti = monthlyIncome > 0 ? (totalHousing + monthlyDebts) / monthlyIncome : 0;
    const maxDti = getMaxDTI(creditScore);
    const requiredIncome = Math.round((totalHousing + monthlyDebts) / maxDti);
    const requiredReserves = Math.round(totalHousing * 2);
    const qualifies = monthlyIncome >= requiredIncome && reserves >= cashToClose;

    // Insurance estimate with wind mitigation
    const estimatedHOIns = calcInsuranceEstimate(purchasePrice, impactWindows, roofAttachment, swr);

    // Loan comparison (Conventional, FHA, VA always at their base rates)
    const loanComparison = (["conventional", "fha", "va"] as const).map((lt) => {
      const ltRate = RATES[lt];
      const ltDown = lt === "va" ? 0 : lt === "fha" ? 3.5 : downPaymentPct;
      const ltLoan = purchasePrice * (1 - ltDown / 100);
      const ltPI = calcPI(ltLoan, ltRate);
      const ltPMI = lt === "conventional" ? calcConventionalPMI(ltLoan, purchasePrice, creditScore) : 0;
      const ltMIP = lt === "fha" ? calcFHAMIP(ltLoan, purchasePrice) : 0;
      const ltVA = lt === "va" ? calcVAFundingFee(ltLoan, ltDown) : 0;
      const ltMI = ltPMI + ltMIP + ltVA;
      const ltTotal = ltPI + monthlyTax + monthlyHOIns + hoaMonthly + monthlyCDD + ltMI;
      const ltDown$ = purchasePrice * (ltDown / 100);
      return { lt, rate: ltRate * 100, downPct: ltDown, downAmt: ltDown$, pi: ltPI, mi: ltMI, total: ltTotal };
    });

    // Qualification recommendations
    const recs: string[] = [];
    if (monthlyIncome < requiredIncome) {
      recs.push(`Increase income to at least ${fmt(requiredIncome)}/mo, or reduce monthly debts.`);
      if (purchasePrice > 300000) recs.push("Consider a lower purchase price.");
      if (downPaymentPct < 20) recs.push("A larger down payment reduces your monthly payment.");
      if (loanType === "conventional" && creditScore < 680) recs.push("Improving your credit score may unlock better rates.");
      if (loanType !== "fha") recs.push("FHA loans allow a lower qualifying income threshold.");
      if (loanType !== "va") recs.push("If eligible, a VA loan requires $0 down and has no PMI.");
    }
    if (reserves < cashToClose) {
      recs.push(`You need at least ${fmt(cashToClose)} in cash to close. Consider down payment assistance programs.`);
    }

    return {
      loanAmount, downPaymentAmt, pi, monthlyTax, monthlyHOIns, monthlyFlood,
      monthlyCDD, mortgageInsurance, pmi, mip, vaFee, totalHousing,
      closingCosts, cashToClose, dti, maxDti, requiredIncome, requiredReserves,
      qualifies, estimatedHOIns, loanComparison, recs, ltv
    };
  }, [inputs]);

  // ─── Formatters ────────────────────────────────────────────────────────────

  function fmt(n: number): string {
    return "$" + Math.round(n).toLocaleString();
  }
  function fmtPct(n: number): string {
    return (n * 100).toFixed(1) + "%";
  }

  // ─── Row helper ────────────────────────────────────────────────────────────

  function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
      <div className="flex justify-between items-center py-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-right">
          {value}
          {sub && <span className="block text-xs font-normal text-muted-foreground">{sub}</span>}
        </span>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Helmet>
        <title>Estimate — {address}</title>
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        {/* Top bar */}
        <div className="bg-white border-b shadow-sm sticky top-[73px] z-40">
          <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocation("/")}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Property Estimate</p>
                <p className="font-semibold text-sm leading-tight">{address}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Share2 className="h-4 w-4" /> Share
              </Button>
              <Button size="sm" className="gap-1.5 bg-secondary hover:bg-secondary/90 text-white">
                <Save className="h-4 w-4" /> Save Scenario
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT: Inputs ───────────────────────────────────────── */}
            <div className="lg:col-span-1 space-y-4">

              {/* Purchase Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Purchase Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Purchase Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        className="pl-6"
                        type="number"
                        value={inputs.purchasePrice}
                        onChange={(e) => set("purchasePrice", Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 flex justify-between">
                      <span>Down Payment</span>
                      <span className="font-semibold text-foreground">{inputs.downPaymentPct}% — {fmt(calc.downPaymentAmt)}</span>
                    </Label>
                    <Slider
                      min={0} max={50} step={0.5}
                      value={[inputs.downPaymentPct]}
                      onValueChange={([v]) => set("downPaymentPct", v)}
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Loan Type</Label>
                    <Select value={inputs.loanType} onValueChange={(v) => setLoanType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conventional">Conventional</SelectItem>
                        <SelectItem value="fha">FHA</SelectItem>
                        <SelectItem value="va">VA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 flex justify-between">
                      <span>Interest Rate</span>
                      <span className="font-semibold text-foreground">{inputs.interestRate.toFixed(2)}%</span>
                    </Label>
                    <Slider
                      min={3} max={12} step={0.05}
                      value={[inputs.interestRate]}
                      onValueChange={([v]) => set("interestRate", v)}
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 flex justify-between">
                      <span>Credit Score</span>
                      <span className="font-semibold text-foreground">{inputs.creditScore}</span>
                    </Label>
                    <Slider
                      min={580} max={850} step={10}
                      value={[inputs.creditScore]}
                      onValueChange={([v]) => set("creditScore", v)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Taxes & Fees */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Taxes & Fees
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Annual Property Taxes</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input className="pl-6" type="number" value={inputs.annualTaxes} onChange={(e) => set("annualTaxes", Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">HOA (monthly)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input className="pl-6" type="number" value={inputs.hoaMonthly} onChange={(e) => set("hoaMonthly", Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">CDD (annual)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input className="pl-6" type="number" value={inputs.cddAnnual} onChange={(e) => set("cddAnnual", Number(e.target.value))} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Insurance */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Insurance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Homeowners Insurance (annual)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input className="pl-6" type="number" value={inputs.annualHOIns} onChange={(e) => set("annualHOIns", Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Flood Insurance (annual)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input className="pl-6" type="number" value={inputs.annualFloodIns} onChange={(e) => set("annualFloodIns", Number(e.target.value))} />
                    </div>
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Wind Mitigation</p>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Impact Windows & Doors</Label>
                    <Switch checked={inputs.impactWindows} onCheckedChange={(v) => set("impactWindows", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Secondary Water Resistance (SWR)</Label>
                    <Switch checked={inputs.swr} onCheckedChange={(v) => set("swr", v)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Roof-to-Wall Attachment</Label>
                    <Select value={inputs.roofAttachment} onValueChange={(v) => set("roofAttachment", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="toenails">Toenails</SelectItem>
                        <SelectItem value="clips">Clips</SelectItem>
                        <SelectItem value="single-wraps">Single Wraps</SelectItem>
                        <SelectItem value="double-wraps">Double Wraps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Borrower Profile */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    Borrower Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Monthly Gross Income</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input className="pl-6" type="number" value={inputs.monthlyIncome} onChange={(e) => set("monthlyIncome", Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Monthly Debts (auto, cards, etc.)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input className="pl-6" type="number" value={inputs.monthlyDebts} onChange={(e) => set("monthlyDebts", Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Available Reserves / Savings</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input className="pl-6" type="number" value={inputs.reserves} onChange={(e) => set("reserves", Number(e.target.value))} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── RIGHT: Results ──────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Summary Banner */}
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardContent className="pt-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Monthly Payment</p>
                      <p className="text-2xl font-bold text-primary">{fmt(calc.totalHousing)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Cash to Close</p>
                      <p className="text-2xl font-bold text-primary">{fmt(calc.cashToClose)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Your DTI</p>
                      <p className={`text-2xl font-bold ${calc.dti > calc.maxDti ? "text-red-600" : "text-green-600"}`}>
                        {fmtPct(calc.dti)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Qualification</p>
                      <div className="flex justify-center mt-1">
                        {calc.qualifies ? (
                          <Badge className="bg-green-100 text-green-700 border-green-300 text-sm px-3">Likely Qualifies</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-red-300 text-sm px-3">Needs Review</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Real Estate Section */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-primary">
                    <Home className="h-4 w-4" />
                    Real Estate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Row label="Purchase Price" value={fmt(inputs.purchasePrice)} />
                  <Separator />
                  <Row label="Down Payment" value={`${fmt(calc.downPaymentAmt)} (${inputs.downPaymentPct}%)`} />
                  <Row label="Loan Amount" value={fmt(calc.loanAmount)} sub={`LTV ${fmtPct(calc.ltv)}`} />
                  <Separator />
                  <Row label="Estimated Closing Costs (~3%)" value={fmt(calc.closingCosts)} />
                  <Row label="Estimated Property Taxes (annual)" value={fmt(inputs.annualTaxes)} />
                  <Row label="HOA (monthly)" value={fmt(inputs.hoaMonthly)} />
                  <Row label="CDD (annual)" value={fmt(inputs.cddAnnual)} />
                  <Separator />
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-semibold">Estimated Cash to Close</span>
                    <span className="text-base font-bold text-primary">{fmt(calc.cashToClose)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Mortgage Section */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-primary">
                    <Building2 className="h-4 w-4" />
                    Mortgage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Row label="Principal & Interest" value={fmt(calc.pi)} sub={`${inputs.interestRate.toFixed(2)}% / 30 yr`} />
                  <Row label="Property Taxes" value={`${fmt(calc.monthlyTax)}/mo`} sub={`${fmt(inputs.annualTaxes)}/yr`} />
                  <Row label="Homeowners Insurance" value={`${fmt(calc.monthlyHOIns)}/mo`} />
                  <Row label="Flood Insurance" value={`${fmt(calc.monthlyFlood)}/mo`} />
                  {inputs.hoaMonthly > 0 && <Row label="HOA" value={fmt(inputs.hoaMonthly)} />}
                  {inputs.cddAnnual > 0 && <Row label="CDD" value={`${fmt(calc.monthlyCDD)}/mo`} />}
                  {calc.mortgageInsurance > 0 && (
                    <Row
                      label={inputs.loanType === "fha" ? "FHA MIP" : inputs.loanType === "va" ? "VA Funding Fee" : "PMI"}
                      value={fmt(calc.mortgageInsurance)}
                    />
                  )}
                  <Separator />
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-semibold">Total Monthly Payment</span>
                    <span className="text-base font-bold text-primary">{fmt(calc.totalHousing)}</span>
                  </div>

                  {/* Loan Comparison Table */}
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Loan Type Comparison</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs text-right">Rate</TableHead>
                          <TableHead className="text-xs text-right">Down</TableHead>
                          <TableHead className="text-xs text-right">P&I</TableHead>
                          <TableHead className="text-xs text-right">Total/mo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calc.loanComparison.map((row) => (
                          <TableRow key={row.lt} className={inputs.loanType === row.lt ? "bg-primary/5" : ""}>
                            <TableCell className="text-xs font-medium capitalize">
                              {row.lt.toUpperCase()}
                              {inputs.loanType === row.lt && (
                                <Badge className="ml-1 text-[10px] bg-primary text-white px-1 py-0">Active</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-right">{row.rate.toFixed(2)}%</TableCell>
                            <TableCell className="text-xs text-right">{row.downPct}%</TableCell>
                            <TableCell className="text-xs text-right">{fmt(row.pi)}</TableCell>
                            <TableCell className="text-xs text-right font-semibold">{fmt(row.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Insurance Section */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-primary">
                    <Shield className="h-4 w-4" />
                    Insurance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Row label="Homeowners Insurance (annual)" value={fmt(inputs.annualHOIns)} sub={`${fmt(inputs.annualHOIns / 12)}/mo`} />
                  <Row label="Flood Insurance (annual)" value={fmt(inputs.annualFloodIns)} sub={`${fmt(inputs.annualFloodIns / 12)}/mo`} />
                  <Separator />
                  <p className="text-xs text-muted-foreground my-2 font-medium uppercase tracking-wide">Wind Mitigation Applied</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant={inputs.impactWindows ? "default" : "outline"} className={inputs.impactWindows ? "bg-green-600" : ""}>
                      {inputs.impactWindows ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      Impact Windows
                    </Badge>
                    <Badge variant={inputs.swr ? "default" : "outline"} className={inputs.swr ? "bg-green-600" : ""}>
                      {inputs.swr ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      SWR Barrier
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      Roof: {inputs.roofAttachment.replace("-", " ")}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-green-50 rounded-lg px-3">
                    <span className="text-sm font-semibold">Estimated HO Premium (with mitigation)</span>
                    <span className="text-base font-bold text-green-700">{fmt(calc.estimatedHOIns)}/yr</span>
                  </div>
                  {calc.estimatedHOIns < inputs.annualHOIns && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      Wind mitigation saves an estimated {fmt(inputs.annualHOIns - calc.estimatedHOIns)}/yr
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Qualification Section */}
              <Card className={`border-2 ${calc.qualifies ? "border-green-200" : "border-red-200"}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    Qualification
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
                  <Row label="Your Monthly Income" value={fmt(inputs.monthlyIncome)} />
                  <Row label="Required Monthly Income" value={fmt(calc.requiredIncome)} />
                  <Separator />
                  <Row
                    label="Your DTI"
                    value={fmtPct(calc.dti)}
                    sub={calc.dti > calc.maxDti ? "Exceeds max DTI" : "Within limit"}
                  />
                  <Row label="Max Allowed DTI" value={fmtPct(calc.maxDti)} sub={`Based on credit score ${inputs.creditScore}`} />
                  <Separator />
                  <Row label="Required Reserves (2 mo PITI)" value={fmt(calc.requiredReserves)} />
                  <Row label="Your Available Reserves" value={fmt(inputs.reserves)} />
                  <Separator />
                  <Row label="Cash Needed to Close" value={fmt(calc.cashToClose)} />
                  <Row label="Down Payment" value={`${fmt(calc.downPaymentAmt)} (${inputs.downPaymentPct}%)`} />
                  <Row label="Closing Costs Est." value={fmt(calc.closingCosts)} />

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
                        <CheckCircle2 className="h-3 w-3" /> Based on the information provided, this buyer likely qualifies for this property.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Disclaimer */}
              <p className="text-xs text-muted-foreground text-center px-4 pb-4">
                All estimates are for informational purposes only and are not a commitment to lend. Actual rates, payments, and qualification requirements may vary. Contact a licensed mortgage professional for a full analysis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
