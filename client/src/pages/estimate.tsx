import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { estimateAnnualTax } from "@/lib/county-tax-estimator";
import { useQuery } from "@tanstack/react-query";
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
  Pencil,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadGoogleMapsApi } from "@/lib/script-loader";
import LeadCaptureDialog from "@/components/ui/lead-capture-dialog";
import { useToast } from "@/hooks/use-toast";

// ─── Calculation helpers ────────────────────────────────────────────────────

function calcPI(loanAmount: number, annualRate: number, termMonths = 360): number {
  if (loanAmount <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 12;
  return loanAmount * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

function calcConventionalPMI(loanAmount: number, purchasePrice: number, creditScore: number): number {
  const ltv = loanAmount / purchasePrice;
  if (ltv <= 0.8) return 0;
  // Base PMI at 780+ credit (midpoint of MGIC/Fannie range by LTV band)
  let basePMI: number;
  if (ltv > 0.95)      basePMI = 0.00575; // ~97% LTV: 0.45–0.70% mid
  else if (ltv > 0.90) basePMI = 0.00450; // ~95% LTV: 0.35–0.55% mid
  else if (ltv > 0.85) basePMI = 0.00315; // ~90% LTV: 0.25–0.38% mid
  else                 basePMI = 0.00215; // ~85% LTV: 0.18–0.25% mid
  // Credit score multiplier
  let mult: number;
  if      (creditScore >= 780) mult = 1.00;
  else if (creditScore >= 760) mult = 1.05;
  else if (creditScore >= 740) mult = 1.12;
  else if (creditScore >= 720) mult = 1.25;
  else if (creditScore >= 700) mult = 1.50;
  else if (creditScore >= 680) mult = 1.85;
  else                         mult = 2.20;
  return (loanAmount * basePMI * mult) / 12;
}

function calcFHAMIP(loanAmount: number, purchasePrice: number): number {
  const ltv = loanAmount / purchasePrice;
  // Standard FHA annual MIP (2024 rates for loans > $150k, 30-yr)
  const annualMIP = ltv > 0.90 ? 0.0085 : 0.0080;
  return (loanAmount * annualMIP) / 12;
}

function calcVAFundingFee(loanAmount: number, downPaymentPct: number): number {
  let rate = 0.023;
  if (downPaymentPct >= 10) rate = 0.014;
  else if (downPaymentPct >= 5) rate = 0.0165;
  return (loanAmount * rate) / 12;
}

function getMaxSellerConcessions(
  loanType: "conventional" | "fha" | "va" | "usda",
  occupancy: "primary" | "secondary" | "investment",
  downPaymentPct: number,
  purchasePrice: number,
): number {
  if (loanType === "fha" || loanType === "usda") return purchasePrice * 0.06;
  if (loanType === "va") return purchasePrice * 0.04;
  // Conventional
  if (occupancy === "secondary" || occupancy === "investment") return purchasePrice * 0.02;
  // Primary conventional
  if (downPaymentPct < 10) return purchasePrice * 0.03;
  if (downPaymentPct < 20) return purchasePrice * 0.06;
  return purchasePrice * 0.09;
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
  occupancy: "primary" | "secondary" | "investment";
  purchasePrice: number;
  downPaymentPct: number;
  sellerConcessions: number;
  loanType: "conventional" | "fha" | "va" | "usda";
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
  hasMortgage: boolean | null;
  currentLoanFHA: boolean | null;
  hasRentalIncome: boolean | null;
  monthlyRentalIncome: number;
  rentalType: "annual" | "short-term" | null;
}

const FALLBACK_RATES = { conventional: 6.82, fha: 6.38, va: 6.25, usda: 6.38 };

interface Scenario {
  id: string;
  address: string;
  savedInputs: Inputs | null;
}

function makeDefaultInputs(price = 350000): Inputs {
  return {
    occupancy: "primary", purchasePrice: price, downPaymentPct: 5, sellerConcessions: 0,
    loanType: "conventional", creditScore: 780,
    interestRate: FALLBACK_RATES.conventional,
    annualTaxes: Math.round(price * 0.015), hoaMonthly: 0, cddAnnual: 0,
    annualHOIns: Math.round(price * 0.0075), annualFloodIns: 2000,
    monthlyDebts: 0, monthlyIncome: 8000, reserves: 35000,
    impactWindows: false, roofAttachment: "toenails", swr: false,
    hasMortgage: null, currentLoanFHA: null, hasRentalIncome: null, monthlyRentalIncome: 0, rentalType: null,
  };
}

function shortLabel(addr: string): string {
  const parts = addr.split(",")[0].trim().split(" ");
  return parts.slice(0, 3).join(" ");
}

function creditAdjustment(score: number): number {
  if (score >= 780) return -0.20;
  if (score >= 760) return -0.05;
  if (score >= 740) return  0;
  if (score >= 720) return  0.125;
  if (score >= 700) return  0.25;
  if (score >= 680) return  0.50;
  if (score >= 660) return  0.75;
  if (score >= 640) return  1.00;
  return 1.50;
}

function adjustedRate(base: number, score: number): number {
  return Math.round((base + creditAdjustment(score)) * 1000) / 1000;
}

// ─── SliderInput component ───────────────────────────────────────────────────

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  decimals?: number;
}

function formatWithCommas(n: number, decimals = 0): string {
  if (decimals > 0) return n.toFixed(decimals);
  return Math.round(n).toLocaleString("en-US");
}

function SliderInput({ label, value, onChange, min, max, step = 1, prefix, suffix, disabled, decimals = 0 }: SliderInputProps) {
  const [text, setText] = useState(formatWithCommas(value, decimals));
  const isFocused = useRef(false);

  // Sync display from parent only when not being edited
  useEffect(() => {
    if (!isFocused.current) {
      setText(formatWithCommas(value, decimals));
    }
  }, [value, decimals]);

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    isFocused.current = true;
    setText(decimals > 0 ? value.toFixed(decimals) : String(Math.round(value)));
    e.target.select();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setText(raw);
    const n = parseFloat(raw.replace(/,/g, ""));
    if (!isNaN(n)) {
      const rounded = decimals > 0 ? parseFloat(n.toFixed(decimals)) : Math.round(n);
      onChange(Math.min(max, Math.max(min, rounded)));
    }
  }

  function handleBlur() {
    isFocused.current = false;
    const n = parseFloat(text.replace(/,/g, ""));
    if (!isNaN(n)) {
      const rounded = decimals > 0 ? parseFloat(n.toFixed(decimals)) : Math.round(n);
      const clamped = Math.min(max, Math.max(min, rounded));
      onChange(clamped);
      setText(formatWithCommas(clamped, decimals));
    } else {
      setText(formatWithCommas(value, decimals));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  }

  return (
    <div className={`space-y-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-0.5 bg-muted rounded-md px-2 py-1 min-w-[88px]">
          {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
          <input
            className="w-full bg-transparent text-xs font-semibold text-right text-foreground outline-none min-w-0"
            value={text}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            inputMode="decimal"
            disabled={disabled}
          />
          {suffix && <span className="text-xs text-muted-foreground ml-0.5">{suffix}</span>}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[Math.min(max, Math.max(min, value))]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
      />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Estimate() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const address = params.get("address") || "Unknown Address";

  const { toast } = useToast();

  // ── Auth & multi-scenario state ─────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("tateo_auth") === "1"
  );
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: "sc0", address, savedInputs: null },
  ]);
  const [activeScenarioId, setActiveScenarioId] = useState("sc0");
  const [showAddressPrompt, setShowAddressPrompt] = useState(false);
  const [newScenarioAddress, setNewScenarioAddress] = useState("");
  const newScenarioInputRef = useRef<HTMLInputElement>(null);
  const newScenarioAcRef = useRef<any>(null);
  const [leadDialogForScenario, setLeadDialogForScenario] = useState(false);

  // Keep active scenario's address in sync when URL changes (inline edit)
  useEffect(() => {
    setScenarios(prev =>
      prev.map(s => s.id === activeScenarioId ? { ...s, address } : s)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Init Google Maps autocomplete on the new-scenario address prompt
  useEffect(() => {
    if (!showAddressPrompt) return;
    const timer = setTimeout(() => {
      if (!newScenarioInputRef.current) return;
      loadGoogleMapsApi().then(() => {
        const ac = new (window as any).google.maps.places.Autocomplete(
          newScenarioInputRef.current, { types: ["address"] }
        );
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (place.formatted_address) setNewScenarioAddress(place.formatted_address);
        });
        newScenarioAcRef.current = ac;
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [showAddressPrompt]);

  function switchScenario(targetId: string) {
    if (targetId === activeScenarioId) return;
    const target = scenarios.find(s => s.id === targetId);
    if (!target) return;
    // Snapshot current inputs into active scenario
    setScenarios(prev =>
      prev.map(s => s.id === activeScenarioId ? { ...s, savedInputs: inputs } : s)
    );
    setActiveScenarioId(targetId);
    setLocation(`/estimate?address=${encodeURIComponent(target.address)}`);
    if (target.savedInputs) setInputs(target.savedInputs);
    else setInputs(makeDefaultInputs());
  }

  function removeScenario(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (scenarios.length === 1) return;
    const idx = scenarios.findIndex(s => s.id === id);
    const remaining = scenarios.filter(s => s.id !== id);
    setScenarios(remaining);
    if (id === activeScenarioId) {
      const next = remaining[Math.max(0, idx - 1)];
      setActiveScenarioId(next.id);
      setLocation(`/estimate?address=${encodeURIComponent(next.address)}`);
      if (next.savedInputs) setInputs(next.savedInputs);
      else setInputs(makeDefaultInputs());
    }
  }

  function requestAddScenario() {
    if (scenarios.length >= 5) {
      toast({ title: "Maximum 5 scenarios", description: "Remove a tab to add a new property." });
      return;
    }
    if (!isAuthenticated) {
      setLeadDialogForScenario(true);
      setLeadDialogOpen(true);
    } else {
      setShowAddressPrompt(true);
    }
  }

  function confirmNewScenario() {
    const addr = newScenarioAddress.trim();
    if (!addr) return;
    const newId = `sc_${Date.now()}`;
    setScenarios(prev => [
      ...prev.map(s => s.id === activeScenarioId ? { ...s, savedInputs: inputs } : s),
      { id: newId, address: addr, savedInputs: null },
    ]);
    setActiveScenarioId(newId);
    setLocation(`/estimate?address=${encodeURIComponent(addr)}`);
    setInputs(makeDefaultInputs());
    amiLoadedRef.current = false;
    floodLoadedRef.current = null;
    ratesLoadedRef.current = false;
    setNewScenarioAddress("");
    setShowAddressPrompt(false);
  }

  // Lead capture dialog
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadDialogAction, setLeadDialogAction] = useState<"share" | "save">("share");

  function openLeadDialog(action: "share" | "save") {
    setLeadDialogForScenario(false);
    setLeadDialogAction(action);
    setLeadDialogOpen(true);
  }

  function handleLeadSuccess() {
    if (leadDialogForScenario) {
      setLeadDialogForScenario(false);
      localStorage.setItem("tateo_auth", "1");
      setIsAuthenticated(true);
      setShowAddressPrompt(true);
    } else if (leadDialogAction === "share") {
      const url = window.location.href;
      navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: "Link copied!", description: "Share the URL with anyone to show this estimate." });
    } else {
      toast({ title: "Scenario saved!", description: "Your estimate scenario has been saved." });
    }
  }

  // Editable address
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editAddressVal, setEditAddressVal] = useState(address);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const addressAutocompleteRef = useRef<any>(null);

  useEffect(() => {
    if (!isEditingAddress) return;
    setEditAddressVal(address);
    setTimeout(() => addressInputRef.current?.select(), 30);

    async function initAutocomplete() {
      try {
        let apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "";
        if (!apiKey) {
          const res = await fetch("/api/config/google-maps-api-key");
          const data = await res.json();
          apiKey = data.apiKey || "";
        }
        if (!apiKey || !addressInputRef.current) return;
        await loadGoogleMapsApi(apiKey);
        if (!window.google?.maps?.places?.Autocomplete || !addressInputRef.current) return;
        addressAutocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
          types: ["address"],
          componentRestrictions: { country: "us" },
          fields: ["formatted_address"],
        });
        addressAutocompleteRef.current.addListener("place_changed", () => {
          const place = addressAutocompleteRef.current.getPlace();
          if (place?.formatted_address) {
            setIsEditingAddress(false);
            setLocation(`/estimate?address=${encodeURIComponent(place.formatted_address)}`);
          }
        });
      } catch (err) {
        console.warn("Address autocomplete unavailable:", err);
      }
    }
    initAutocomplete();

    return () => {
      if (addressAutocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(addressAutocompleteRef.current);
        addressAutocompleteRef.current = null;
      }
    };
  }, [isEditingAddress]);

  const defaultPrice = 350000;

  // Live mortgage rates from mortgagenewsdaily.com
  const { data: liveRates } = useQuery<{ conventional: number; fha: number; va: number; usda?: number; source: string; lastUpdated: string | null }>({
    queryKey: ["/api/mortgage-rates"],
    staleTime: 60 * 60 * 1000,
  });

  // FEMA flood zone for the entered address
  const { data: floodData } = useQuery<{ zone: string; subtype: string; requiresFloodInsurance: boolean }>({
    queryKey: ["/api/flood-zone", address],
    queryFn: () => fetch(`/api/flood-zone?address=${encodeURIComponent(address)}`).then(r => { if (!r.ok) throw new Error("Flood zone not found"); return r.json(); }),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  // Sync flood insurance with zone data whenever address changes
  const floodLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (floodData && floodLoadedRef.current !== address) {
      floodLoadedRef.current = address;
      if (!floodData.requiresFloodInsurance) {
        setInputs((p) => ({ ...p, annualFloodIns: 0 }));
      } else {
        // Restore default flood insurance when switching to a high-risk zone
        setInputs((p) => ({ ...p, annualFloodIns: p.annualFloodIns === 0 ? 2000 : p.annualFloodIns }));
      }
    }
  }, [floodData, address]);

  // Area Median Income for the entered address
  const { data: amiData } = useQuery<{ areaName: string; annualAMI: number; monthlyAMI: number; source: string }>({
    queryKey: ["/api/ami", address],
    queryFn: () => fetch(`/api/ami?address=${encodeURIComponent(address)}`).then(r => { if (!r.ok) throw new Error("AMI not found"); return r.json(); }),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  // Set monthly income to AMI once loaded (only on first load)
  const amiLoadedRef = useRef(false);
  useEffect(() => {
    if (amiData && !amiLoadedRef.current) {
      amiLoadedRef.current = true;
      setInputs((p) => ({ ...p, monthlyIncome: amiData.monthlyAMI }));
    }
  }, [amiData]);
  const rates = liveRates ?? FALLBACK_RATES;

  const [inputs, setInputs] = useState<Inputs>({
    occupancy: "primary",
    purchasePrice: defaultPrice,
    downPaymentPct: 5,
    sellerConcessions: 0,
    loanType: "conventional",
    creditScore: 780,
    interestRate: FALLBACK_RATES.conventional,
    annualTaxes: Math.round(defaultPrice * 0.015),
    hoaMonthly: 0,
    cddAnnual: 0,
    annualHOIns: Math.round(defaultPrice * 0.0075),
    annualFloodIns: 2000,
    monthlyDebts: 0,
    monthlyIncome: 8000,
    reserves: 35000,
    impactWindows: false,
    roofAttachment: "toenails",
    swr: false,
    hasMortgage: null,
    currentLoanFHA: null,
    hasRentalIncome: null,
    monthlyRentalIncome: 0,
    rentalType: null,
  });

  // Clamp seller concessions whenever loan type, occupancy, or down payment changes
  useEffect(() => {
    const maxC = getMaxSellerConcessions(inputs.loanType, inputs.occupancy, inputs.downPaymentPct, inputs.purchasePrice);
    const allowed = !(
      (inputs.loanType === "fha" || inputs.loanType === "usda" || inputs.loanType === "va") &&
      inputs.occupancy !== "primary"
    );
    if (!allowed) {
      setInputs((p) => ({ ...p, sellerConcessions: 0 }));
    } else if (inputs.sellerConcessions > maxC) {
      setInputs((p) => ({ ...p, sellerConcessions: Math.round(maxC) }));
    }
  }, [inputs.loanType, inputs.occupancy, inputs.downPaymentPct, inputs.purchasePrice]);

  // Sync interest rate to live rate (with credit adjustment) when rates first load
  const ratesLoadedRef = useRef(false);
  useEffect(() => {
    if (liveRates && !ratesLoadedRef.current) {
      ratesLoadedRef.current = true;
      setInputs((p) => ({ ...p, interestRate: adjustedRate((liveRates as any)[p.loanType] ?? liveRates.fha, p.creditScore) }));
    }
  }, [liveRates]);

  // Auto-recalculate property taxes whenever the address changes
  const taxAddressRef = useRef<string>("");
  useEffect(() => {
    if (address && address !== taxAddressRef.current) {
      taxAddressRef.current = address;
      setInputs((p) => ({
        ...p,
        annualTaxes: estimateAnnualTax(address, p.purchasePrice, p.occupancy === "primary"),
      }));
    }
  }, [address]);

  function getMinDown(lt: "conventional" | "fha" | "va" | "usda", hasMortgage: boolean | null, occupancy?: "primary" | "secondary" | "investment"): number {
    if (occupancy === "investment") return 20;
    if (occupancy === "secondary") return 10;
    if (lt === "va" || lt === "usda") return 0;
    if (lt === "fha") return 3.5;
    return hasMortgage === true ? 5 : 3;
  }

  function setLoanType(lt: "conventional" | "fha" | "va" | "usda") {
    setInputs((p) => {
      const newMin = getMinDown(lt, p.hasMortgage, p.occupancy);
      return {
        ...p,
        loanType: lt,
        interestRate: adjustedRate((rates as any)[lt] ?? rates.fha, p.creditScore),
        downPaymentPct: Math.max(p.downPaymentPct, newMin),
      };
    });
  }

  function setOccupancy(occ: "primary" | "secondary" | "investment") {
    setInputs((p) => {
      const newMin = getMinDown(p.loanType, p.hasMortgage, occ);
      return {
        ...p,
        occupancy: occ,
        downPaymentPct: Math.max(p.downPaymentPct, newMin),
        rentalType: occ === "investment" ? p.rentalType : null,
        annualTaxes: estimateAnnualTax(address, p.purchasePrice, occ === "primary"),
      };
    });
  }

  function setCreditScore(score: number) {
    setInputs((p) => {
      const autoLoanType =
        score < 720 && p.loanType === "conventional" ? "fha" :
        score >= 720 && p.loanType === "fha" ? "conventional" :
        p.loanType;
      return {
        ...p,
        creditScore: score,
        loanType: autoLoanType,
        interestRate: adjustedRate(rates[autoLoanType], score),
      };
    });
  }

  function set<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs((p) => ({ ...p, [key]: value }));
  }

  // ─── Calculations ──────────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const { purchasePrice, downPaymentPct, loanType, creditScore, interestRate,
      annualTaxes, hoaMonthly, cddAnnual, annualHOIns, annualFloodIns,
      monthlyDebts, monthlyIncome, monthlyRentalIncome, reserves, impactWindows, roofAttachment, swr } = inputs;

    const downPaymentAmt = purchasePrice * (downPaymentPct / 100);
    const loanAmount = purchasePrice - downPaymentAmt;
    const rate = interestRate / 100;
    const ltv = loanAmount / purchasePrice;

    const pi = calcPI(loanAmount, rate);
    const monthlyTax = annualTaxes / 12;
    const monthlyHOIns = annualHOIns / 12;
    const monthlyFlood = annualFloodIns / 12;
    const monthlyCDD = cddAnnual / 12;

    const pmi = loanType === "conventional" ? calcConventionalPMI(loanAmount, purchasePrice, creditScore) : 0;
    const mip = loanType === "fha" ? calcFHAMIP(loanAmount, purchasePrice) : 0;
    const vaFee = loanType === "va" ? calcVAFundingFee(loanAmount, downPaymentPct) : 0;
    const mortgageInsurance = pmi + mip + vaFee;

    const totalHousing = pi + monthlyTax + monthlyHOIns + monthlyFlood + hoaMonthly + monthlyCDD + mortgageInsurance;
    const closingCosts = Math.round(purchasePrice * 0.03);
    const sellerConcessions = inputs.sellerConcessions ?? 0;
    const cashToClose = Math.round(downPaymentAmt + closingCosts - sellerConcessions);

    // Rental income: lenders allow 75% of gross rental income to count toward qualifying income
    const rentalIncomeQualifying = Math.round((monthlyRentalIncome ?? 0) * 0.75);
    const qualifyingIncome = monthlyIncome + rentalIncomeQualifying;

    const housingDTI = qualifyingIncome > 0 ? totalHousing / qualifyingIncome : 0;
    const dti = qualifyingIncome > 0 ? (totalHousing + monthlyDebts) / qualifyingIncome : 0;
    const maxDti = getMaxDTI(creditScore);
    const requiredIncome = Math.round((totalHousing + monthlyDebts) / maxDti);
    const requiredReserves = Math.round(totalHousing * 2);
    const availableReserves = Math.max(0, reserves - cashToClose);
    const qualifies = qualifyingIncome >= requiredIncome && availableReserves >= requiredReserves;

    const estimatedHOIns = calcInsuranceEstimate(purchasePrice, impactWindows, roofAttachment, swr);

    const loanComparison = (["conventional", "fha", "va"] as const).map((lt) => {
      const ltRate = rates[lt] / 100;
      const ltDown = lt === "va" ? 0 : lt === "fha" ? 3.5 : downPaymentPct;
      const ltLoan = purchasePrice * (1 - ltDown / 100);
      const ltPI = calcPI(ltLoan, ltRate);
      const ltPMI = lt === "conventional" ? calcConventionalPMI(ltLoan, purchasePrice, creditScore) : 0;
      const ltMIP = lt === "fha" ? calcFHAMIP(ltLoan, purchasePrice) : 0;
      const ltVA = lt === "va" ? calcVAFundingFee(ltLoan, ltDown) : 0;
      const ltMI = ltPMI + ltMIP + ltVA;
      const ltTotal = ltPI + monthlyTax + monthlyHOIns + hoaMonthly + monthlyCDD + ltMI;
      return { lt, rate: ltRate * 100, downPct: ltDown, pi: ltPI, mi: ltMI, total: ltTotal };
    });

    const recs: string[] = [];
    if (qualifyingIncome < requiredIncome) {
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
      closingCosts, cashToClose, housingDTI, dti, maxDti, requiredIncome, requiredReserves, availableReserves,
      qualifies, estimatedHOIns, loanComparison, recs, ltv,
      rentalIncomeQualifying, qualifyingIncome,
    };
  }, [inputs]);

  function fmt(n: number): string {
    return "$" + Math.round(n).toLocaleString();
  }
  function fmtPct(n: number): string {
    return (n * 100).toFixed(1) + "%";
  }

  function Row({ label, value, sub, status }: { label: string; value: string; sub?: string; status?: "green" | "yellow" | "red" }) {
    const bg = status === "green" ? "bg-green-50" : status === "yellow" ? "bg-yellow-50" : status === "red" ? "bg-red-50" : "";
    const labelColor = status === "green" ? "text-green-800" : status === "yellow" ? "text-yellow-800" : status === "red" ? "text-red-800" : "text-muted-foreground";
    const valueColor = status === "green" ? "text-green-700 font-bold" : status === "yellow" ? "text-yellow-700 font-bold" : status === "red" ? "text-red-700 font-bold" : "font-semibold";
    const subColor = status === "green" ? "text-green-600" : status === "yellow" ? "text-yellow-600" : status === "red" ? "text-red-600" : "text-muted-foreground";
    return (
      <div className={`flex justify-between items-center py-2 px-2 rounded-md transition-colors ${bg}`}>
        <span className={`text-sm ${labelColor}`}>{label}</span>
        <span className={`text-sm text-right ${valueColor}`}>
          {value}
          {sub && <span className={`block text-xs font-normal ${subColor}`}>{sub}</span>}
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
          {/* Scenario tabs */}
          <div className="container mx-auto px-4 pt-2 flex items-center gap-1 overflow-x-auto scrollbar-none">
            {scenarios.map((sc, idx) => (
              <div
                key={sc.id}
                onClick={() => switchScenario(sc.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-medium cursor-pointer whitespace-nowrap border border-b-0 transition-colors ${
                  sc.id === activeScenarioId
                    ? "bg-white border-border text-foreground shadow-sm -mb-px relative z-10"
                    : "bg-gray-100 border-transparent text-muted-foreground hover:bg-gray-200"
                }`}
              >
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{shortLabel(sc.address)}</span>
                {scenarios.length > 1 && (
                  <button
                    onClick={(e) => removeScenario(sc.id, e)}
                    className="ml-0.5 rounded-full hover:bg-black/10 p-0.5 transition-colors"
                    aria-label="Remove scenario"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ))}
            {scenarios.length < 5 && (
              <button
                onClick={requestAddScenario}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-t-md text-xs text-muted-foreground hover:text-primary hover:bg-gray-100 border border-transparent border-b-0 transition-colors"
                title="Compare a new property"
              >
                <Plus className="h-3.5 w-3.5" /> Add Property
              </button>
            )}
          </div>
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
                {isEditingAddress ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <input
                      ref={addressInputRef}
                      type="text"
                      value={editAddressVal}
                      onChange={(e) => setEditAddressVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = editAddressVal.trim();
                          if (val) setLocation(`/estimate?address=${encodeURIComponent(val)}`);
                          setIsEditingAddress(false);
                        } else if (e.key === "Escape") {
                          setIsEditingAddress(false);
                        }
                      }}
                      onBlur={(e) => {
                        // Delay to allow autocomplete click to fire first
                        setTimeout(() => setIsEditingAddress(false), 200);
                      }}
                      className="text-sm font-semibold bg-transparent border-b border-primary outline-none w-72 max-w-full leading-tight pb-0.5"
                      autoComplete="off"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingAddress(true)}
                    className="group flex items-center gap-1.5 mt-0.5 hover:text-primary transition-colors text-left"
                  >
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                    <span className="font-semibold text-sm leading-tight">{address}</span>
                    <Pencil className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openLeadDialog("share")}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
              <Button size="sm" className="gap-1.5 bg-secondary hover:bg-secondary/90 text-white" onClick={() => openLeadDialog("save")}>
                <Save className="h-4 w-4" /> Save Scenario
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          <div className="space-y-6">

            {/* ── INPUTS ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* 1. Borrower Profile — TOP */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    Borrower Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Occupancy Type */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Property Use</p>
                    <div className="flex gap-2">
                      {(["primary", "secondary", "investment"] as const).map((occ) => (
                        <button
                          key={occ}
                          onClick={() => setOccupancy(occ)}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold border capitalize transition-colors ${
                            inputs.occupancy === occ
                              ? "bg-primary text-white border-primary"
                              : "border-border text-muted-foreground hover:border-primary"
                          }`}
                        >
                          {occ}
                        </button>
                      ))}
                    </div>
                    {inputs.occupancy !== "primary" && (
                      <p className="text-[11px] mt-1.5 text-amber-600 font-medium">
                        {inputs.occupancy === "secondary"
                          ? "Secondary home requires minimum 10% down"
                          : "Investment property requires minimum 20% down"}
                      </p>
                    )}

                    {inputs.occupancy === "investment" && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
                        <p className="text-xs font-semibold text-blue-800 mb-2">How do you plan to rent this property?</p>
                        <div className="flex gap-2">
                          {([
                            { value: "annual", label: "Annual Lease", sub: "12-month tenant" },
                            { value: "short-term", label: "Short-Term Rental", sub: "Airbnb / VRBO" },
                          ] as const).map(({ value, label, sub }) => (
                            <button
                              key={value}
                              onClick={() => set("rentalType", value)}
                              className={`flex-1 py-2 px-2 rounded-md text-left border transition-colors ${
                                inputs.rentalType === value
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white border-blue-200 text-blue-900 hover:border-blue-400"
                              }`}
                            >
                              <p className="text-xs font-semibold leading-tight">{label}</p>
                              <p className={`text-[10px] leading-tight mt-0.5 ${inputs.rentalType === value ? "text-blue-100" : "text-muted-foreground"}`}>{sub}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <SliderInput
                      label="Monthly Gross Income (exclude rental income)"
                      value={inputs.monthlyIncome}
                      onChange={(v) => set("monthlyIncome", v)}
                      min={1000} max={50000} step={100}
                      prefix="$"
                    />
                    {amiData && (
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        <span className="text-green-600 font-medium">Auto-set from Area Median Income</span>
                        {" · "}{amiData.areaName.split(",").slice(0, 2).join(",")}
                      </p>
                    )}
                  </div>
                  <SliderInput
                    label="Monthly Debts (mortgage, auto, cards, etc.)"
                    value={inputs.monthlyDebts}
                    onChange={(v) => set("monthlyDebts", v)}
                    min={0} max={10000} step={50}
                    prefix="$"
                  />
                  <SliderInput
                    label="Available Reserves / Savings"
                    value={inputs.reserves}
                    onChange={(v) => set("reserves", v)}
                    min={0} max={500000} step={1000}
                    prefix="$"
                  />
                  <SliderInput
                    label="Credit Score"
                    value={inputs.creditScore}
                    onChange={setCreditScore}
                    min={580} max={850} step={10}
                  />

                </CardContent>
              </Card>

              {/* 2. Additional Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Additional Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Current mortgage questions */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Do you currently have a mortgage?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setInputs((p) => {
                            const newMin = getMinDown(p.loanType, true, p.occupancy);
                            return { ...p, hasMortgage: true, downPaymentPct: Math.max(p.downPaymentPct, newMin) };
                          })}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.hasMortgage === true ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setInputs((p) => ({ ...p, hasMortgage: false, currentLoanFHA: null }))}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.hasMortgage === false ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    {inputs.hasMortgage === true && (
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Is your current loan FHA?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => set("currentLoanFHA", true)}
                              className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.currentLoanFHA === true ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => set("currentLoanFHA", false)}
                              className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.currentLoanFHA === false ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                            >
                              No
                            </button>
                          </div>

                          {inputs.currentLoanFHA === true && (
                            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <p className="text-xs font-semibold text-amber-800 mb-1.5">FHA allows only one loan at a time.</p>
                              <p className="text-xs text-amber-700 mb-1.5">A second FHA loan is only permitted if you qualify for one of these exceptions:</p>
                              <ul className="text-xs text-amber-700 space-y-1 list-none">
                                <li className="flex items-start gap-1.5"><span className="mt-0.5 shrink-0">1.</span> Growing family size</li>
                                <li className="flex items-start gap-1.5"><span className="mt-0.5 shrink-0">2.</span> Co-signer / co-borrower situation</li>
                                <li className="flex items-start gap-1.5"><span className="mt-0.5 shrink-0">3.</span> Divorcing from co-borrower</li>
                                <li className="flex items-start gap-1.5"><span className="mt-0.5 shrink-0">4.</span> Relocating more than 100 miles from current home</li>
                              </ul>
                              <a
                                href="https://answers.hud.gov/FHA/s/article/Can-a-person-have-more-than-one-FHA-loan"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-primary underline underline-offset-2 mt-2 inline-block"
                              >
                                HUD.gov — FHA multiple loan policy
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Rental income question */}
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Do you receive any rental income to help pay for these mortgages?</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => set("hasRentalIncome", true)}
                                className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.hasRentalIncome === true ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setInputs((p) => ({ ...p, hasRentalIncome: false, monthlyRentalIncome: 0 }))}
                                className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.hasRentalIncome === false ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                              >
                                No
                              </button>
                            </div>
                          </div>
                          {inputs.hasRentalIncome === true && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                              <SliderInput
                                label="Monthly Rental Income (gross)"
                                value={inputs.monthlyRentalIncome}
                                onChange={(v) => set("monthlyRentalIncome", v)}
                                min={0} max={20000} step={100}
                                prefix="$"
                              />
                              <p className="text-[10px] text-muted-foreground mt-1">
                                75% ({fmt(calc.rentalIncomeQualifying)}/mo) counts toward qualifying income
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 3. Purchase Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Purchase Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <SliderInput
                    label="Purchase Price"
                    value={inputs.purchasePrice}
                    onChange={(v) => setInputs((p) => ({
                      ...p,
                      purchasePrice: v,
                      annualTaxes: estimateAnnualTax(address, v, p.occupancy === "primary"),
                    }))}
                    min={50000} max={3000000} step={5000}
                    prefix="$"
                  />

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Loan Type</Label>
                    <Select value={inputs.loanType} onValueChange={(v) => setLoanType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conventional">
                          Conventional{inputs.creditScore >= 720 ? " (Best Option)" : ""}
                        </SelectItem>
                        <SelectItem value="fha">FHA</SelectItem>
                        <SelectItem value="va">VA</SelectItem>
                        <SelectItem value="usda">USDA</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] mt-1.5 leading-tight text-muted-foreground">
                      {inputs.creditScore >= 720 ? (
                        <span className="text-green-600 font-medium">Conventional best if credit score &gt; 720</span>
                      ) : (
                        <span className="text-amber-600 font-medium">FHA best if credit score &lt; 720</span>
                      )}
                    </p>
                  </div>

                  {(() => {
                    const minDown = getMinDown(inputs.loanType, inputs.hasMortgage, inputs.occupancy);
                    const snapPoints = [
                      { pct: 0,   label: "0%",   sub: "VA / USDA" },
                      { pct: 3,   label: "3%",   sub: "Conv (no mtg)" },
                      { pct: 3.5, label: "3.5%", sub: "FHA" },
                      { pct: 5,   label: "5%",   sub: "Conv (w/ mtg)" },
                      { pct: 10,  label: "10%",  sub: "Secondary" },
                      { pct: 20,  label: "20%",  sub: "Investment" },
                    ];
                    return (
                      <div className="space-y-2">
                        <SliderInput
                          label="Down Payment"
                          value={inputs.downPaymentPct}
                          onChange={(v) => set("downPaymentPct", Math.max(minDown, v))}
                          min={minDown} max={50} step={0.5}
                          suffix="%"
                        />
                        <div className="flex gap-1 flex-wrap pt-0.5">
                          {snapPoints.map(({ pct, label, sub }) => {
                            const isMin = pct === minDown;
                            const isCurrent = inputs.downPaymentPct === pct;
                            const isDisabled = pct < minDown;
                            return (
                              <button
                                key={pct}
                                disabled={isDisabled}
                                onClick={() => set("downPaymentPct", pct)}
                                className={`flex flex-col items-center px-2 py-1 rounded border text-[10px] leading-tight transition-colors ${
                                  isDisabled
                                    ? "border-border/30 text-muted-foreground/30 cursor-not-allowed"
                                    : isMin
                                    ? "border-primary bg-primary/5 text-primary font-semibold"
                                    : isCurrent
                                    ? "border-primary/60 text-primary"
                                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                }`}
                              >
                                <span className="font-semibold">{label}</span>
                                <span className="text-[9px] opacity-70">{sub}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const maxConcessions = getMaxSellerConcessions(inputs.loanType, inputs.occupancy, inputs.downPaymentPct, inputs.purchasePrice);
                    const pct = inputs.purchasePrice > 0 ? (inputs.sellerConcessions / inputs.purchasePrice) * 100 : 0;
                    const isLoanAllowed = !(
                      (inputs.loanType === "fha" || inputs.loanType === "usda" || inputs.loanType === "va") &&
                      inputs.occupancy !== "primary"
                    );
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground">Seller Concessions</span>
                          {isLoanAllowed ? (
                            <span className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
                              Max {(maxConcessions / inputs.purchasePrice * 100).toFixed(0)}% · {fmt(maxConcessions)}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-red-50 text-red-600 rounded px-1.5 py-0.5">
                              Not allowed on {inputs.occupancy} with {inputs.loanType.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <SliderInput
                          label=""
                          value={inputs.sellerConcessions}
                          onChange={(v) => set("sellerConcessions", Math.min(v, maxConcessions))}
                          min={0}
                          max={Math.round(maxConcessions)}
                          step={500}
                          prefix="$"
                          disabled={!isLoanAllowed}
                        />
                        {inputs.sellerConcessions > 0 && (
                          <p className="text-[10px] text-green-700 text-right">
                            {pct.toFixed(1)}% of purchase price · reduces cash to close
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">Interest Rate</span>
                      {liveRates && (
                        <span className="text-[10px] font-semibold bg-green-100 text-green-700 rounded px-1 py-0.5 leading-none">LIVE</span>
                      )}
                      {liveRates && (
                        <a
                          href="https://www.mortgagenewsdaily.com/mortgage-rates"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary/60 hover:text-primary underline underline-offset-2 leading-none"
                        >
                          mortgagenewsdaily.com
                        </a>
                      )}
                    </div>
                    <SliderInput
                      label=""
                      value={inputs.interestRate}
                      onChange={(v) => set("interestRate", v)}
                      min={3} max={12} step={0.005}
                      suffix="%"
                      decimals={3}
                    />
                  </div>

                </CardContent>
              </Card>

            </div>

            {/* ── RESULTS ─────────────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Summary Banner */}
              <div className="overflow-hidden rounded-xl border-2 border-primary/20">
                {/* Qualification header bar */}
                <div className={`w-full py-2 px-4 text-center text-sm font-semibold tracking-wide ${calc.dti > 0.45 || calc.availableReserves < calc.requiredReserves ? "bg-red-600 text-white" : "bg-green-600 text-white"}`}>
                  {calc.dti > 0.45
                    ? "⚠ Needs Review — DTI exceeds 45%"
                    : calc.availableReserves < calc.requiredReserves
                    ? "⚠ Needs Review — Insufficient reserves"
                    : "✓ Likely Qualifies"}
                </div>
                {/* Metrics row */}
                <div className="bg-primary/5 px-5 py-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">New Monthly Mortgage Payment</p>
                      <p className="text-2xl font-bold text-primary">{fmt(calc.totalHousing)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Assumed Debts</p>
                      <p className="text-2xl font-bold text-primary">{fmt(inputs.monthlyDebts)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Monthly Income Needed</p>
                      <p className="text-2xl font-bold text-primary">{fmt(calc.requiredIncome)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Your DTI</p>
                      <p className={`text-2xl font-bold ${calc.dti > 0.45 ? "text-red-600" : "text-green-600"}`}>
                        {fmtPct(calc.dti)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Cash to Close</p>
                      <p className="text-2xl font-bold text-primary">{fmt(calc.cashToClose)}</p>
                    </div>
                  </div>
                </div>
              </div>

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
                  {inputs.sellerConcessions > 0 && (
                    <Row label="Seller Concessions" value={`− ${fmt(inputs.sellerConcessions)}`} sub={`${((inputs.sellerConcessions / inputs.purchasePrice) * 100).toFixed(1)}% of purchase price`} />
                  )}
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
                            <TableCell className="text-xs font-medium">
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
                  {inputs.hasRentalIncome === true && calc.rentalIncomeQualifying > 0 && (
                    <Row
                      label="Rental Income (75% qualifying)"
                      value={fmt(calc.rentalIncomeQualifying)}
                      sub={`of ${fmt(inputs.monthlyRentalIncome)}/mo gross`}
                    />
                  )}
                  <Row
                    label="Total Qualifying Income"
                    value={fmt(calc.qualifyingIncome)}
                    status={
                      calc.qualifyingIncome >= calc.requiredIncome * 1.15 ? "green"
                      : calc.qualifyingIncome >= calc.requiredIncome ? "yellow"
                      : "red"
                    }
                  />
                  <Row label="Required Monthly Income" value={fmt(calc.requiredIncome)} />
                  <Separator />
                  <Row
                    label="Housing DTI"
                    value={fmtPct(calc.housingDTI)}
                    sub="New mortgage ÷ qualifying income"
                    status={
                      calc.housingDTI <= 0.28 ? "green"
                      : calc.housingDTI <= 0.35 ? "yellow"
                      : "red"
                    }
                  />
                  <Row
                    label="Total DTI"
                    value={fmtPct(calc.dti)}
                    sub={calc.dti > calc.maxDti ? "Exceeds max DTI — needs review" : "New mortgage + debts ÷ qualifying income"}
                    status={
                      calc.dti < calc.maxDti * 0.85 ? "green"
                      : calc.dti <= calc.maxDti ? "yellow"
                      : "red"
                    }
                  />
                  <Row label="Max Allowed DTI" value={fmtPct(calc.maxDti)} sub={`Based on credit score ${inputs.creditScore}`} />
                  <Separator />
                  <Row label="Required Reserves (1-3 mo PITI)" value={fmt(calc.requiredReserves)} />
                  <Row
                    label="Your Available Reserves"
                    value={fmt(calc.availableReserves)}
                    sub={calc.availableReserves < calc.requiredReserves ? `Short ${fmt(calc.requiredReserves - calc.availableReserves)} of required reserves` : undefined}
                    status={
                      calc.availableReserves >= calc.requiredReserves * 1.5 ? "green"
                      : calc.availableReserves >= calc.requiredReserves ? "yellow"
                      : "red"
                    }
                  />
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

              <p className="text-xs text-muted-foreground text-center px-4 pb-4">
                All estimates are for informational purposes only and are not a commitment to lend. Actual rates, payments, and qualification requirements may vary. Contact a licensed mortgage professional for a full analysis.
              </p>
            </div>
          </div>
        </div>
      </div>

      <LeadCaptureDialog
        open={leadDialogOpen}
        onOpenChange={(open) => { setLeadDialogOpen(open); if (!open) setLeadDialogForScenario(false); }}
        action={leadDialogForScenario ? "new-scenario" : leadDialogAction}
        address={address}
        onSuccess={handleLeadSuccess}
      />

      {/* New scenario address prompt */}
      <Dialog open={showAddressPrompt} onOpenChange={setShowAddressPrompt}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Property</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">Enter the address for your new scenario (up to 5 total).</p>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={newScenarioInputRef}
                type="text"
                value={newScenarioAddress}
                onChange={(e) => setNewScenarioAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmNewScenario()}
                placeholder="123 Main St, City, State…"
                autoComplete="off"
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md outline-none focus:ring-2 ring-primary/30 focus:border-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowAddressPrompt(false); setNewScenarioAddress(""); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmNewScenario} disabled={!newScenarioAddress.trim()}>
                Add Property
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
