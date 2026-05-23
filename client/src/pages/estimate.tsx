import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { estimateAnnualTax, getCountyTaxLink, getCountyName } from "@/lib/county-tax-estimator";
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
  Mail,
  FileDown,
  Info,
  AlertTriangle,
  Minus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  Camera,
} from "lucide-react";
import {
  Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext,
} from "@/components/ui/carousel";
import { getSession, getPurchaseScenarios, savePurchaseScenarios } from "@/lib/auth";
import { useAuth } from "@/context/auth-context";
import { apiRequest } from "@/lib/queryClient";
import PropertyLookupDialog, { type LookedUpProperty } from "@/components/property-lookup-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadGoogleMapsApi } from "@/lib/script-loader";
import LeadCaptureDialog from "@/components/ui/lead-capture-dialog";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";

// ─── Calculation helpers ────────────────────────────────────────────────────

function calcPI(loanAmount: number, annualRate: number, termMonths = 360): number {
  if (loanAmount <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 12;
  return loanAmount * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

/** Minimum FICO required for a Conventional loan. Below this, the loan
 *  type is not offered (Fannie/Freddie won't price it). */
const CONVENTIONAL_MIN_FICO = 620;

/** Conventional PMI — credit-keyed annual factor, applied uniformly
 *  across LTV bands (per current pricing matrix). Returns monthly PMI
 *  dollars; $0 when LTV ≤ 80% or when the score is below the program
 *  minimum (in which case Conventional shouldn't be selectable anyway). */
function calcConventionalPMI(loanAmount: number, purchasePrice: number, creditScore: number): number {
  const ltv = loanAmount / purchasePrice;
  if (ltv <= 0.8) return 0;
  if (creditScore < CONVENTIONAL_MIN_FICO) return 0;
  let annualFactor: number;
  if      (creditScore >= 760) annualFactor = 0.0019;
  else if (creditScore >= 740) annualFactor = 0.0029;
  else if (creditScore >= 720) annualFactor = 0.0036;
  else if (creditScore >= 700) annualFactor = 0.0045;
  else if (creditScore >= 680) annualFactor = 0.0061;
  else if (creditScore >= 660) annualFactor = 0.0098;
  else if (creditScore >= 640) annualFactor = 0.0104;
  else                         annualFactor = 0.0117; // 620–639
  return (loanAmount * annualFactor) / 12;
}

function calcFHAMIP(loanAmount: number): number {
  return (loanAmount * 0.0055) / 12;
}

function calcVAFundingFeeAmt(baseLoan: number, vaDisability: boolean | null, vaLoanUse: "first" | "second" | null): number {
  if (vaDisability === true) return 0;
  const rate = vaLoanUse === "second" ? 0.033 : 0.0215;
  return Math.round(baseLoan * rate * 100) / 100;
}

function getMaxSellerConcessions(
  loanType: "conventional" | "fha" | "va" | "usda" | "dscr" | "bank_statement",
  occupancy: "primary" | "secondary" | "investment",
  downPaymentPct: number,
  purchasePrice: number,
): number {
  if (loanType === "fha" || loanType === "usda") return purchasePrice * 0.06;
  if (loanType === "va") return purchasePrice * 0.04;
  // DSCR is investment-only by program rules, so it always uses the
  // conventional investment cap (2%) regardless of the selected
  // occupancy in the UI.
  if (loanType === "dscr") return purchasePrice * 0.02;
  // Bank statement follows the conventional table (handled by the
  // conventional branch below — no early return needed).
  // Conventional
  if (occupancy === "secondary" || occupancy === "investment") return purchasePrice * 0.02;
  // Primary conventional
  if (downPaymentPct < 10) return purchasePrice * 0.03;
  if (downPaymentPct < 20) return purchasePrice * 0.06;
  return purchasePrice * 0.09;
}

function getDTILimits(loanType: "conventional" | "fha" | "va" | "usda" | "dscr" | "bank_statement"): { housingMax: number; totalMax: number } {
  switch (loanType) {
    case "fha":           return { housingMax: 0.47, totalMax: 0.57 };
    case "usda":          return { housingMax: 0.36, totalMax: 0.43 };
    case "va":            return { housingMax: Infinity, totalMax: Infinity };
    case "dscr":          return { housingMax: Infinity, totalMax: Infinity };
    case "bank_statement":return { housingMax: Infinity, totalMax: Infinity };
    default:              return { housingMax: 0.45, totalMax: 0.50 };
  }
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

// ─── Insurance engine ────────────────────────────────────────────────────────

type InsRegionKey = "keys" | "sefl" | "swfl" | "tampa" | "nefljax" | "central" | "ncfl";

const INS_REGIONS: Record<InsRegionKey, { name: string; counties: string; low: number; high: number; tier: string; tierColor: string; note: string }> = {
  keys:    { name: "Keys / Barrier Islands",    counties: "Monroe, barrier islands",                 low: 0.0495, high: 0.0665, tier: "Extreme",  tierColor: "bg-red-100 text-red-800",      note: "Extreme hurricane surge risk. Most major carriers have exited this market." },
  sefl:    { name: "SE FL Coastal",             counties: "Miami-Dade, Broward, Palm Beach",         low: 0.0233, high: 0.0407, tier: "High",     tierColor: "bg-orange-100 text-orange-800", note: "Hurricane exposure and high rebuild costs define this market." },
  swfl:    { name: "SW FL Coastal",             counties: "Lee, Collier, Charlotte, Manatee, Sarasota", low: 0.0134, high: 0.0207, tier: "High",  tierColor: "bg-orange-100 text-orange-800", note: "Post-Hurricane Ian reinsurance pricing continues to elevate rates." },
  tampa:   { name: "Tampa Bay Area",            counties: "Hillsborough, Pinellas, Pasco",           low: 0.0110, high: 0.0170, tier: "Mod-High", tierColor: "bg-yellow-100 text-yellow-800",  note: "Growing storm risk recognition and significant flood zone coverage push rates above Central FL." },
  nefljax: { name: "NE FL / Jacksonville",      counties: "Duval, Clay, St. Johns, Flagler",         low: 0.0080, high: 0.0127, tier: "Moderate", tierColor: "bg-blue-100 text-blue-800",     note: "Moderate coastal exposure with better carrier availability than South Florida." },
  central: { name: "Central FL Inland",         counties: "Orange, Osceola, Polk, Seminole",         low: 0.0078, high: 0.0122, tier: "Moderate", tierColor: "bg-blue-100 text-blue-800",     note: "Good carrier availability and shielded from direct coastal wind." },
  ncfl:    { name: "North-Central FL Inland",   counties: "Alachua, Marion, Sumter, Lake, Columbia", low: 0.0054, high: 0.0080, tier: "Low",      tierColor: "bg-green-100 text-green-800",   note: "Consistently the lowest rates in Florida — 60+ miles from the coast." },
};

const INS_COUNTY_TO_REGION: Record<string, InsRegionKey> = {
  "monroe": "keys",
  "miami-dade": "sefl", "broward": "sefl", "palm beach": "sefl", "st. lucie": "sefl", "martin": "sefl",
  "lee": "swfl", "collier": "swfl", "charlotte": "swfl", "manatee": "swfl", "sarasota": "swfl",
  "hillsborough": "tampa", "pinellas": "tampa", "pasco": "tampa", "hernando": "tampa",
  "duval": "nefljax", "clay": "nefljax", "st. johns": "nefljax", "st johns": "nefljax", "flagler": "nefljax", "nassau": "nefljax",
  "okaloosa": "nefljax", "santa rosa": "nefljax", "escambia": "nefljax",
  "orange": "central", "osceola": "central", "polk": "central", "seminole": "central", "lake": "central", "volusia": "central",
  "brevard": "central", "indian river": "central",
  "alachua": "ncfl", "marion": "ncfl", "sumter": "ncfl", "columbia": "ncfl", "putnam": "ncfl",
  "leon": "ncfl", "gadsden": "ncfl", "wakulla": "ncfl",
};

function getInsRegionFromAddress(address: string): InsRegionKey {
  const county = getCountyName(address);
  if (county && INS_COUNTY_TO_REGION[county]) return INS_COUNTY_TO_REGION[county];
  return "tampa";
}

const INS_ROOF_ADJ  = [0.90, 1.00, 1.20, 1.38];
const INS_WIND_ADJ  = [1.14, 1.00, 0.82];
const INS_HURR_ADJ  = [1.10, 1.05, 1.00];
const INS_CONST_ADJ = [0.93, 1.00, 1.08];
const INS_YEAR_ADJ  = [0.90, 1.00, 1.10, 1.28];
const INS_CLAIM_ADJ = [1.00, 1.14, 1.26, 1.40];

// ─── Types ──────────────────────────────────────────────────────────────────

/** Where the current purchasePrice value came from. Used to label the
 *  purchase-price field while Zillow/cache is loading and to keep
 *  user-typed values from being overwritten by background fetches. */
type PurchasePriceSource =
  | "default"
  | "user"
  | "zillow_listing"
  | "zillow_zestimate"
  | "zillow_sold"
  | "zillow_cache";

interface Inputs {
  occupancy: "primary" | "secondary" | "investment";
  purchasePrice: number;
  /** Provenance of `purchasePrice`. Defaults to "default" on a new scenario. */
  purchasePriceSource?: PurchasePriceSource;
  downPaymentPct: number;
  /** UX mode for the down-payment control on Page 3 + Page 4.
   *  "percent" (default): pct is canonical, $ amount is derived
   *  on every render. "amount": $ amount is canonical (stored in
   *  `downPaymentAmount`) and pct is derived. Persisted so the
   *  user's choice survives reload/login and stays in sync with
   *  the Page 3 controls in `pages/mortgage-new.tsx`. */
  downPaymentMode?: "percent" | "amount";
  /** Canonical down-payment dollar amount. Always mirrors
   *  `purchasePrice * downPaymentPct / 100` in "percent" mode and
   *  is the user-edited source of truth in "amount" mode. */
  downPaymentAmount?: number;
  sellerConcessions: number;
  /** UX mode for the seller-concessions control on Page 3. Persisted so
   *  the user's choice survives reload / login. The canonical numeric
   *  value remains `sellerConcessions` in dollars — every downstream
   *  calculation (cash-to-close, summaries, etc.) keeps reading dollars,
   *  so this flag only affects how the Page 3 slider is rendered and
   *  edited. Defaults to "percent" for new scenarios. */
  sellerConcessionsMode?: "percent" | "amount";
  loanType: "conventional" | "fha" | "va" | "usda" | "dscr" | "bank_statement";
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
  isVeteran: boolean | null;
  vaDisability: boolean | null;
  /** Follow-up to `vaDisability === true`: is the rating 100%?
   *  Strictly boolean — there is no "not sure" / unknown state. When the
   *  user has not answered (or has not been asked because they don't
   *  receive VA disability), this is null. A `true` value combined with
   *  `occupancy === "primary"` zeros out `annualTaxes` as a homestead
   *  exemption estimate (see `computePropertyTax`). */
  vaDisabilityRating100: boolean | null;
  vaLoanUse: "first" | "second" | null;
  currentLoanFHA: boolean | null;
  hasRentalIncome: boolean | null;
  monthlyRentalIncome: number;
  rentalType: "annual" | "short-term" | null;
}

const FALLBACK_RATES = { conventional: 6.82, fha: 6.17, va: 6.25, usda: 6.38, dscr: 6.82, bank_statement: 6.82 };

interface PlaceMeta {
  placeId?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  lat?: number;
  lng?: number;
}

interface Scenario {
  id: string;
  address: string;
  savedInputs: Inputs | null;
  placeMeta?: PlaceMeta;
  /** Per-scenario dashboard auto-save status. "idle" means no pending
   *  change. "saving" is set while the debounced auto-save effect is
   *  about to write. "saved" is set right after a successful write
   *  (auto-clears to "idle" after a short delay). "error" stays sticky
   *  until the next successful save. Per-id so saves on one tab never
   *  leak a "Saving…" label onto another tab. */
  saveStatus?: "idle" | "saving" | "saved" | "error";
  /** Status of the background Zillow/cache lookup for this scenario.
   *  - "loading":            request in flight (cache check or scrape).
   *  - "loaded_from_cache":  served from Supabase property_cache.
   *  - "loaded_from_zillow": fresh Apify scrape applied.
   *  - "error":              lookup failed; defaults remain in use.
   *  Legacy values ("applied"/"unavailable") are kept as aliases so older
   *  code paths and any persisted state still render correctly. */
  zillowStatus?:
    | "loading"
    | "applied"
    | "unavailable"
    | "loaded_from_cache"
    | "loaded_from_zillow"
    | "error";
  /**
   * Snapshot of the inputs we auto-populated when this scenario was first
   * created (defaults / carried-over values). When the Zillow scrape
   * returns, a field is only overwritten if its current value still equals
   * the baseline — i.e., the user hasn't manually touched it.
   */
  baselineInputs?: Inputs;
}

function makeDefaultInputs(price = 350000): Inputs {
  return {
    occupancy: "primary", purchasePrice: price, purchasePriceSource: "default", downPaymentPct: 5, downPaymentMode: "percent", downPaymentAmount: Math.round(price * 0.05), sellerConcessions: 0, sellerConcessionsMode: "percent",
    loanType: "conventional", creditScore: 780,
    interestRate: FALLBACK_RATES.conventional,
    annualTaxes: Math.round(price * 0.015), hoaMonthly: 0, cddAnnual: 0,
    annualHOIns: Math.round(price * 0.0075), annualFloodIns: 2000,
    monthlyDebts: 0, monthlyIncome: 8000, reserves: 35000,
    impactWindows: false, roofAttachment: "toenails", swr: false,
    hasMortgage: null, currentLoanFHA: null, hasRentalIncome: null, monthlyRentalIncome: 0, rentalType: null,
    isVeteran: null, vaDisability: null, vaDisabilityRating100: null, vaLoanUse: null,
  };
}

/**
 * Single source of truth for annual property tax estimation. Returns $0
 * when the user has confirmed 100% VA disability AND the property will be
 * their primary residence — Florida (and most counties we serve) grant a
 * full homestead property-tax exemption in that case. Final eligibility
 * must still be confirmed with the county property appraiser; this is an
 * estimate-only adjustment shown to the user with a clarifying note next
 * to the Property Taxes row.
 *
 * Any other combination (no VA disability, not 100%, or non-primary use)
 * falls back to the standard county-aware estimate.
 */
function computePropertyTax(
  address: string,
  purchasePrice: number,
  occupancy: "primary" | "secondary" | "investment",
  vaDisabilityRating100: boolean | null,
): number {
  if (vaDisabilityRating100 === true && occupancy === "primary") return 0;
  return estimateAnnualTax(address, purchasePrice, occupancy === "primary");
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

function fhaCreditAdjustment(score: number): number {
  if (score >= 740) return -0.50;
  if (score >= 720) return -0.25;
  if (score >= 700) return  0;
  if (score >= 680) return  0.10;
  if (score >= 660) return  0.50;
  if (score >= 640) return  1.00;
  return 1.50;
}

function adjustedRate(base: number, score: number): number {
  return Math.round((base + creditAdjustment(score)) * 1000) / 1000;
}

function occupancyRateAdj(occupancy: "primary" | "secondary" | "investment", downPct: number): number {
  if (occupancy === "secondary") {
    if (downPct < 15)  return 1.50;
    if (downPct < 20)  return 1.00;
    if (downPct < 25)  return 0.75;
    if (downPct < 35)  return 0.50;
    return 0.25;
  }
  if (occupancy === "investment") {
    if (downPct < 25)  return 1.00;
    if (downPct < 30)  return 0.75;
    if (downPct < 35)  return 0.50;
    return 0.25;
  }
  return 0;
}

function fullRate(base: number, score: number, occupancy: "primary" | "secondary" | "investment", downPct: number, loanType?: string): number {
  const adj = (loanType === "fha" || loanType === "va") ? fhaCreditAdjustment(score) : creditAdjustment(score);
  return Math.round((base + adj + occupancyRateAdj(occupancy, downPct)) * 1000) / 1000;
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

/**
 * Wrapper used by the Property Estimate (step 4) summary's pencil/edit
 * buttons. When `editing` is true, the wrapped step Card is rendered inside
 * a Dialog overlay on top of the estimate so the user never leaves step 4
 * or loses their address / Zillow cache / active scenario tab. When false,
 * children pass through unchanged so the questionnaire flow (steps 1-3)
 * renders normally. All form fields inside the wrapped Card continue to
 * bind to the active scenario's `inputs`/`setInputs`, so edits flow
 * through the existing recalculation + debounced auto-save effects with
 * no separate save path.
 */
function StepEditWrapper({
  editing,
  title,
  onClose,
  children,
}: {
  editing: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!editing) return <>{children}</>;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        <Button onClick={onClose} className="w-full mt-2">Done</Button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Property photo carousel for the Purchase / `/estimate` flow.
 * Mirrors the Cash Buy PhotoCarousel (client/src/pages/cash-buy.tsx)
 * so behaviour stays consistent across surfaces:
 *   - "loading"  → spinner with text
 *   - "loaded" + 0 photos → friendly placeholder (NOT shown while loading)
 *   - 1 photo    → single image
 *   - 2+ photos  → carousel with prev/next arrows
 * Photos are deduped via the primary+rest merge.
 */
function PhotoCarousel({
  photos, primary, status,
}: {
  photos: string[]; primary?: string; status: "idle" | "loading" | "loaded" | "error";
}) {
  const all = useMemo(() => {
    const list = [primary, ...photos].filter((p): p is string => !!p);
    return Array.from(new Set(list));
  }, [photos, primary]);

  if (status === "loading" && all.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/40 aspect-[16/9] flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading property photos…
      </div>
    );
  }
  if (all.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 aspect-[16/9] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
        <Camera className="h-5 w-5" />
        <span>No photos found for this property.</span>
      </div>
    );
  }
  if (all.length === 1) {
    return (
      <div className="rounded-xl overflow-hidden border bg-muted/20">
        <img src={all[0]} alt="" className="w-full aspect-[16/9] object-cover" />
      </div>
    );
  }
  return (
    <Carousel className="w-full">
      <CarouselContent>
        {all.map((src, i) => (
          <CarouselItem key={`${i}-${src}`}>
            <div className="rounded-xl overflow-hidden border bg-muted/20">
              <img src={src} alt="" className="w-full aspect-[16/9] object-cover" />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

export default function Estimate() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const address = params.get("address") || "Unknown Address";
  const servicesAll = params.get("services") === "all";
  const fromDashboard = params.get("from") === "dashboard";
  // Debug flag (?debug=1) re-exposes admin-only escape hatches that were
  // removed from the normal user UI now that Zillow auto-pulls and the
  // dashboard auto-saves. Keeps these reachable for QA without polluting
  // the real user flow.
  const debugMode = params.get("debug") === "1";

  const { toast } = useToast();

  // ── Auth & multi-scenario state ─────────────────────────────────────────────
  // SOURCE OF TRUTH: the auth context, which subscribes to Supabase session
  // changes. The previous local `useState` was set only once on mount, and
  // because Supabase session hydration is async, a logged-in user landing
  // here before hydration finished would be treated as a guest forever —
  // which is what caused the lead-capture dialog (with "Who are you working
  // with?") to re-appear when adding a new property estimate.
  const { user: authUser } = useAuth();
  // Local-only flag for guests who completed the lead-capture flow but did
  // not create a real account. Persisted across reloads via localStorage.
  const [leadUnlocked, setLeadUnlocked] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("tateo_auth") === "1"
  );
  const isAuthenticated = !!authUser || leadUnlocked;
  // Seed scenarios from the user's saved dashboard properties so all of them appear as subtabs
  // when navigating from the dashboard (or anywhere else, for logged-in users).
  const initialScenariosRef = useRef<{ list: Scenario[]; activeId: string; freshSeededId: string | null } | null>(null);
  if (initialScenariosRef.current === null) {
    const fallback = { list: [{ id: "sc0", address, savedInputs: null }], activeId: "sc0", freshSeededId: "sc0" as string | null };
    const hasSession = typeof window !== "undefined"
      && (getSession() !== null || localStorage.getItem("tateo_auth") === "1");
    if (!hasSession) {
      initialScenariosRef.current = fallback;
    } else {
      const saved = getPurchaseScenarios();
      const list: Scenario[] = saved.map(s => ({ id: `sc_${s.id}`, address: s.address, savedInputs: null }));
      const key = address.trim().toLowerCase();
      const match = list.find(s => s.address.trim().toLowerCase() === key);
      if (match) {
        // Reopening a saved property — NOT a fresh URL seed; don't auto-zillow.
        initialScenariosRef.current = { list, activeId: match.id, freshSeededId: null };
      } else if (address && address !== "Unknown Address") {
        // A genuinely-new address arrived via the URL — auto-zillow eligible.
        const newScenario: Scenario = { id: "sc0", address, savedInputs: null };
        initialScenariosRef.current = { list: [newScenario, ...list], activeId: newScenario.id, freshSeededId: newScenario.id };
      } else {
        initialScenariosRef.current = list.length ? { list, activeId: list[0].id, freshSeededId: null } : fallback;
      }
    }
  }
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenariosRef.current.list);
  const [activeScenarioId, setActiveScenarioId] = useState(initialScenariosRef.current.activeId);

  // Fire a background Zillow lookup once on mount for the URL-seeded initial
  // scenario — but ONLY when it's a genuinely-new address (the user just
  // typed it in / clicked through from the home page), not when reopening a
  // saved dashboard property. The decision was made at init-time and
  // recorded as `freshSeededId`.
  const initialZillowFiredRef = useRef(false);
  useEffect(() => {
    if (initialZillowFiredRef.current) return;
    const freshId = initialScenariosRef.current?.freshSeededId;
    if (!freshId) return;
    const active = scenarios.find(s => s.id === freshId);
    if (!active || !active.address || active.address === "Unknown Address") return;
    initialZillowFiredRef.current = true;
    // Snapshot baseline now, before Zillow can return. Also seed the
    // ref-backed map so the merge path doesn't depend on React state timing.
    baselineByIdRef.current[active.id] = { ...inputs };
    setScenarios(prev =>
      prev.map(s => s.id === active.id && !s.baselineInputs ? { ...s, baselineInputs: { ...inputs } } : s)
    );
    triggerZillowLookup(active.id, active.address);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showAddressPrompt, setShowAddressPrompt] = useState(false);
  const [showZillowLookup, setShowZillowLookup] = useState(false);

  // Apply Zillow lookup results: update purchase price + HOA on the active
  // scenario; if Zillow returned a different formatted address, navigate so
  // the URL stays the source of truth for `address`.
  function handleZillowApply(p: LookedUpProperty) {
    setInputs(prev => ({
      ...prev,
      purchasePrice: p.purchasePrice ?? p.listingPrice ?? p.zestimate ?? prev.purchasePrice,
      purchasePriceSource:
        (p.purchasePrice ?? p.listingPrice ?? p.zestimate) != null
          ? inferPriceSource(p, p.purchasePrice ?? p.listingPrice ?? p.zestimate ?? null, false)
          : prev.purchasePriceSource,
      hoaMonthly: p.hoaMonthly ?? prev.hoaMonthly,
    }));
    if (p.address && p.address.trim().toLowerCase() !== address.trim().toLowerCase()) {
      setLocation(`/estimate?address=${encodeURIComponent(p.address)}`);
    }
  }
  // Addresses we've already fired the background Zillow fetch for in this
  // session — keyed by `${scenarioId}|${normalizedAddress}` so the same
  // address in different scenarios still works, but the same scenario won't
  // double-fetch.
  const zillowFetchedKeysRef = useRef<Set<string>>(new Set());
  // Mirror of activeScenarioId for the async completion path. The async
  // callback may resolve long after the user has switched tabs, so we read
  // the *current* active id from this ref. The ref is updated SYNCHRONOUSLY
  // at every tab-switch site (via `setActive` below) so there is no
  // post-render window where it points at a stale tab.
  const activeScenarioIdRef = useRef(activeScenarioId);
  // Map of scenarioId -> baseline inputs snapshot. Backed by a ref so the
  // async Zillow callback can read the correct baseline without depending
  // on React state-update timing.
  const baselineByIdRef = useRef<Record<string, Inputs>>({});

  // Synchronous setter used at every tab-switch site so the ref always
  // matches the active tab the user is actually looking at.
  function setActive(nextId: string) {
    activeScenarioIdRef.current = nextId;
    setActiveScenarioId(nextId);
  }

  // Ref-backed flag that suppresses the `[address]` URL→scenario sync
  // effect for the next URL change. Set synchronously by code paths
  // (add/switch/remove) that already own the address for the active
  // scenario, so the effect doesn't corrupt the wrong tab during the
  // wouter intermediate render. See the comment on that effect below.
  const skipNextAddressSyncRef = useRef(false);

  // Pure merge: produce next inputs from current+baseline+Zillow, honoring
  // the "don't overwrite user edits" rule by comparing current vs baseline.
  // When purchasePrice is replaced, also stamp its source so the UI can
  // label it (e.g. "Source: Zillow sold price").
  function mergeZillowIntoInputs(
    current: Inputs,
    baseline: Inputs | undefined,
    zPrice: number | null,
    zHoa: number | null,
    priceSource: PurchasePriceSource | null = null,
  ): Inputs {
    const next: Inputs = { ...current };
    // Treat the field as user-edited if the source is "user" (explicit)
    // or if the current value diverges from the baseline default.
    const userEditedPrice =
      current.purchasePriceSource === "user" ||
      (baseline != null && current.purchasePrice !== baseline.purchasePrice);
    if (zPrice != null && !userEditedPrice) {
      next.purchasePrice = zPrice;
      if (priceSource) next.purchasePriceSource = priceSource;
    }
    if (zHoa != null && (!baseline || current.hoaMonthly === baseline.hoaMonthly)) {
      next.hoaMonthly = zHoa;
    }
    return next;
  }

  // Given a LookedUpProperty + cache flag + the resolved zPrice, infer
  // which Zillow field actually populated the purchase price so the UI
  // can show a precise source label.
  function inferPriceSource(
    p: LookedUpProperty,
    zPrice: number | null,
    fromCache: boolean,
  ): PurchasePriceSource {
    if (fromCache) return "zillow_cache";
    if (zPrice == null) return "zillow_zestimate";
    if (p.isSold && p.soldPrice != null && p.soldPrice === zPrice) return "zillow_sold";
    if (p.listingPrice != null && p.listingPrice === zPrice) return "zillow_listing";
    return "zillow_zestimate";
  }

  // Fire the background Zillow lookup for a specific scenario by id. Never
  // touches any other scenario, even if the user switches tabs mid-flight.
  // All state mutation at completion goes through functional updaters so the
  // dirty-check is deterministic against the latest state.
  function triggerZillowLookup(scenarioId: string, addr: string) {
    if (!addr || addr === "Unknown Address") return;
    const key = `${scenarioId}|${addr.trim().toLowerCase()}`;
    if (zillowFetchedKeysRef.current.has(key)) return;
    zillowFetchedKeysRef.current.add(key);

    setScenarios(prev =>
      prev.map(s => s.id === scenarioId ? { ...s, zillowStatus: "loading" } : s)
    );

    (async () => {
      try {
        const res = await apiRequest("POST", "/api/zillow-property-lookup", { addressOrUrl: addr });
        const body = await res.json();
        const p = body?.property as LookedUpProperty | undefined;
        const fromCache: boolean = body?.cached === true;
        if (!p) {
          setScenarios(prev =>
            prev.map(s => s.id === scenarioId ? { ...s, zillowStatus: "error" } : s)
          );
          return;
        }
        const zPrice = p.purchasePrice ?? p.listingPrice ?? p.zestimate ?? null;
        const zHoa = p.hoaMonthly ?? null;
        const priceSource = inferPriceSource(p, zPrice, fromCache);
        const nextStatus = fromCache ? "loaded_from_cache" : "loaded_from_zillow";
        // Resolve active-ness from the ref so a tab switch mid-flight
        // doesn't cause us to mirror this update onto a different tab.
        const isActive = activeScenarioIdRef.current === scenarioId;

        // Photo normalization — server returns `p.photos: string[]` already
        // deduped + filtered by the expanded `pickPhotos` extractor. Apply
        // the data-safety rule: only overwrite the saved photo array when
        // the fresh result is non-empty (the backend already preserves cached
        // photos through empty scrapes, so an empty here means "really none").
        const freshPhotos = Array.isArray(p.photos)
          ? p.photos.filter((x): x is string => typeof x === "string" && x.length > 0)
          : [];
        const freshPrimary = freshPhotos[0] ?? undefined;
        console.log(`[zillow-photos] display photos count=${freshPhotos.length} fromCache=${fromCache}`);

        // Update the scenario's saved snapshot using ONLY the latest state
        // visible to the functional updater.
        setScenarios(prev =>
          prev.map(s => {
            if (s.id !== scenarioId) return s;
            // For an inactive tab, the canonical "current" is its savedInputs.
            // For the active tab, savedInputs is whatever was last snapshotted
            // (typically stale) — the live `inputs` state is the source of
            // truth and is merged separately below.
            const baseSnapshot = s.savedInputs ?? s.baselineInputs ?? null;
            // Photo merge: always prefer a non-empty fresh array; otherwise
            // keep whatever was already on the scenario (don't blank out).
            const nextPhotos = freshPhotos.length > 0 ? freshPhotos : s.propertyPhotos;
            const nextPrimary = freshPrimary ?? s.primaryPhotoUrl;
            if (!baseSnapshot) return {
              ...s,
              zillowStatus: nextStatus,
              ...(nextPhotos ? { propertyPhotos: nextPhotos } : {}),
              ...(nextPrimary ? { primaryPhotoUrl: nextPrimary } : {}),
            };
            const merged = mergeZillowIntoInputs(baseSnapshot, s.baselineInputs, zPrice, zHoa, priceSource);
            return {
              ...s,
              savedInputs: merged,
              zillowStatus: nextStatus,
              ...(nextPhotos ? { propertyPhotos: nextPhotos } : {}),
              ...(nextPrimary ? { primaryPhotoUrl: nextPrimary } : {}),
            };
          })
        );
        if (freshPhotos.length > 0) {
          console.log(`[zillow-photos] saving to scenario id=${scenarioId} photos=${freshPhotos.length}`);
        }

        // Mirror into live `inputs` only if this scenario is still active
        // RIGHT NOW. Baseline comes from the ref-backed map so we don't
        // depend on React state timing or nest setter side effects.
        if (isActive) {
          const baseline = baselineByIdRef.current[scenarioId];
          setInputs(curr => mergeZillowIntoInputs(curr, baseline, zPrice, zHoa, priceSource));
          if (zPrice != null) {
            toast({
              title: fromCache ? "Property data loaded from saved records" : "Zillow data applied",
              description: `Updated estimated price to ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(zPrice)}.`,
            });
          }
        }
      } catch (err: any) {
        console.warn(`[zillow-auto] lookup failed for ${addr}:`, err?.message || err);
        setScenarios(prev =>
          prev.map(s => s.id === scenarioId ? { ...s, zillowStatus: "error" } : s)
        );
      }
    })();
  }

  const [newScenarioAddress, setNewScenarioAddress] = useState("");
  const newScenarioInputRef = useRef<HTMLInputElement>(null);
  const newScenarioAcRef = useRef<any>(null);
  // Holds the latest "auto-add on place_changed" handler so the Google
  // Autocomplete listener (whose closure is captured at attach time)
  // always sees current state when it fires.
  const autoAddRef = useRef<((addr: string, meta?: PlaceMeta) => void) | null>(null);
  // Idempotency: prevents Google's known double-fire of place_changed (and
  // any rapid re-selection of the same suggestion) from creating duplicate
  // tabs. Cleared when the dialog is closed.
  const lastAddedPlaceKeyRef = useRef<string | null>(null);
  const [leadDialogForScenario, setLeadDialogForScenario] = useState(false);

  // Keep `autoAddRef` pointing at the latest confirmNewScenario closure
  // so the Google Autocomplete listener (attached once when the dialog opens)
  // always sees current inputs/scenarios when it fires.
  useEffect(() => {
    autoAddRef.current = (addr, meta) => {
      // Idempotency guard — Google sometimes fires place_changed twice for
      // a single selection. Key on placeId when available, otherwise on the
      // normalized address string.
      const key = (meta?.placeId || addr.trim().toLowerCase());
      if (lastAddedPlaceKeyRef.current === key) return;
      lastAddedPlaceKeyRef.current = key;
      setNewScenarioAddress(addr);
      // Pass `addr` explicitly so we don't depend on the async state update.
      confirmNewScenario(meta, addr);
    };
  });

  // Reset the idempotency key whenever the Add Property dialog opens so
  // re-adding the same address in a later session still works.
  useEffect(() => {
    if (showAddressPrompt) lastAddedPlaceKeyRef.current = null;
  }, [showAddressPrompt]);

  // Keep active scenario's address in sync when URL changes (inline edit).
  // Defensive: never overwrite an existing valid address with empty/placeholder.
  //
  // CRITICAL: wouter's `setLocation` uses `useSyncExternalStore`, which is
  // intentionally NOT batched with React 18's queued updates. That means
  // when `confirmNewScenario` / `switchScenario` / `removeScenario` call
  // `setScenarios` + `setActive` + `setLocation` together, React renders
  // ONCE for the URL change with the OLD scenarios + OLD activeScenarioId
  // still in place — and only then flushes the queued scenario/active
  // updates. If this effect runs in that intermediate render, it
  // overwrites the OLD active scenario's address with the NEW URL value,
  // corrupting the previously-saved tab (the original "first tab now
  // shows the new address" bug).
  //
  // Those three code paths already set each scenario's `address` field
  // explicitly, so they don't need this effect at all — they set the
  // skip-ref synchronously just before calling `setLocation`. Only the
  // genuine inline-address-edit path (which calls `setLocation` without
  // mutating scenarios first) goes through here.
  useEffect(() => {
    if (!address || address === "Unknown Address") return;
    if (skipNextAddressSyncRef.current) {
      skipNextAddressSyncRef.current = false;
      return;
    }
    setScenarios(prev =>
      prev.map(s => s.id === activeScenarioId ? { ...s, address } : s)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Reorder property tabs via drag-and-drop. Operates on the full scenario
  // objects (keyed by id), so address + savedInputs stay glued to the right
  // property; activeScenarioId is unchanged so the active tab follows its
  // scenario after the move.
  const [draggingScenarioId, setDraggingScenarioId] = useState<string | null>(null);
  function moveScenario(fromId: string, toId: string) {
    if (fromId === toId) return;
    setScenarios(prev => {
      const fromIdx = prev.findIndex(s => s.id === fromId);
      const toIdx = prev.findIndex(s => s.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = prev.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  // Init Google Maps autocomplete on the new-scenario address prompt
  useEffect(() => {
    if (!showAddressPrompt) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!newScenarioInputRef.current) return;
      try {
        let apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "";
        if (!apiKey) {
          const res = await fetch("/api/config/google-maps-api-key");
          const data = await res.json();
          apiKey = data.apiKey || "";
        }
        if (!apiKey || cancelled || !newScenarioInputRef.current) return;
        await loadGoogleMapsApi(apiKey);
        if (cancelled || !(window as any).google?.maps?.places?.Autocomplete || !newScenarioInputRef.current) return;
        const ac = new (window as any).google.maps.places.Autocomplete(
          newScenarioInputRef.current,
          {
            types: ["address"],
            componentRestrictions: { country: "us" },
            fields: ["formatted_address", "place_id", "address_components", "geometry"],
          }
        );
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const formatted = place?.formatted_address as string | undefined;
          // Defensive: ignore empty/partial results so an existing valid
          // address can never be overwritten with nothing.
          if (!formatted || formatted.length < 6 || !formatted.includes(",")) {
            return;
          }
          // Extract metadata from address_components (forgiving of missing parts).
          const comps: any[] = place?.address_components || [];
          const get = (type: string) =>
            comps.find(c => Array.isArray(c?.types) && c.types.includes(type));
          const streetNumber = get("street_number")?.long_name || "";
          const route = get("route")?.long_name || "";
          const meta: PlaceMeta = {
            placeId: place?.place_id,
            street: [streetNumber, route].filter(Boolean).join(" ") || undefined,
            city: get("locality")?.long_name || get("sublocality")?.long_name,
            state: get("administrative_area_level_1")?.short_name,
            zip: get("postal_code")?.long_name,
            county: get("administrative_area_level_2")?.long_name,
            lat: place?.geometry?.location?.lat?.(),
            lng: place?.geometry?.location?.lng?.(),
          };
          setNewScenarioAddress(formatted);
          // Auto-add — `place_changed` is the source of truth, no extra click needed.
          autoAddRef.current?.(formatted, meta);
        });
        newScenarioAcRef.current = ac;
      } catch (err) {
        console.warn("New-scenario autocomplete unavailable:", err);
      }
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (newScenarioAcRef.current) {
        (window as any).google?.maps?.event?.clearInstanceListeners?.(newScenarioAcRef.current);
        newScenarioAcRef.current = null;
      }
    };
  }, [showAddressPrompt]);

  function switchScenario(targetId: string) {
    if (targetId === activeScenarioId) return;
    const target = scenarios.find(s => s.id === targetId);
    if (!target) return;
    // Snapshot current inputs into active scenario
    setScenarios(prev =>
      prev.map(s => s.id === activeScenarioId ? { ...s, savedInputs: inputs } : s)
    );
    setActive(targetId);
    skipNextAddressSyncRef.current = true;
    setLocation(`/estimate?address=${encodeURIComponent(target.address)}`);
    if (target.savedInputs) setInputs(target.savedInputs);
    else setInputs(inputsForAddress(target.address));
  }

  function removeScenario(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (scenarios.length === 1) return;
    const idx = scenarios.findIndex(s => s.id === id);
    const removed = scenarios[idx];
    const remaining = scenarios.filter(s => s.id !== id);
    setScenarios(remaining);

    // Also remove the corresponding entry from the dashboard so it doesn't
    // immediately get re-added by the auto-save effect on the next render.
    if (removed) {
      try {
        const key = removed.address.trim().toLowerCase();
        const next = getPurchaseScenarios().filter(s => s.address.trim().toLowerCase() !== key);
        savePurchaseScenarios(next);
      } catch (err) {
        console.warn("Failed to remove scenario from dashboard:", err);
      }
    }

    // Free any baseline ref entry for the removed scenario.
    delete baselineByIdRef.current[id];
    if (id === activeScenarioId) {
      const next = remaining[Math.max(0, idx - 1)];
      setActive(next.id);
      skipNextAddressSyncRef.current = true;
      setLocation(`/estimate?address=${encodeURIComponent(next.address)}`);
      if (next.savedInputs) setInputs(next.savedInputs);
      else setInputs(inputsForAddress(next.address));
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

  function confirmNewScenario(meta?: PlaceMeta, addrOverride?: string) {
    // Prefer the explicitly passed value (from the autocomplete callback) over
    // React state, which may not have flushed yet when this runs.
    const addr = (addrOverride ?? newScenarioAddress).trim();
    // Defensive: reject empty / obviously-partial addresses so a half-typed
    // entry (or an empty place_changed callback) can't overwrite anything.
    // A real Google formatted_address always has at least one comma
    // ("123 Main St, Tampa, FL 33602").
    if (!addr) return;
    if (addr.length < 6 || !addr.includes(",")) {
      toast({
        title: "Address looks incomplete",
        description: "Please pick a full address from the suggestions (street, city, state).",
        variant: "destructive",
      });
      return;
    }
    // Don't add a duplicate tab for an address we already have open.
    const dupKey = addr.toLowerCase();
    const dup = scenarios.find(s => s.address.trim().toLowerCase() === dupKey);
    if (dup) {
      toast({ title: "Already added", description: "Switching to that property." });
      setActive(dup.id);
      skipNextAddressSyncRef.current = true;
      setLocation(`/estimate?address=${encodeURIComponent(dup.address)}${fromDashboard ? "&from=dashboard" : ""}`);
      setNewScenarioAddress("");
      setShowAddressPrompt(false);
      return;
    }
    // Collision-safe id — Date.now() can collide if Google double-fires within
    // the same millisecond. randomUUID is available in all modern browsers.
    const newId = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? `sc_${crypto.randomUUID()}`
      : `sc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Carry over the current borrower/purchase inputs so the user
    // doesn't re-enter everything for the new property. They can
    // still tweak anything on the new tab.
    //
    // Reset `purchasePriceSource` to "default" for the new scenario:
    // the carried-over price is a starting estimate for a different
    // property, not a user edit for THIS property. Without this reset
    // the merge guard would mistakenly treat the inherited "user" source
    // as sticky and refuse to apply the new tab's Zillow/cache price.
    const carriedInputs: Inputs = { ...inputs, purchasePriceSource: "default" };
    // Seed the ref-backed baseline map BEFORE the async Zillow fetch, so the
    // async callback can read the correct baseline regardless of React
    // state-update timing.
    baselineByIdRef.current[newId] = { ...carriedInputs };
    setScenarios(prev => [
      ...prev.map(s => s.id === activeScenarioId ? { ...s, savedInputs: inputs } : s),
      {
        id: newId,
        address: addr,
        savedInputs: carriedInputs,
        placeMeta: meta,
        // Snapshot the carried inputs so we can later tell whether the user
        // has manually edited any field before Zillow data arrives.
        baselineInputs: { ...carriedInputs },
      },
    ]);
    setActive(newId);
    // Mirror the reset carriedInputs into live state. Without this, live
    // `inputs.purchasePriceSource` would still carry the prior tab's
    // "user" marker, causing `mergeZillowIntoInputs` to skip applying the
    // new tab's Zillow/cache price on the active tab. This keeps the
    // active merge, the source label, and the new-scenario snapshot all
    // consistent with the new-tab baseline.
    setInputs(carriedInputs);
    // The new scenario object already carries `address: addr`, so the
    // URL→active-scenario sync effect must NOT run here — otherwise it
    // would fire during wouter's pre-batch intermediate render (with
    // activeScenarioId still pointing at the OLD tab) and overwrite the
    // previous tab's address with the new one.
    skipNextAddressSyncRef.current = true;
    setLocation(`/estimate?address=${encodeURIComponent(addr)}${fromDashboard ? "&from=dashboard" : ""}`);
    // Keep inputs as-is (carry over). Only let flood re-fetch for the new address.
    floodLoadedRef.current = null;
    // Kick off the background Zillow scrape for this new scenario — the user
    // can keep using the app while it loads. We pass the stable id so the
    // result lands on the right tab even if the user switches in the
    // meantime.
    triggerZillowLookup(newId, addr);
    setNewScenarioAddress("");
    setShowAddressPrompt(false);

    // Notify the assigned agent in FollowUpBoss (non-blocking)
    const sessionUser = getSession();
    if (sessionUser) {
      const fullName = (sessionUser.name || "").trim();
      const spaceIdx = fullName.indexOf(" ");
      const firstName = spaceIdx > 0 ? fullName.slice(0, spaceIdx) : (fullName || sessionUser.email.split("@")[0]);
      const lastName = spaceIdx > 0 ? fullName.slice(spaceIdx + 1) : "-";
      fetch("/api/leads/notify-new-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email: sessionUser.email,
          phone: sessionUser.phone || "",
          agent: sessionUser.agent || "Team",
          address: addr,
          scenarioDetails: buildScenarioDetails(),
        }),
      }).catch(err => console.warn("Failed to notify agent of new scenario:", err));
    }
  }

  // Share dialog
  const [step, setStep] = useState(fromDashboard ? 4 : 1);
  // Which questionnaire page is currently being edited from the Property
  // Estimate (step 4) summary. `null` = not editing. When set, that step's
  // Card is rendered inside a Dialog overlay on top of the estimate so the
  // user never leaves step 4. Closing the dialog (or switching scenarios)
  // resets to null. All form fields inside continue to bind to the active
  // scenario's `inputs`/`setInputs`, so edits flow through the existing
  // calculation + debounced auto-save effects (no separate save path).
  const [editingPage, setEditingPage] = useState<1 | 2 | 3 | null>(null);
  // Close any open edit dialog when the user switches scenario tabs so
  // the dialog can't bleed across scenarios while inputs swap underneath.
  useEffect(() => { setEditingPage(null); }, [activeScenarioId]);
  const [answersOpen, setAnswersOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  function generateEstimatePDF() {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    const margin = 48;
    const col2 = W / 2 + 8;
    let y = margin;

    function addPage() {
      doc.addPage();
      y = margin;
    }
    function checkPage(needed = 60) {
      if (y + needed > doc.internal.pageSize.getHeight() - margin) addPage();
    }
    function hLine(yy = y) {
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, yy, W - margin, yy);
    }
    function sectionHeader(title: string) {
      checkPage(40);
      doc.setFillColor(23, 55, 94);
      doc.roundedRect(margin, y, W - margin * 2, 22, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(title.toUpperCase(), margin + 10, y + 15);
      doc.setTextColor(30, 30, 30);
      y += 30;
    }
    function row(label: string, value: string, sub?: string) {
      checkPage(sub ? 36 : 22);
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(label, margin + 4, y + 12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(value, W - margin - 4, y + 12, { align: "right" });
      if (sub) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(130, 130, 130);
        doc.text(sub, W - margin - 4, y + 22, { align: "right" });
      }
      y += sub ? 34 : 22;
      doc.setDrawColor(235, 235, 235);
      doc.line(margin, y, W - margin, y);
    }
    function metricBox(label: string, value: string, x: number, boxY: number, color?: [number, number, number]) {
      const bw = (W - margin * 2) / 3 - 6;
      doc.setFillColor(248, 249, 252);
      doc.roundedRect(x, boxY, bw, 52, 4, 4, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(label, x + bw / 2, boxY + 16, { align: "center" });
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      const [r, g, b] = color ?? [23, 55, 94];
      doc.setTextColor(r, g, b);
      doc.text(value, x + bw / 2, boxY + 38, { align: "center" });
      doc.setTextColor(30, 30, 30);
    }

    // ── Header ──────────────────────────────────────────────────────────
    doc.setFillColor(23, 55, 94);
    doc.rect(0, 0, W, 70, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Tateo & Co", margin, 35);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Home Cost & Qualification Estimate", margin, 52);
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    doc.setFontSize(9);
    doc.text(dateStr, W - margin, 35, { align: "right" });
    doc.text(address, W - margin, 52, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y = 90;

    // ── Qualification status bar ─────────────────────────────────────────
    const qualColor: [number, number, number] = calc.qualifies ? [22, 163, 74] : [220, 38, 38];
    doc.setFillColor(...qualColor);
    doc.roundedRect(margin, y, W - margin * 2, 28, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const qualText = calc.qualifies ? "✓  Likely Qualifies" : "⚠  Needs Review";
    doc.text(qualText, W / 2, y + 19, { align: "center" });
    doc.setTextColor(30, 30, 30);
    y += 38;

    // ── Key metrics ──────────────────────────────────────────────────────
    const bw = (W - margin * 2) / 3 - 6;
    const mx = [margin, margin + bw + 6, margin + (bw + 6) * 2];
    const dtiColor: [number, number, number] = calc.dti > calc.maxTotalDti ? [220, 38, 38] : [22, 163, 74];
    metricBox("Monthly Payment", fmt(calc.totalHousing), mx[0], y);
    metricBox("Total DTI", fmtPct(calc.dti), mx[1], y, dtiColor);
    metricBox("Cash to Close", fmt(calc.cashToClose), mx[2], y);
    y += 62;

    // ── Inputs summary ────────────────────────────────────────────────────
    sectionHeader("Loan Parameters");
    const half = (W - margin * 2) / 2 - 6;
    const leftX = margin;
    const rightX = margin + half + 6;
    const paramRows: [string, string][] = [
      ["Purchase Price", fmt(inputs.purchasePrice)],
      ["Loan Type", inputs.loanType.toUpperCase()],
      ["Down Payment", `${fmt(calc.downPaymentAmt)} (${Number(inputs.downPaymentPct).toFixed(1)}%)`],
      ["Interest Rate", `${inputs.interestRate.toFixed(3)}%`],
      ["Occupancy", inputs.occupancy.charAt(0).toUpperCase() + inputs.occupancy.slice(1)],
      ["Credit Score", String(inputs.creditScore)],
    ];
    const startY = y;
    paramRows.forEach(([lbl, val], i) => {
      const px = i % 2 === 0 ? leftX : rightX;
      const py = startY + Math.floor(i / 2) * 26;
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(lbl, px + 4, py + 12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(val, px + half - 4, py + 12, { align: "right" });
    });
    y = startY + Math.ceil(paramRows.length / 2) * 26 + 8;

    // ── Real Estate ───────────────────────────────────────────────────────
    sectionHeader("Real Estate");
    row("Purchase Price", fmt(inputs.purchasePrice));
    row("Down Payment", `${fmt(calc.downPaymentAmt)} (${Number(inputs.downPaymentPct).toFixed(1)}%)`);
    row("Loan Amount", fmt(calc.loanAmount), inputs.loanType === "fha" ? `includes 1.75% financing fee (${fmt(calc.fhaUFMIP)}) · LTV ${fmtPct(calc.ltv)}` : `LTV ${fmtPct(calc.ltv)}`);
    row("Estimated Closing Costs (~3%)", fmt(calc.closingCosts));
    if (inputs.sellerConcessions > 0) row("Seller Concessions", `− ${fmt(inputs.sellerConcessions)}`);
    row("Estimated Cash to Close", fmt(calc.cashToClose));

    // ── Mortgage ──────────────────────────────────────────────────────────
    checkPage(20);
    sectionHeader("Monthly Mortgage Breakdown");
    row("Principal & Interest", fmt(calc.pi), `${inputs.interestRate.toFixed(3)}% / 30 yr`);
    row("Property Taxes", `${fmt(calc.monthlyTax)}/mo`, `${fmt(inputs.annualTaxes)}/yr`);
    row("Homeowners Insurance", `${fmt(calc.monthlyHOIns)}/mo`);
    row("Flood Insurance", `${fmt(calc.monthlyFlood)}/mo`);
    if (inputs.hoaMonthly > 0) row("HOA", fmt(inputs.hoaMonthly));
    if (inputs.cddAnnual > 0) row("CDD", `${fmt(calc.monthlyCDD)}/mo`);
    if (calc.mortgageInsurance > 0) {
      const miLabel = inputs.loanType === "fha" ? "FHA MIP" : "PMI";
      row(miLabel, fmt(calc.mortgageInsurance));
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setFillColor(23, 55, 94);
    doc.rect(margin, y, W - margin * 2, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("Total Monthly Payment", margin + 8, y + 16);
    doc.text(fmt(calc.totalHousing), W - margin - 8, y + 16, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y += 32;

    // ── Qualification ─────────────────────────────────────────────────────
    checkPage(20);
    sectionHeader("Qualification Analysis");
    row("Monthly Income", fmt(inputs.monthlyIncome));
    if (inputs.hasRentalIncome && calc.rentalIncomeQualifying > 0)
      row("Rental Income (75%)", fmt(calc.rentalIncomeQualifying));
    row("Total Qualifying Income", fmt(calc.qualifyingIncome));
    row("Required Monthly Income", fmt(calc.requiredIncome));
    const hDTIMax = calc.maxHousingDti === Infinity ? "No limit (VA)" : `Max ${fmtPct(calc.maxHousingDti)}`;
    const tDTIMax = calc.maxTotalDti === Infinity ? "No limit (VA)" : `Max ${fmtPct(calc.maxTotalDti)}`;
    row("Housing DTI", fmtPct(calc.housingDTI), hDTIMax);
    row("Total DTI", fmtPct(calc.dti), tDTIMax);
    row("Required Reserves (1-3 mo PITI)", fmt(calc.requiredReserves));
    row("Available Reserves", fmt(calc.availableReserves));
    row("Monthly Debts", fmt(inputs.monthlyDebts));

    // ── Footer ─────────────────────────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160, 160, 160);
      hLine(pageH - 30);
      doc.text("Tateo & Co · admin@tateoco.com · (813) 214-8356 · This estimate is for informational purposes only.", margin, pageH - 16);
      doc.text(`Page ${i} of ${totalPages}`, W - margin, pageH - 16, { align: "right" });
    }

    doc.save(`Tateo-Estimate-${address.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40)}.pdf`);
  }

  // Lead capture dialog
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadDialogAction, setLeadDialogAction] = useState<"share" | "save">("share");
  const [leadScenarioDetails, setLeadScenarioDetails] = useState<string | undefined>();

  function buildScenarioDetails(): string {
    const { purchasePrice, downPaymentPct, loanType, interestRate } = inputs;
    const c = calc;
    const money = (n: number) => "$" + Math.round(n).toLocaleString();
    const loanLabel = loanType === "conventional" ? "Conventional" : loanType === "fha" ? "FHA" : loanType === "va" ? "VA" : loanType === "usda" ? "USDA" : loanType === "dscr" ? "DSCR" : loanType === "bank_statement" ? "Bank Statement" : loanType.toUpperCase();
    return [
      `Purchase Price: ${money(purchasePrice)}`,
      `Down Payment: ${money(c.downPaymentAmt)} (${Number(downPaymentPct).toFixed(1)}%)`,
      `Loan Amount: ${money(c.loanAmount)}`,
      `Loan Type: ${loanLabel}`,
      `Interest Rate: ${interestRate.toFixed(3)}%`,
      `Monthly P&I: ${money(c.pi)}`,
      `Total Monthly Housing: ${money(c.totalHousing)}`,
      `Est. Cash to Close: ${money(c.cashToClose)}`,
    ].join(" | ");
  }

  function openLeadDialog(action: "share" | "save") {
    setLeadDialogForScenario(false);
    setLeadDialogAction(action);
    setLeadScenarioDetails(buildScenarioDetails());
    setLeadDialogOpen(true);
  }

  function handleLeadSuccess() {
    if (leadDialogForScenario) {
      setLeadDialogForScenario(false);
      try { localStorage.setItem("tateo_auth", "1"); } catch {}
      setLeadUnlocked(true);
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

  // Builds the starting Inputs for an address, restoring any tunable fields
  // the user previously saved on the dashboard so we don't overwrite their
  // saved estimate with default-derived numbers on revisit.
  function inputsForAddress(addr: string): Inputs {
    const base = makeDefaultInputs(defaultPrice);
    if (typeof window === "undefined") return base;
    const hasSession = getSession() !== null || localStorage.getItem("tateo_auth") === "1";
    if (!hasSession || !addr) return base;
    const key = addr.trim().toLowerCase();
    const saved = getPurchaseScenarios().find(s => s.address.trim().toLowerCase() === key);
    if (!saved) return base;
    const price = saved.price ?? base.purchasePrice;
    const validLoanTypes = ["conventional", "fha", "va", "usda", "dscr", "bank_statement"] as const;
    const loanType = validLoanTypes.includes(saved.loanType as any)
      ? (saved.loanType as Inputs["loanType"])
      : base.loanType;
    // Reconcile saved DP mode + pct + amount so Page 4 picks up
    // whatever the user last set on Page 3 (or in a previous Page 4
    // session). When the saved mode is "amount" and a $ value is
    // present, the pct is recomputed from amount/price so the two
    // stay coherent even if the price has since changed.
    const savedMode: "percent" | "amount" =
      saved.downPaymentMode === "amount" ? "amount" : "percent";
    const savedPct = saved.downPaymentPct ?? base.downPaymentPct;
    let dpPct = savedPct;
    let dpAmt =
      saved.downPaymentAmount != null
        ? Math.round(saved.downPaymentAmount)
        : Math.round(price * (savedPct / 100));
    if (savedMode === "amount" && price > 0) {
      const clampedAmt = Math.max(0, Math.min(dpAmt, price));
      dpAmt = clampedAmt;
      dpPct = Math.round((clampedAmt / price) * 10000) / 100;
    } else if (savedMode === "percent") {
      dpAmt = Math.round(price * (dpPct / 100));
    }
    return {
      ...base,
      purchasePrice: price,
      downPaymentPct: dpPct,
      downPaymentMode: savedMode,
      downPaymentAmount: dpAmt,
      interestRate: saved.interestRate ?? base.interestRate,
      loanType,
      annualTaxes: Math.round(price * 0.015),
      annualHOIns: Math.round(price * 0.0075),
    };
  }

  const [inputs, setInputs] = useState<Inputs>(() => inputsForAddress(address));

  // ── Insurance panel state ───────────────────────────────────────────────────
  const insuranceSectionRef = useRef<HTMLDivElement>(null);
  const [insRegionKey, setInsRegionKey] = useState<InsRegionKey>(() => getInsRegionFromAddress(address));
  const [insRoofIdx, setInsRoofIdx] = useState(1);
  const [insWindIdx, setInsWindIdx] = useState(1);
  const [insHurrIdx, setInsHurrIdx] = useState(0);
  const [insConstIdx, setInsConstIdx] = useState(0);
  const [insYearIdx, setInsYearIdx] = useState(1);
  const [insClaimsIdx, setInsClaimsIdx] = useState(0);

  // Auto-detect region whenever address changes
  useEffect(() => {
    if (address && address !== "Unknown Address") {
      setInsRegionKey(getInsRegionFromAddress(address));
    }
  }, [address]);

  // Calculate insurance premium from the engine
  const insPremiumCalc = useMemo(() => {
    const region = INS_REGIONS[insRegionKey];
    const rebuild = inputs.purchasePrice;
    const adj = INS_ROOF_ADJ[insRoofIdx] * INS_WIND_ADJ[insWindIdx] * INS_HURR_ADJ[insHurrIdx]
              * INS_CONST_ADJ[insConstIdx] * INS_YEAR_ADJ[insYearIdx] * INS_CLAIM_ADJ[insClaimsIdx];
    const lowRate  = region.low  * adj;
    const highRate = region.high * adj;
    const midRate  = (lowRate + highRate) / 2;
    return {
      low:   Math.round(rebuild * lowRate),
      mid:   Math.round(rebuild * midRate),
      high:  Math.round(rebuild * highRate),
      monthly: Math.round(rebuild * midRate / 12),
      hurrDeductible: Math.round(rebuild * [0.02, 0.03, 0.05][insHurrIdx]),
      hurrPct: [2, 3, 5][insHurrIdx],
    };
  }, [inputs.purchasePrice, insRegionKey, insRoofIdx, insWindIdx, insHurrIdx, insConstIdx, insYearIdx, insClaimsIdx]);

  // Wire insurance midpoint into annualHOIns
  useEffect(() => {
    setInputs(prev => ({ ...prev, annualHOIns: insPremiumCalc.mid }));
  }, [insPremiumCalc.mid]);

  // Re-derive the non-canonical down-payment field whenever the
  // purchase price changes. The user's chosen mode is the source of
  // truth: in "amount" mode we hold the dollar amount steady and
  // recompute pct; in "percent" mode we hold the pct steady and
  // recompute the dollar amount. This keeps Page 4 self-consistent
  // when the user edits price after picking a down-payment mode.
  useEffect(() => {
    setInputs((p) => {
      if (p.purchasePrice <= 0) return p;
      if (p.downPaymentMode === "amount" && p.downPaymentAmount != null) {
        const clampedAmt = Math.max(0, Math.min(p.downPaymentAmount, p.purchasePrice));
        const newPct = Math.round((clampedAmt / p.purchasePrice) * 10000) / 100;
        if (clampedAmt === p.downPaymentAmount && newPct === p.downPaymentPct) return p;
        return { ...p, downPaymentAmount: clampedAmt, downPaymentPct: newPct };
      }
      const newAmt = Math.round(p.purchasePrice * (p.downPaymentPct / 100));
      if (newAmt === p.downPaymentAmount) return p;
      return { ...p, downPaymentAmount: newAmt };
    });
  }, [inputs.purchasePrice]);

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

  // Sync interest rate to live rate (with credit + occupancy adjustments) when rates first load
  const ratesLoadedRef = useRef(false);
  useEffect(() => {
    if (liveRates && !ratesLoadedRef.current) {
      ratesLoadedRef.current = true;
      setInputs((p) => ({ ...p, interestRate: fullRate((liveRates as any)[p.loanType] ?? liveRates.fha, p.creditScore, p.occupancy, p.downPaymentPct, p.loanType) }));
    }
  }, [liveRates]);

  // Auto-recalculate property taxes whenever the address changes
  const taxAddressRef = useRef<string>("");
  useEffect(() => {
    if (address && address !== taxAddressRef.current) {
      taxAddressRef.current = address;
      setInputs((p) => ({
        ...p,
        annualTaxes: computePropertyTax(address, p.purchasePrice, p.occupancy, p.vaDisabilityRating100),
      }));
    }
  }, [address]);

  function getMinDown(lt: "conventional" | "fha" | "va" | "usda" | "dscr" | "bank_statement", hasMortgage: boolean | null, occupancy?: "primary" | "secondary" | "investment"): number {
    if (occupancy === "investment") return 20;
    if (occupancy === "secondary") return 10;
    if (lt === "va" || lt === "usda") return 0;
    if (lt === "fha") return 3.5;
    return hasMortgage === true ? 5 : 3;
  }

  // ─── Purchase loan-type priority rule ───────────────────────────
  // On Page 3 (Purchase Details) the visible loan type must follow a
  // strict priority that beats whatever the user previously had
  // selected:
  //   1. Primary + Veteran          → VA   (overrides everything)
  //   2. Primary + FICO < 720       → FHA  (only when not veteran)
  //   3. Otherwise no recommendation (existing selection wins).
  // Non-primary (Secondary / Investment) is never auto-defaulted to
  // FHA or VA — those programs require Primary occupancy.
  // Returns null when no rule applies.
  function getPurchaseRecommendedLoanType(args: {
    occupancy: "primary" | "secondary" | "investment";
    creditScore: number;
    isVeteran: boolean | null;
  }): "fha" | "va" | null {
    if (args.occupancy !== "primary") return null;
    if (args.isVeteran === true) return "va";
    // Strict "not a veteran" per spec — `null` means unanswered and
    // is treated as unknown so we don't auto-pick FHA before the
    // veteran question is answered on Page 2.
    if (args.isVeteran === false && Number(args.creditScore) < 720) return "fha";
    return null;
  }

  function setLoanType(lt: "conventional" | "fha" | "va" | "usda" | "dscr" | "bank_statement") {
    setInputs((p) => {
      const newMin = getMinDown(lt, p.hasMortgage, p.occupancy);
      const newDown = Math.max(p.downPaymentPct, newMin);
      const baseRate = (lt === "dscr" || lt === "bank_statement") ? rates.conventional : ((rates as any)[lt] ?? rates.conventional);
      return {
        ...p,
        loanType: lt,
        interestRate: fullRate(baseRate, p.creditScore, p.occupancy, newDown, lt),
        downPaymentPct: newDown,
      };
    });
  }

  function setOccupancy(occ: "primary" | "secondary" | "investment") {
    setInputs((p) => {
      const isAltInvestment = p.loanType === "dscr" || p.loanType === "bank_statement";
      // Non-primary normally forces Conventional, but Conventional
      // requires 620+ FICO. For sub-620 investment, fall through to
      // DSCR (no FICO floor in the same way). For sub-620 secondary
      // there's no eligible program — keep Conventional so the
      // selector + warning communicates the ineligibility instead of
      // leaving `loanType` undefined.
      const belowConvMin = p.creditScore < CONVENTIONAL_MIN_FICO;
      const forcedLoan = occ === "primary" ? p.loanType
        : occ === "investment" && isAltInvestment ? p.loanType
        : occ === "investment" && belowConvMin ? "dscr"
        : "conventional";
      const newMin = getMinDown(forcedLoan, p.hasMortgage, occ);
      const newDown = Math.max(p.downPaymentPct, newMin);
      const baseRate = (forcedLoan === "dscr" || forcedLoan === "bank_statement") ? rates.conventional : ((rates as any)[forcedLoan] ?? rates.conventional);
      return {
        ...p,
        occupancy: occ,
        loanType: forcedLoan,
        interestRate: fullRate(baseRate, p.creditScore, occ, newDown, forcedLoan),
        downPaymentPct: newDown,
        rentalType: occ === "investment" ? p.rentalType : null,
        annualTaxes: computePropertyTax(address, p.purchasePrice, occ, p.vaDisabilityRating100),
      };
    });
  }

  function setCreditScore(score: number) {
    setInputs((p) => {
      const isAltLoan = p.loanType === "dscr" || p.loanType === "bank_statement";
      // Below Conventional's program floor (620), Conventional isn't a
      // valid option — auto-switch to FHA on primary residences so the
      // user lands on something pricable. On non-primary, leave whatever
      // alt-investment loan they have selected; pure Conventional on
      // non-primary with sub-620 credit is gated in the loan-type
      // selector with a warning instead of silently switching.
      const belowConvMin = score < CONVENTIONAL_MIN_FICO;
      const autoLoanType =
        isAltLoan ? p.loanType :
        // Sub-620 + primary → swap Conventional out for FHA so the
        // user lands on something pricable.
        belowConvMin && p.loanType === "conventional" && p.occupancy === "primary" ? "fha" :
        // Sub-620 + investment → swap Conventional out for DSCR
        // (alt-investment, no equivalent FICO floor).
        belowConvMin && p.loanType === "conventional" && p.occupancy === "investment" ? "dscr" :
        // Sub-620 + secondary → keep Conventional. There's no eligible
        // alternative; the selector renders Conventional disabled with
        // an explicit ineligibility warning so the state stays consistent.
        p.occupancy !== "primary" ? "conventional" :
        score < 720 && p.loanType === "conventional" ? "fha" :
        score >= 720 && p.loanType === "fha" ? "conventional" :
        p.loanType;
      const baseRate = isAltLoan ? rates.conventional : ((rates as any)[autoLoanType] ?? rates.conventional);
      return {
        ...p,
        creditScore: score,
        loanType: autoLoanType,
        interestRate: fullRate(baseRate, score, p.occupancy, p.downPaymentPct, autoLoanType),
      };
    });
  }

  // Re-apply the Purchase loan-type priority rule whenever any input
  // it depends on changes, or whenever the user reaches Page 3. This
  // is what makes Primary + sub-720 land on FHA (and Primary + Veteran
  // land on VA) even when a saved scenario carried in a stale
  // Conventional selection. `inputs.loanType` is the same state Page 4
  // reads, so the two pages stay in sync automatically.
  useEffect(() => {
    const rec = getPurchaseRecommendedLoanType({
      occupancy: inputs.occupancy,
      creditScore: inputs.creditScore,
      isVeteran: inputs.isVeteran,
    });
    console.debug("[purchase-loan-default] credit score", inputs.creditScore);
    console.debug("[purchase-loan-default] occupancy/property use", inputs.occupancy);
    console.debug("[purchase-loan-default] veteran/VA eligible", inputs.isVeteran);
    console.debug("[purchase-loan-default] previous loan type", inputs.loanType);
    console.debug("[purchase-loan-default] recommended loan type", rec);
    if (!rec) {
      console.debug("[purchase-loan-default] final selected loan type", inputs.loanType, "(no rule applies)");
      return;
    }
    // FHA → snap to its standard 3.5%; VA → 0%.
    const targetDown = rec === "fha" ? 3.5 : 0;
    // Skip only when the loan type AND the down-payment already match
    // the recommendation. Without the DP check, FHA arriving via
    // setCreditScore's own auto-switch (which preserves the prior DP)
    // would leave a stale 5% / 20% in place, violating the spec's
    // "default DP to 3.5% when FHA wins" requirement.
    if (rec === inputs.loanType && inputs.downPaymentPct === targetDown) {
      console.debug("[purchase-loan-default] final selected loan type", inputs.loanType, "(already matches)");
      return;
    }
    setInputs((p) => {
      const newMin = getMinDown(rec, p.hasMortgage, p.occupancy);
      const newDown = Math.max(targetDown, newMin);
      const baseRate = (rates as any)[rec] ?? rates.conventional;
      console.debug("[purchase-loan-default] final selected loan type", rec);
      console.debug("[purchase-loan-default] updated fields", {
        loanType: rec,
        downPaymentPct: newDown,
        downPaymentAmount: Math.round(p.purchasePrice * (newDown / 100)),
      });
      console.debug("[purchase-loan-default] Page 3 visible loan type", rec);
      console.debug("[purchase-loan-default] Page 4 visible loan type", rec);
      return {
        ...p,
        loanType: rec,
        downPaymentPct: newDown,
        downPaymentAmount: Math.round(p.purchasePrice * (newDown / 100)),
        downPaymentMode: "percent",
        interestRate: fullRate(baseRate, p.creditScore, p.occupancy, newDown, rec),
      };
    });
    // NOTE: No FHA-DPA / `uses_dpa` / `dpa_type` fields exist in the
    // current Inputs / purchase_scenarios schema, so the spec's
    // "clear DPA state when VA wins" / "keep DPA available on FHA"
    // requirements are no-ops here — there is nothing to clear or
    // expose. If a DPA toggle is added later, reset it to false
    // alongside the `loanType: rec` write above.
    // NOTE: `step` is intentionally NOT a dependency. The rule must
    // fire on input/scenario changes so it can correct a stale
    // Conventional carried in from a saved scenario, but it must NOT
    // fire on mere step navigation — otherwise a user who manually
    // overrides loan type on Page 4 would see the rule clobber their
    // choice the moment they navigate back to Page 3.
  }, [inputs.occupancy, inputs.creditScore, inputs.isVeteran, activeScenarioId]);

  function setDownPayment(pct: number) {
    setInputs((p) => {
      const minDown = getMinDown(p.loanType, p.hasMortgage, p.occupancy);
      const newDown = Math.max(pct, minDown);
      // Re-derive the $ amount so the Dollar-Amount input/display
      // stays in sync when the user edits the percent slider.
      const newAmt = Math.round(p.purchasePrice * (newDown / 100));
      return {
        ...p,
        downPaymentPct: newDown,
        downPaymentMode: "percent",
        downPaymentAmount: newAmt,
        interestRate: fullRate((rates as any)[p.loanType] ?? rates.conventional, p.creditScore, p.occupancy, newDown, p.loanType),
      };
    });
  }

  /** Dollar-Amount mode setter. Stores the user-typed dollar amount
   *  as canonical and derives pct from the current purchase price.
   *  Honors the same per-loan-type minimum DP enforced by
   *  `setDownPayment` (clamps amount up to `minPct * price` when the
   *  typed value would otherwise drop below program minimums). */
  function setDownPaymentDollars(amount: number) {
    setInputs((p) => {
      const safeAmt = Math.max(0, Math.min(amount, p.purchasePrice));
      const minPct = getMinDown(p.loanType, p.hasMortgage, p.occupancy);
      const minAmt = Math.round(p.purchasePrice * (minPct / 100));
      const finalAmt = Math.max(safeAmt, minAmt);
      const finalPct =
        p.purchasePrice > 0
          ? Math.round((finalAmt / p.purchasePrice) * 10000) / 100
          : minPct;
      return {
        ...p,
        downPaymentAmount: finalAmt,
        downPaymentPct: finalPct,
        downPaymentMode: "amount",
        interestRate: fullRate((rates as any)[p.loanType] ?? rates.conventional, p.creditScore, p.occupancy, finalPct, p.loanType),
      };
    });
  }

  /** Toggle the DP control between Percentage and Dollar Amount.
   *  Switching never changes the numeric down-payment — it just
   *  flips which field the UI lets you edit. */
  function setDownPaymentMode(mode: "percent" | "amount") {
    setInputs((p) => {
      const amt =
        p.downPaymentAmount != null
          ? p.downPaymentAmount
          : Math.round(p.purchasePrice * (p.downPaymentPct / 100));
      return { ...p, downPaymentMode: mode, downPaymentAmount: amt };
    });
  }

  function set<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs((p) => ({ ...p, [key]: value }));
  }

  /** Reusable Seller Concessions control. Rendered on Page 3 (Loan
   *  Details) and Page 4 (See My Estimate → Real Estate card). Both
   *  surfaces edit the same canonical `inputs.sellerConcessions`
   *  dollar field, so they stay synced automatically and the value
   *  auto-saves with the rest of the inputs. Caps come from
   *  `getMaxSellerConcessions` and are enforced on every write. */
  function renderSellerConcessions() {
    const maxConcessions = getMaxSellerConcessions(inputs.loanType, inputs.occupancy, inputs.downPaymentPct, inputs.purchasePrice);
    const price = inputs.purchasePrice;
    const pct = price > 0 ? (inputs.sellerConcessions / price) * 100 : 0;
    const maxPct = price > 0 ? (maxConcessions / price) * 100 : 0;
    const isLoanAllowed = !(
      (inputs.loanType === "fha" || inputs.loanType === "usda" || inputs.loanType === "va") &&
      inputs.occupancy !== "primary"
    );
    const mode = inputs.sellerConcessionsMode ?? "percent";
    const setMode = (m: "percent" | "amount") => set("sellerConcessionsMode", m);
    const setFromPct = (newPct: number) => {
      const dollars = price > 0 ? Math.round((price * newPct) / 100) : 0;
      set("sellerConcessions", Math.min(Math.max(0, dollars), Math.round(maxConcessions)));
    };
    const setFromAmount = (newAmt: number) => {
      set("sellerConcessions", Math.min(Math.max(0, newAmt), Math.round(maxConcessions)));
    };
    const atCap = isLoanAllowed && maxConcessions > 0 && inputs.sellerConcessions >= Math.round(maxConcessions);
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="text-xs text-muted-foreground">Seller Concessions</span>
          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded border border-border overflow-hidden text-[10px] leading-none">
              <button
                type="button"
                onClick={() => setMode("percent")}
                disabled={!isLoanAllowed}
                className={`px-2 py-1 transition-colors ${
                  mode === "percent"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-background text-muted-foreground hover:text-foreground"
                } ${!isLoanAllowed ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-pressed={mode === "percent"}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => setMode("amount")}
                disabled={!isLoanAllowed}
                className={`px-2 py-1 border-l border-border transition-colors ${
                  mode === "amount"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-background text-muted-foreground hover:text-foreground"
                } ${!isLoanAllowed ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-pressed={mode === "amount"}
              >
                $
              </button>
            </div>
            {isLoanAllowed ? (
              <span className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
                Max {maxPct.toFixed(2)}% · {fmt(maxConcessions)}
              </span>
            ) : (
              <span className="text-[10px] bg-red-50 text-red-600 rounded px-1.5 py-0.5">
                Not allowed on {inputs.occupancy} with {inputs.loanType.toUpperCase()}
              </span>
            )}
          </div>
        </div>
        {mode === "percent" ? (
          <SliderInput
            label=""
            value={Number(pct.toFixed(2))}
            onChange={setFromPct}
            min={0}
            max={Math.max(0, Number(maxPct.toFixed(2)))}
            step={0.25}
            suffix="%"
            decimals={2}
            disabled={!isLoanAllowed || price <= 0}
          />
        ) : (
          <SliderInput
            label=""
            value={inputs.sellerConcessions}
            onChange={setFromAmount}
            min={0}
            max={Math.round(maxConcessions)}
            step={500}
            prefix="$"
            disabled={!isLoanAllowed}
          />
        )}
        {inputs.sellerConcessions > 0 && price > 0 && (
          <p className="text-[10px] text-green-700 text-right">
            {pct.toFixed(2)}% · {fmt(inputs.sellerConcessions)} · reduces cash to close
          </p>
        )}
        {atCap && (
          <p className="text-[10px] text-amber-600 text-right">Maximum allowed for this loan type.</p>
        )}
        {price <= 0 && (
          <p className="text-[10px] text-muted-foreground text-right">
            Enter a purchase price to see the linked {mode === "percent" ? "dollar" : "percent"} value.
          </p>
        )}
      </div>
    );
  }

  /** Reusable Down Payment control. Rendered inside the Real Estate
   *  card on Page 4 (See My Estimate) so the user can flip between
   *  Percentage / Dollar Amount and slide live. Edits the same
   *  canonical `inputs.downPaymentPct` + `downPaymentMode` +
   *  `downPaymentAmount` fields used by the rest of the app, which
   *  is also what Page 3 (Loan Details / Purchase Details edit
   *  overlay) writes to — so the two surfaces stay synced via the
   *  shared scenario state without any duplicate state here. Matches
   *  the style of `renderSellerConcessions()` a few lines below it. */
  function renderDownPayment() {
    const price = inputs.purchasePrice;
    const minDown = getMinDown(inputs.loanType, inputs.hasMortgage, inputs.occupancy);
    const mode: "percent" | "amount" = inputs.downPaymentMode ?? "percent";
    const dpAmt =
      inputs.downPaymentAmount ??
      Math.round(price * (inputs.downPaymentPct / 100));
    const minAmt = price > 0 ? Math.round(price * (minDown / 100)) : 0;
    const maxAmt = Math.max(minAmt, Math.round(price * 0.5));
    const loanAmt = Math.max(0, price - dpAmt);
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="text-xs text-muted-foreground">
            Down Payment
            <span className="ml-1.5 text-foreground/80 font-medium">
              {Number(inputs.downPaymentPct).toFixed(2)}% / {fmt(dpAmt)}
            </span>
          </span>
          <div className="inline-flex rounded border border-border overflow-hidden text-[10px] leading-none">
            <button
              type="button"
              data-testid="dp-mode-percent-re"
              onClick={() => setDownPaymentMode("percent")}
              className={`px-2 py-1 transition-colors ${
                mode === "percent"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={mode === "percent"}
            >%</button>
            <button
              type="button"
              data-testid="dp-mode-amount-re"
              onClick={() => setDownPaymentMode("amount")}
              className={`px-2 py-1 border-l border-border transition-colors ${
                mode === "amount"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={mode === "amount"}
            >$</button>
          </div>
        </div>
        {mode === "percent" ? (
          <SliderInput
            label=""
            value={Number(Number(inputs.downPaymentPct).toFixed(2))}
            onChange={(v) => setDownPayment(v)}
            min={minDown}
            max={50}
            step={0.25}
            suffix="%"
            decimals={2}
            disabled={price <= 0}
          />
        ) : (
          <SliderInput
            label=""
            value={dpAmt}
            onChange={(v) => setDownPaymentDollars(v)}
            min={minAmt}
            max={maxAmt}
            step={500}
            prefix="$"
            disabled={price <= 0}
          />
        )}
        <p className="text-[10px] text-muted-foreground text-right">
          Loan Amount: <span className="font-semibold text-foreground">{fmt(loanAmt)}</span>
          <span className="ml-1 opacity-70">(price − down payment)</span>
        </p>
      </div>
    );
  }

  // ─── Calculations ──────────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const { purchasePrice, downPaymentPct, loanType, creditScore, interestRate,
      annualTaxes, hoaMonthly, cddAnnual, annualHOIns, annualFloodIns,
      monthlyDebts, monthlyIncome, monthlyRentalIncome, reserves, impactWindows, roofAttachment, swr,
      vaDisability, vaLoanUse } = inputs;

    const downPaymentAmt = purchasePrice * (downPaymentPct / 100);
    const baseLoanAmount = purchasePrice - downPaymentAmt;
    const fhaUFMIP = loanType === "fha" ? Math.round(baseLoanAmount * 0.0175 * 100) / 100 : 0;
    const vaFundingFeeAmt = loanType === "va" ? calcVAFundingFeeAmt(baseLoanAmount, vaDisability, vaLoanUse) : 0;
    const loanAmount = baseLoanAmount + fhaUFMIP + vaFundingFeeAmt;
    const rate = interestRate / 100;
    const ltv = baseLoanAmount / purchasePrice;

    const pi = calcPI(loanAmount, rate);
    const monthlyTax = annualTaxes / 12;
    const monthlyHOIns = annualHOIns / 12;
    const monthlyFlood = annualFloodIns / 12;
    const monthlyCDD = cddAnnual / 12;

    const pmi = loanType === "conventional" ? calcConventionalPMI(baseLoanAmount, purchasePrice, creditScore) : 0;
    const mip = loanType === "fha" ? calcFHAMIP(loanAmount) : 0;
    const mortgageInsurance = pmi + mip;

    const totalHousing = pi + monthlyTax + monthlyHOIns + monthlyFlood + hoaMonthly + monthlyCDD + mortgageInsurance;
    const closingCosts = Math.round(purchasePrice * 0.03);
    const sellerConcessions = inputs.sellerConcessions ?? 0;
    // Cap the seller-concession credit applied to cash-to-close at
    // eligible closing costs — concessions can't reduce down payment
    // or go below $0 cash-to-close. The user's selected concession
    // amount is preserved in `inputs.sellerConcessions` for display.
    const sellerConcessionsApplied = Math.min(sellerConcessions, closingCosts);
    const cashToClose = Math.round(downPaymentAmt + closingCosts - sellerConcessionsApplied);

    // Rental income: lenders allow 75% of gross rental income to count toward qualifying income
    const rentalIncomeQualifying = Math.round((monthlyRentalIncome ?? 0) * 0.75);
    const qualifyingIncome = monthlyIncome + rentalIncomeQualifying;

    const housingDTI = qualifyingIncome > 0 ? totalHousing / qualifyingIncome : 0;
    const dti = qualifyingIncome > 0 ? (totalHousing + monthlyDebts) / qualifyingIncome : 0;
    const { housingMax: maxHousingDti, totalMax: maxTotalDti } = getDTILimits(loanType);
    const maxDti = maxTotalDti; // keep for backward compat in recs
    const requiredIncome = maxTotalDti === Infinity ? 0 : Math.round((totalHousing + monthlyDebts) / maxTotalDti);
    const requiredReserves = Math.round(totalHousing * 2);
    const availableReserves = Math.max(0, reserves - cashToClose);
    const housingDTIPass = maxHousingDti === Infinity || housingDTI <= maxHousingDti;
    const totalDTIPass = maxTotalDti === Infinity || dti <= maxTotalDti;
    const qualifies = (requiredIncome === 0 || qualifyingIncome >= requiredIncome) && housingDTIPass && totalDTIPass && availableReserves >= requiredReserves;

    const estimatedHOIns = calcInsuranceEstimate(purchasePrice, impactWindows, roofAttachment, swr);

    const loanComparison = (["conventional", "fha", "va"] as const).map((lt) => {
      const ltRate = rates[lt] / 100;
      const ltDown = lt === "va" ? 0 : lt === "fha" ? 3.5 : downPaymentPct;
      const ltBaseLoan = purchasePrice * (1 - ltDown / 100);
      const ltUFMIP = lt === "fha" ? Math.round(ltBaseLoan * 0.0175 * 100) / 100 : 0;
      const ltVAFee = lt === "va" ? calcVAFundingFeeAmt(ltBaseLoan, vaDisability, vaLoanUse) : 0;
      const ltLoan = ltBaseLoan + ltUFMIP + ltVAFee;
      const ltPI = calcPI(ltLoan, ltRate);
      const ltPMI = lt === "conventional" ? calcConventionalPMI(ltBaseLoan, purchasePrice, creditScore) : 0;
      const ltMIP = lt === "fha" ? calcFHAMIP(ltLoan) : 0;
      const ltMI = ltPMI + ltMIP;
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
      loanAmount, baseLoanAmount, fhaUFMIP, vaFundingFeeAmt, downPaymentAmt, pi, monthlyTax, monthlyHOIns, monthlyFlood,
      monthlyCDD, mortgageInsurance, pmi, mip, totalHousing,
      closingCosts, cashToClose, housingDTI, dti, maxHousingDti, maxTotalDti, maxDti, requiredIncome, requiredReserves, availableReserves,
      qualifies, estimatedHOIns, loanComparison, recs, ltv,
      rentalIncomeQualifying, qualifyingIncome,
    };
  }, [inputs]);

  // Auto-save / update this estimate on the user's dashboard when they're logged in.
  // Debounced so rapid input changes don't thrash storage. Status is written
  // to the SPECIFIC scenario id (snapshotted at effect start), so even if the
  // user switches tabs mid-debounce the "Saving…"/"Saved" indicator stays
  // pinned to the right scenario.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!address || address === "Unknown Address") return;
    const targetScenarioId = activeScenarioIdRef.current;
    // Mark this scenario as pending-save so the user sees "Saving…"
    // immediately on edit, not only when the debounce fires.
    setScenarios(prev => prev.map(s =>
      s.id === targetScenarioId ? { ...s, saveStatus: "saving" } : s
    ));
    let timerFired = false;
    const handle = setTimeout(() => {
      timerFired = true;
      let didWrite = false;
      try {
        const existing = getPurchaseScenarios();
        const key = address.trim().toLowerCase();
        const idx = existing.findIndex(s => s.address.trim().toLowerCase() === key);
        const next = {
          address,
          price: inputs.purchasePrice,
          monthlyPayment: Math.round(calc.totalHousing),
          cashToClose: Math.round(calc.cashToClose),
          dti: calc.dti,
          qualifies: calc.qualifies,
          downPaymentPct: inputs.downPaymentPct,
          downPaymentMode: inputs.downPaymentMode ?? "percent",
          downPaymentAmount:
            inputs.downPaymentAmount ??
            Math.round(inputs.purchasePrice * (inputs.downPaymentPct / 100)),
          interestRate: inputs.interestRate,
          loanType: inputs.loanType,
        };
        if (idx >= 0) {
          // Only write if something actually changed (avoid noisy storage writes)
          const cur = existing[idx];
          const same = cur.price === next.price
            && cur.monthlyPayment === next.monthlyPayment
            && cur.cashToClose === next.cashToClose
            && cur.dti === next.dti
            && cur.qualifies === next.qualifies
            && cur.downPaymentPct === next.downPaymentPct
            && (cur.downPaymentMode ?? "percent") === next.downPaymentMode
            && cur.downPaymentAmount === next.downPaymentAmount
            && cur.interestRate === next.interestRate
            && cur.loanType === next.loanType
            && cur.address === address;
          if (!same) {
            const updated = [...existing];
            updated[idx] = { ...cur, ...next };
            savePurchaseScenarios(updated);
            didWrite = true;
          }
        } else {
          savePurchaseScenarios([
            ...existing,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              savedAt: new Date().toISOString(),
              ...next,
            },
          ]);
          didWrite = true;
        }
        // On no-op (nothing changed) we still flip the status back to
        // "saved" so a stale "Saving…" never sticks.
        setScenarios(prev => prev.map(s =>
          s.id === targetScenarioId ? { ...s, saveStatus: "saved" } : s
        ));
        // Auto-clear "saved" back to "idle" after a moment so the
        // indicator doesn't permanently camp on the screen.
        const clearHandle = setTimeout(() => {
          setScenarios(prev => prev.map(s =>
            s.id === targetScenarioId && s.saveStatus === "saved"
              ? { ...s, saveStatus: "idle" }
              : s
          ));
        }, 1800);
        // Best-effort cleanup; if the effect re-runs before the timeout
        // fires, the cleanup below clears the outer timer but this inner
        // one is short-lived enough to be harmless.
        void clearHandle;
        void didWrite;
      } catch (err) {
        console.warn("Auto-save to dashboard failed:", err);
        setScenarios(prev => prev.map(s =>
          s.id === targetScenarioId ? { ...s, saveStatus: "error" } : s
        ));
      }
    }, 800);
    // If the effect re-runs (more edits) or unmounts before the 800ms
    // timer fires, the pending write is canceled. Revert the "saving"
    // marker on that scenario back to "idle" so the indicator never
    // sticks (e.g. user switches tabs mid-debounce). Only clear if the
    // status is still "saving"; if a later cycle already finalized it
    // to "saved"/"error", leave that alone.
    return () => {
      clearTimeout(handle);
      if (!timerFired) {
        setScenarios(prev => prev.map(s =>
          s.id === targetScenarioId && s.saveStatus === "saving"
            ? { ...s, saveStatus: "idle" }
            : s
        ));
      }
    };
  }, [
    isAuthenticated, address,
    inputs.purchasePrice, inputs.downPaymentPct, inputs.interestRate, inputs.loanType,
    calc.totalHousing, calc.cashToClose, calc.dti, calc.qualifies,
  ]);

  function fmt(n: number): string {
    return "$" + Math.round(n).toLocaleString();
  }
  function fmtPct(n: number): string {
    return (n * 100).toFixed(1) + "%";
  }

  function Row({ label, value, sub, status, link, onClick }: { label: string; value: string; sub?: string; status?: "green" | "yellow" | "red"; link?: { url: string; label: string }; onClick?: () => void }) {
    const bg = status === "green" ? "bg-green-50" : status === "yellow" ? "bg-yellow-50" : status === "red" ? "bg-red-50" : "";
    const labelColor = status === "green" ? "text-green-800" : status === "yellow" ? "text-yellow-800" : status === "red" ? "text-red-800" : "text-muted-foreground";
    const valueColor = status === "green" ? "text-green-700 font-bold" : status === "yellow" ? "text-yellow-700 font-bold" : status === "red" ? "text-red-700 font-bold" : "font-semibold";
    const subColor = status === "green" ? "text-green-600" : status === "yellow" ? "text-yellow-600" : status === "red" ? "text-red-600" : "text-muted-foreground";
    return (
      <div
        className={`flex justify-between items-center py-2 px-2 rounded-md transition-colors ${bg} ${onClick ? "cursor-pointer hover:bg-primary/5 group" : ""}`}
        onClick={onClick}
      >
        <span className={`text-sm ${labelColor} flex items-center gap-1.5`}>
          {label}
          {onClick && <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />}
          {link && (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary/70 hover:text-primary underline underline-offset-2 font-normal leading-none whitespace-nowrap"
            >
              Look up →
            </a>
          )}
        </span>
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
            {scenarios.map((sc) => (
              <div
                key={sc.id}
                onClick={() => switchScenario(sc.id)}
                draggable
                onDragStart={(e) => {
                  setDraggingScenarioId(sc.id);
                  e.dataTransfer.effectAllowed = "move";
                  // Required for Firefox to actually fire drag events.
                  try { e.dataTransfer.setData("text/plain", sc.id); } catch {}
                }}
                onDragOver={(e) => {
                  if (draggingScenarioId && draggingScenarioId !== sc.id) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = draggingScenarioId || e.dataTransfer.getData("text/plain");
                  if (fromId) moveScenario(fromId, sc.id);
                  setDraggingScenarioId(null);
                }}
                onDragEnd={() => setDraggingScenarioId(null)}
                title="Drag to reorder"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-medium cursor-pointer whitespace-nowrap border border-b-0 transition-colors ${
                  sc.id === activeScenarioId
                    ? "bg-white border-border text-foreground shadow-sm -mb-px relative z-10"
                    : "bg-gray-100 border-transparent text-muted-foreground hover:bg-gray-200"
                } ${draggingScenarioId === sc.id ? "opacity-50" : ""}`}
              >
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{shortLabel(sc.address)}</span>
                {sc.zillowStatus === "loading" && (
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-primary/70 animate-pulse"
                    title="Pulling Zillow data…"
                    aria-label="Pulling Zillow data"
                  />
                )}
                {(sc.zillowStatus === "applied" ||
                  sc.zillowStatus === "loaded_from_zillow") && (
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                    title="Property data updated from Zillow"
                    aria-label="Property data updated from Zillow"
                  />
                )}
                {sc.zillowStatus === "loaded_from_cache" && (
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-emerald-400"
                    title="Property data loaded from saved records"
                    aria-label="Property data loaded from saved records"
                  />
                )}
                {(sc.zillowStatus === "unavailable" || sc.zillowStatus === "error") && (
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-amber-400"
                    title="Property data unavailable"
                    aria-label="Property data unavailable"
                  />
                )}
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
                onClick={() => setLocation(fromDashboard ? "/dashboard" : "/")}
                className="text-muted-foreground hover:text-primary transition-colors"
                title={fromDashboard ? "Back to Dashboard" : "Back"}
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
              {/* "Pull from Zillow" and "Save to Dashboard" have been
                  retired from the normal UI: Zillow now auto-runs after a
                  valid address selection (see triggerZillowLookup), and
                  dashboard saving is automatic for logged-in users via the
                  debounced auto-save effect above. The escape hatches stay
                  available under ?debug=1 for QA. */}
              {debugMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowZillowLookup(true)}
                  data-testid="estimate-open-zillow-lookup"
                  title="Debug: manually open Zillow lookup dialog"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Pull from Zillow (debug)</span>
                </Button>
              )}
              {debugMode && (() => {
                const sessionUser = getSession();
                if (!sessionUser) return null;
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    title="Debug: manually save current scenario"
                    onClick={() => {
                      const existing = getPurchaseScenarios();
                      const alreadySaved = existing.some(
                        s => s.address.trim().toLowerCase() === address.trim().toLowerCase()
                      );
                      if (alreadySaved) {
                        toast({ title: "Already in your dashboard", description: address });
                      } else {
                        savePurchaseScenarios([
                          ...existing,
                          {
                            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            address,
                            savedAt: new Date().toISOString(),
                            price: inputs.purchasePrice,
                            monthlyPayment: Math.round(calc.totalHousing),
                          },
                        ]);
                        toast({ title: "Saved to dashboard", description: address });
                      }
                    }}
                  >
                    <LayoutDashboard className="h-4 w-4" /> Save to Dashboard (debug)
                  </Button>
                );
              })()}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShareDialogOpen(true)}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
              <Button size="sm" className="gap-1.5 bg-secondary hover:bg-secondary/90 text-white" onClick={() => openLeadDialog("save")}>
                <Save className="h-4 w-4" /> Save Scenario
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">

          {/* Step progress bar */}
          <div className="max-w-2xl mx-auto mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">
                {step === 1 ? "Borrower Profile" : step === 2 ? "Additional Info" : step === 3 ? "Purchase Details" : "Your Estimate"}
              </p>
              <p className="text-xs text-muted-foreground font-medium">Page {step} of 4</p>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${s <= step ? "bg-primary" : "bg-border"}`} />
              ))}
            </div>
          </div>

          <div className="max-w-2xl mx-auto space-y-4">

            {/* Per-scenario property-data status banner. Shows loading,
                cache-hit, fresh-zillow, or error feedback for the active
                tab only. Tied to the active scenario's id — switching tabs
                shows the status of the new tab, never the old one. */}
            {(() => {
              const sc = scenarios.find(s => s.id === activeScenarioId);
              const status = sc?.zillowStatus;
              if (!status || status === "applied") return null;
              const cfg =
                status === "loading"
                  ? { msg: "Loading property data from Zillow…", cls: "bg-blue-50 border-blue-200 text-blue-800", pulse: true }
                : status === "loaded_from_cache"
                  ? { msg: "Property data loaded from saved records.", cls: "bg-emerald-50 border-emerald-200 text-emerald-800", pulse: false }
                : status === "loaded_from_zillow"
                  ? { msg: "Property data updated from Zillow.", cls: "bg-emerald-50 border-emerald-200 text-emerald-800", pulse: false }
                : status === "error" || status === "unavailable"
                  ? { msg: "Property data unavailable — using default estimates.", cls: "bg-amber-50 border-amber-200 text-amber-800", pulse: false }
                : null;
              if (!cfg) return null;
              return (
                <div
                  className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md border ${cfg.cls}`}
                  data-testid="banner-property-data-status"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${cfg.pulse ? "bg-current animate-pulse" : "bg-current"}`}
                    aria-hidden="true"
                  />
                  <span>{cfg.msg}</span>
                  {cfg.pulse && (
                    <span className="ml-auto text-[10px] opacity-70">
                      Purchase price is being derived from property data.
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Per-scenario dashboard auto-save indicator. Only renders for
                logged-in users, and only when there's a transient status
                to show on the ACTIVE tab. Driven by `saveStatus` on the
                Scenario object, which the auto-save effect writes per id —
                so a save in progress on tab 2 never shows "Saving…" on
                tab 1. Logged-out users see no indicator (their work stays
                local; the "Save Scenario" button still routes them to
                account creation). */}
            {isAuthenticated && (() => {
              const sc = scenarios.find(s => s.id === activeScenarioId);
              const ss = sc?.saveStatus;
              if (!ss || ss === "idle") return null;
              const cfg =
                ss === "saving"
                  ? { msg: "Saving to your dashboard…", cls: "text-muted-foreground", dot: "bg-blue-400 animate-pulse" }
                : ss === "saved"
                  ? { msg: "Saved to your dashboard", cls: "text-emerald-700", dot: "bg-emerald-500" }
                : { msg: "Unable to save — will retry on next change", cls: "text-amber-700", dot: "bg-amber-500" };
              return (
                <div
                  className={`flex items-center gap-1.5 text-[11px] ${cfg.cls} -mt-2`}
                  data-testid="indicator-dashboard-save-status"
                  role="status"
                  aria-live="polite"
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
                  <span>{cfg.msg}</span>
                </div>
              );
            })()}

            {/* ── STEP 1: Borrower Profile ───
                Rendered either as a normal questionnaire step (step === 1)
                or, when the user clicks the pencil on the summary, inside
                a Dialog overlay (editingPage === 1) without leaving the
                Property Estimate. The Card body is identical in both
                modes; only the wrapper differs. */}
            {(step === 1 || editingPage === 1) && (
              <StepEditWrapper
                editing={editingPage === 1}
                title="Edit Borrower Profile"
                onClose={() => setEditingPage(null)}
              >
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
              </StepEditWrapper>
            )}

            {step === 1 && (
              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} className="gap-2">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* ── STEP 2: Additional Info ─── */}
            {(step === 2 || editingPage === 2) && (
              <StepEditWrapper
                editing={editingPage === 2}
                title="Edit Additional Info"
                onClose={() => setEditingPage(null)}
              >
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

                  {inputs.occupancy === "primary" && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Are you a Veteran?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setInputs((p) => ({
                            ...p,
                            isVeteran: true,
                            loanType: "va",
                            downPaymentPct: 0,
                            vaDisability: null,
                            vaDisabilityRating100: null,
                            vaLoanUse: null,
                            interestRate: fullRate(rates.va, p.creditScore, p.occupancy, 0, "va"),
                            // Clear any prior exemption since the rating-100 answer is being reset
                            annualTaxes: computePropertyTax(address, p.purchasePrice, p.occupancy, null),
                          }))}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.isVeteran === true ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setInputs((p) => ({
                            ...p,
                            isVeteran: false,
                            loanType: "conventional",
                            vaDisability: null,
                            vaDisabilityRating100: null,
                            vaLoanUse: null,
                            interestRate: fullRate(rates.conventional, p.creditScore, p.occupancy, p.downPaymentPct, "conventional"),
                            annualTaxes: computePropertyTax(address, p.purchasePrice, p.occupancy, null),
                          }))}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.isVeteran === false ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                        >
                          No
                        </button>
                      </div>

                      {inputs.isVeteran === true && (
                        <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Do you receive VA disability?</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setInputs((p) => ({
                                  ...p,
                                  vaDisability: true,
                                  vaLoanUse: null,
                                  // vaDisabilityRating100 stays untouched if already answered;
                                  // otherwise the follow-up question will render below.
                                }))}
                                className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.vaDisability === true ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setInputs((p) => ({
                                  ...p,
                                  vaDisability: false,
                                  vaLoanUse: null,
                                  // User no longer receives VA disability → reset the
                                  // rating-100 answer and drop any homestead exemption.
                                  vaDisabilityRating100: null,
                                  annualTaxes: computePropertyTax(address, p.purchasePrice, p.occupancy, null),
                                }))}
                                className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.vaDisability === false ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                              >
                                No
                              </button>
                            </div>
                            {inputs.vaDisability === true && (
                              <p className="text-[11px] text-green-700 mt-1.5 font-medium">No funding fee — loan amount equals the base loan only.</p>
                            )}
                          </div>

                          {/* Follow-up: rating 100%? Only when they've said
                              they receive VA disability. Strictly Yes/No —
                              no "Not sure" option, per product spec, so the
                              homestead-exemption estimate is only applied
                              when the user has explicitly confirmed both
                              100% rating AND primary residence. */}
                          {inputs.vaDisability === true && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                              <p className="text-xs text-muted-foreground mb-2">Is your VA disability rating 100%?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setInputs((p) => ({
                                    ...p,
                                    vaDisabilityRating100: true,
                                    // Apply (or clear) exemption based on current occupancy.
                                    annualTaxes: computePropertyTax(address, p.purchasePrice, p.occupancy, true),
                                  }))}
                                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.vaDisabilityRating100 === true ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                                  data-testid="btn-va-rating-100-yes"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setInputs((p) => ({
                                    ...p,
                                    vaDisabilityRating100: false,
                                    // Drop any exemption — normal estimate applies.
                                    annualTaxes: computePropertyTax(address, p.purchasePrice, p.occupancy, false),
                                  }))}
                                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.vaDisabilityRating100 === false ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                                  data-testid="btn-va-rating-100-no"
                                >
                                  No
                                </button>
                              </div>
                              {inputs.vaDisabilityRating100 === false && (
                                <p className="text-[11px] text-muted-foreground mt-1.5">
                                  VA disability may qualify for a smaller exemption, but this estimate only applies a full property-tax exemption when 100% VA disability and primary residence are selected.
                                </p>
                              )}
                            </div>
                          )}

                          {inputs.vaDisability === false && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                              <p className="text-xs text-muted-foreground mb-2">Is this your first or second time using a VA loan?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setInputs((p) => ({ ...p, vaLoanUse: "first" }))}
                                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.vaLoanUse === "first" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                                >
                                  First use (2.15%)
                                </button>
                                <button
                                  onClick={() => setInputs((p) => ({ ...p, vaLoanUse: "second" }))}
                                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${inputs.vaLoanUse === "second" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"}`}
                                >
                                  Second use (3.30%)
                                </button>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1.5">Funding fee is financed into the loan amount.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              </StepEditWrapper>
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

            {/* ── STEP 3: Purchase Details ─── */}
            {(step === 3 || editingPage === 3) && (
              <StepEditWrapper
                editing={editingPage === 3}
                title="Edit Purchase Details"
                onClose={() => setEditingPage(null)}
              >
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
                      purchasePriceSource: "user",
                      annualTaxes: computePropertyTax(address, v, p.occupancy, p.vaDisabilityRating100),
                    }))}
                    min={50000} max={3000000} step={5000}
                    prefix="$"
                  />
                  {/* Source label — tells the user where the purchase price
                      came from so the default $350k isn't mistaken for a
                      derived value while Zillow/cache is still loading. */}
                  {(() => {
                    const activeScenarioStatus =
                      scenarios.find(s => s.id === activeScenarioId)?.zillowStatus;
                    const loading = activeScenarioStatus === "loading";
                    const src = inputs.purchasePriceSource ?? "default";
                    const label =
                      loading && src === "default"
                        ? "Temporary estimate — waiting for property data…"
                      : src === "user" ? "Source: You entered this value"
                      : src === "zillow_sold" ? "Source: Zillow sold price"
                      : src === "zillow_listing" ? "Source: Zillow listing price"
                      : src === "zillow_zestimate" ? "Source: Zillow Zestimate"
                      : src === "zillow_cache" ? "Source: Saved property data"
                      : "Source: Temporary estimate";
                    const tone =
                      loading && src === "default" ? "text-amber-600"
                      : src === "default" || activeScenarioStatus === "error" ? "text-muted-foreground"
                      : "text-emerald-700";
                    return (
                      <p
                        className={`text-[11px] -mt-3 ${tone}`}
                        data-testid="text-purchase-price-source"
                      >
                        {label}
                      </p>
                    );
                  })()}

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Loan Type</Label>
                    <Select
                      value={inputs.loanType}
                      onValueChange={(v) => setLoanType(v as any)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {/* Conventional requires a 620+ FICO. We keep
                            the row visible but disable it below 620 so
                            the Select always has the currently-selected
                            value (avoids an empty trigger on sub-620
                            secondary, which has no other option). */}
                        <SelectItem value="conventional" disabled={inputs.creditScore < CONVENTIONAL_MIN_FICO}>
                          Conventional{inputs.creditScore < CONVENTIONAL_MIN_FICO ? " (requires 620+ FICO)" : ""}
                        </SelectItem>
                        {inputs.occupancy === "primary" && <SelectItem value="fha">FHA</SelectItem>}
                        {inputs.occupancy === "primary" && <SelectItem value="va">VA</SelectItem>}
                        {inputs.occupancy === "primary" && <SelectItem value="usda">USDA</SelectItem>}
                        {inputs.occupancy === "investment" && <SelectItem value="dscr">DSCR</SelectItem>}
                        {inputs.occupancy === "investment" && <SelectItem value="bank_statement">Bank Statement</SelectItem>}
                      </SelectContent>
                    </Select>
                    {inputs.creditScore < CONVENTIONAL_MIN_FICO && inputs.occupancy !== "primary" && (
                      <p className="text-[11px] mt-1.5 leading-tight text-red-600 font-medium">
                        Conventional is not available below a 620 credit score. {inputs.occupancy === "investment" ? "Consider DSCR or Bank Statement, which don't have the same FICO floor." : "Improve credit to 620+ to qualify for a secondary-home loan."}
                      </p>
                    )}
                    {inputs.creditScore < CONVENTIONAL_MIN_FICO && inputs.occupancy === "primary" && (
                      <p className="text-[11px] mt-1.5 leading-tight text-amber-600 font-medium">
                        Conventional hidden — minimum 620 FICO required.
                      </p>
                    )}
                    {inputs.occupancy !== "primary" ? (
                      <p className="text-[11px] mt-1.5 leading-tight text-muted-foreground">
                        <span className="text-amber-600 font-medium">Only Conventional available for {inputs.occupancy} properties</span>
                      </p>
                    ) : (
                      <ul className="mt-1.5 space-y-0.5 text-[11px] leading-tight text-muted-foreground">
                        <li>Conventional — best if credit score &gt; 720</li>
                        <li>FHA — best if credit score &lt; 720</li>
                        <li>VA — only if you are a Veteran</li>
                        <li>
                          <a
                            href="https://eligibility.sc.egov.usda.gov/eligibility/welcomeAction.do?pageAction=sfp"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-foreground"
                          >USDA</a> — only if the home qualifies with USDA
                        </li>
                      </ul>
                    )}
                  </div>

                  {(() => {
                    const minDown = getMinDown(inputs.loanType, inputs.hasMortgage, inputs.occupancy);
                    const mode: "percent" | "amount" = inputs.downPaymentMode ?? "percent";
                    const dpAmt =
                      inputs.downPaymentAmount ??
                      Math.round(inputs.purchasePrice * (inputs.downPaymentPct / 100));
                    const minAmt = Math.round(inputs.purchasePrice * (minDown / 100));
                    const loanAmt = Math.max(0, inputs.purchasePrice - dpAmt);
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
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            Down Payment
                            <span className="ml-1.5 text-foreground/80 font-medium">
                              {Number(inputs.downPaymentPct).toFixed(2)}% / ${dpAmt.toLocaleString()}
                            </span>
                          </span>
                          <div className="inline-flex rounded-md border border-border overflow-hidden text-[11px]">
                            <button
                              type="button"
                              data-testid="dp-mode-percent"
                              onClick={() => setDownPaymentMode("percent")}
                              className={`px-2 py-0.5 transition-colors ${
                                mode === "percent"
                                  ? "bg-primary text-primary-foreground font-semibold"
                                  : "bg-background text-muted-foreground hover:text-foreground"
                              }`}
                            >Percentage</button>
                            <button
                              type="button"
                              data-testid="dp-mode-amount"
                              onClick={() => setDownPaymentMode("amount")}
                              className={`px-2 py-0.5 transition-colors border-l border-border ${
                                mode === "amount"
                                  ? "bg-primary text-primary-foreground font-semibold"
                                  : "bg-background text-muted-foreground hover:text-foreground"
                              }`}
                            >Dollar Amount</button>
                          </div>
                        </div>
                        {mode === "percent" ? (
                          <SliderInput
                            label=""
                            value={inputs.downPaymentPct}
                            onChange={(v) => setDownPayment(v)}
                            min={minDown} max={50} step={0.5}
                            suffix="%" decimals={1}
                          />
                        ) : (
                          <SliderInput
                            label=""
                            value={dpAmt}
                            onChange={(v) => setDownPaymentDollars(v)}
                            min={minAmt}
                            max={Math.max(minAmt, Math.round(inputs.purchasePrice * 0.5))}
                            step={500}
                            prefix="$"
                          />
                        )}
                        <div className="flex gap-1 flex-wrap pt-0.5">
                          {snapPoints.map(({ pct, label, sub }) => {
                            const isMin = pct === minDown;
                            const isCurrent = inputs.downPaymentPct === pct;
                            const isDisabled = pct < minDown;
                            return (
                              <button
                                key={pct}
                                disabled={isDisabled}
                                onClick={() => setDownPayment(pct)}
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
                        <div className="text-[11px] text-muted-foreground leading-tight pt-0.5">
                          Loan Amount: <span className="text-foreground font-semibold">${loanAmt.toLocaleString()}</span>
                          <span className="ml-1 opacity-70">(calculated: purchase price − down payment)</span>
                        </div>
                      </div>
                    );
                  })()}

                  {renderSellerConcessions()}

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
                    {inputs.occupancy !== "primary" && (() => {
                      const baseConv = (rates as any).conventional ?? FALLBACK_RATES.conventional;
                      const baseWithCredit = adjustedRate(baseConv, inputs.creditScore);
                      const occAdj = occupancyRateAdj(inputs.occupancy, inputs.downPaymentPct);
                      return (
                        <div className="text-[11px] leading-tight space-y-0.5 pt-0.5">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Par rate (Conventional)</span>
                            <span>{baseConv.toFixed(3)}%</span>
                          </div>
                          {creditAdjustment(inputs.creditScore) !== 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>Credit score adj.</span>
                              <span>{creditAdjustment(inputs.creditScore) >= 0 ? "+" : ""}{creditAdjustment(inputs.creditScore).toFixed(3)}%</span>
                            </div>
                          )}
                          <div className="flex justify-between text-amber-600 font-medium">
                            <span>{inputs.occupancy.charAt(0).toUpperCase() + inputs.occupancy.slice(1)} property adj. ({Number(inputs.downPaymentPct).toFixed(1)}% down)</span>
                            <span>+{occAdj.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between font-semibold border-t border-border/40 pt-0.5 text-foreground">
                            <span>Calculated rate</span>
                            <span>{(baseWithCredit + occAdj).toFixed(3)}%</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                </CardContent>
              </Card>
              </StepEditWrapper>
            )}

            {step === 3 && (
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button onClick={() => setStep(4)} className="gap-2">
                  See My Estimate <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* ── STEP 4: Estimate ─── */}
            {step === 4 && (
              <div className="space-y-4">

                {/* Property photo carousel — at the very top of the
                    detail/numbers page per spec. Photos come from the
                    active scenario (loaded from Supabase / property
                    cache, or freshly scraped via triggerZillowLookup).
                    Loading state is gated to the Zillow lookup status
                    so we never show "No photos" while a lookup is in
                    flight. Display is restricted to the Purchase flow
                    only — Refinance and Insurance never render this. */}
                {(() => {
                  const sc = scenarios.find(s => s.id === activeScenarioId);
                  const status: "idle" | "loading" | "loaded" | "error" =
                    sc?.zillowStatus === "loading" ? "loading"
                    : sc?.zillowStatus === "error" || sc?.zillowStatus === "unavailable" ? "error"
                    : sc?.zillowStatus ? "loaded" : "idle";
                  return (
                    <PhotoCarousel
                      photos={sc?.propertyPhotos ?? []}
                      primary={sc?.primaryPhotoUrl}
                      status={status}
                    />
                  );
                })()}

                {/* Collapsed answers accordion */}
                <div className="border border-border rounded-xl overflow-hidden bg-white shadow-sm">
                  <button
                    onClick={() => setAnswersOpen((o) => !o)}
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
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Page 1 — Borrower</p>
                        <SummaryRow label="Property Use" value={inputs.occupancy === "primary" ? "Primary" : inputs.occupancy === "secondary" ? "Secondary" : "Investment"} onEdit={() => setEditingPage(1)} />
                        <SummaryRow label="Credit Score" value={String(inputs.creditScore)} onEdit={() => setEditingPage(1)} />
                        <SummaryRow label="Monthly Income" value={fmt(inputs.monthlyIncome)} onEdit={() => setEditingPage(1)} />
                        <SummaryRow label="Monthly Debts" value={fmt(inputs.monthlyDebts)} onEdit={() => setEditingPage(1)} />
                        <SummaryRow label="Reserves" value={fmt(inputs.reserves)} onEdit={() => setEditingPage(1)} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Page 2 — Additional</p>
                        <SummaryRow label="Has Mortgage?" value={inputs.hasMortgage === true ? "Yes" : inputs.hasMortgage === false ? "No" : "—"} onEdit={() => setEditingPage(2)} />
                        {inputs.hasMortgage === true && <SummaryRow label="Current FHA?" value={inputs.currentLoanFHA === true ? "Yes" : inputs.currentLoanFHA === false ? "No" : "—"} onEdit={() => setEditingPage(2)} />}
                        {inputs.hasRentalIncome === true && <SummaryRow label="Rental Income" value={fmt(inputs.monthlyRentalIncome) + "/mo"} onEdit={() => setEditingPage(2)} />}
                        <SummaryRow label="Veteran?" value={inputs.isVeteran === true ? "Yes" : inputs.isVeteran === false ? "No" : "—"} onEdit={() => setEditingPage(2)} />
                        {inputs.isVeteran === true && <SummaryRow label="VA Disability?" value={inputs.vaDisability === true ? "Yes" : inputs.vaDisability === false ? "No" : "—"} onEdit={() => setEditingPage(2)} />}
                        {inputs.isVeteran === true && inputs.vaDisability === true && <SummaryRow label="VA Rating 100%?" value={inputs.vaDisabilityRating100 === true ? "Yes" : inputs.vaDisabilityRating100 === false ? "No" : "—"} onEdit={() => setEditingPage(2)} />}
                        {inputs.isVeteran === true && inputs.vaDisability === false && <SummaryRow label="VA Loan Use" value={inputs.vaLoanUse === "first" ? "First (2.15%)" : inputs.vaLoanUse === "second" ? "Second (3.30%)" : "—"} onEdit={() => setEditingPage(2)} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Page 3 — Purchase</p>
                        <SummaryRow label="Purchase Price" value={fmt(inputs.purchasePrice)} onEdit={() => setEditingPage(3)} />
                        <SummaryRow label="Loan Type" value={inputs.loanType.toUpperCase()} onEdit={() => setEditingPage(3)} />
                        <SummaryRow label="Down Payment" value={`${Number(inputs.downPaymentPct).toFixed(1)}%`} onEdit={() => setEditingPage(3)} />
                        {inputs.sellerConcessions > 0 && <SummaryRow label="Seller Concessions" value={fmt(inputs.sellerConcessions)} onEdit={() => setEditingPage(3)} />}
                        <SummaryRow label="Interest Rate" value={`${inputs.interestRate.toFixed(3)}%`} onEdit={() => setEditingPage(3)} />
                      </div>
                    </div>
                  )}
                </div>

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
                  {/* Down Payment — interactive Percentage / Dollar Amount
                      toggle + slider, matching the Seller Concessions
                      control style further down this card. Writes the
                      same canonical inputs the rest of the page (and
                      Page 3 / Loan Details) reads from, so every
                      dependent calc (loan amount, P&I, PMI/MIP, cash
                      to close, DTI, qualification) updates live. */}
                  <div className="py-2">
                    {renderDownPayment()}
                  </div>
                  <Separator />
                  <Row label="Loan Amount" value={fmt(calc.loanAmount)} sub={
                    inputs.loanType === "fha" ? `includes 1.75% financing fee (${fmt(calc.fhaUFMIP)}) · LTV ${fmtPct(calc.ltv)}`
                    : inputs.loanType === "va" && calc.vaFundingFeeAmt > 0 ? `includes ${inputs.vaLoanUse === "second" ? "3.30" : "2.15"}% funding fee (${fmt(calc.vaFundingFeeAmt)}) · LTV ${fmtPct(calc.ltv)}`
                    : `LTV ${fmtPct(calc.ltv)}`
                  } />
                  <Separator />
                  <Row label="Estimated Closing Costs (~3%)" value={fmt(calc.closingCosts)} />
                  {/* Seller Concessions — same control as Page 3,
                      writes the same `inputs.sellerConcessions` field
                      so the two pages stay synced automatically. Cash
                      to close updates live via `calc` memo. */}
                  <div className="py-2">
                    {renderSellerConcessions()}
                  </div>
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
                  {/* Title + loan-type selector. Mirrors the Page 3
                      Loan Type Select (around line 3055) — same
                      `inputs.loanType` source of truth, same
                      `setLoanType` setter, same eligibility gating —
                      so switching here re-runs every downstream calc
                      (rate / P&I / MIP / VA funding fee / cash-to-
                      close / DTI / qualification) and stays in sync
                      with Page 3. On mobile the controls stack
                      vertically. */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2 text-primary">
                      <Building2 className="h-4 w-4" />
                      Mortgage
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Loan Type</Label>
                      <Select
                        value={inputs.loanType}
                        onValueChange={(v) => setLoanType(v as any)}
                      >
                        <SelectTrigger className="h-8 w-[160px] text-xs" data-testid="select-page4-loan-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Conventional needs 620+ FICO. Keep the row
                              visible (so the trigger never goes empty)
                              but disable it sub-620. */}
                          <SelectItem
                            value="conventional"
                            disabled={inputs.creditScore < CONVENTIONAL_MIN_FICO}
                          >
                            Conventional{inputs.creditScore < CONVENTIONAL_MIN_FICO ? " (620+ FICO)" : ""}
                          </SelectItem>
                          {/* FHA: primary only. */}
                          {inputs.occupancy === "primary" && (
                            <SelectItem value="fha">FHA</SelectItem>
                          )}
                          {/* VA: primary + veteran only. Kept visible
                              when already selected (even if veteran
                              flag flips) so the trigger never blanks. */}
                          {inputs.occupancy === "primary" && (inputs.isVeteran === true || inputs.loanType === "va") && (
                            <SelectItem value="va">VA</SelectItem>
                          )}
                          {/* USDA: primary only. Page 3 exposes it
                              too; keep parity so a USDA selection
                              made on Page 3 stays selectable here. */}
                          {inputs.occupancy === "primary" && (
                            <SelectItem value="usda">USDA</SelectItem>
                          )}
                          {/* DSCR / Bank Statement: investment only. */}
                          {inputs.occupancy === "investment" && (
                            <SelectItem value="dscr">DSCR</SelectItem>
                          )}
                          {inputs.occupancy === "investment" && (
                            <SelectItem value="bank_statement">Bank Statement</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Row label="Principal & Interest" value={fmt(calc.pi)} sub={`${inputs.interestRate.toFixed(2)}% / 30 yr`} />
                  <Row
                    label="Property Taxes"
                    value={`${fmt(calc.monthlyTax)}/mo`}
                    sub={`${fmt(inputs.annualTaxes)}/yr`}
                    link={address && address !== "Unknown Address" ? getCountyTaxLink(address) ?? undefined : undefined}
                  />
                  {/* Homestead-exemption disclosure. Only shown when the
                      $0 estimate is actually being applied (100% VA
                      disability + primary residence). Final eligibility is
                      county-determined, so we name the property appraiser
                      as the authoritative source. */}
                  {inputs.vaDisabilityRating100 === true && inputs.occupancy === "primary" && (
                    <p
                      className="text-[11px] text-emerald-700 -mt-1 mb-1 px-1"
                      data-testid="note-va-property-tax-exemption"
                    >
                      Estimated property taxes set to $0 because 100% VA disability may qualify for a full homestead property tax exemption. Final eligibility must be confirmed with the county property appraiser.
                    </p>
                  )}
                  {/* Inverse-case disclosure: user answered VA 100% = Yes,
                      but the property isn't primary residence — so no
                      exemption is applied. Rendered HERE (next to the
                      Property Taxes row) rather than inside the veteran
                      section, because the veteran block is gated on
                      occupancy === "primary" and would never render the
                      warning otherwise. */}
                  {inputs.vaDisabilityRating100 === true && inputs.occupancy !== "primary" && (
                    <p
                      className="text-[11px] text-amber-700 -mt-1 mb-1 px-1"
                      data-testid="note-va-exemption-non-primary"
                    >
                      Full property-tax exemption only applies when this property is your primary residence. Currently set to {inputs.occupancy} — normal tax estimate applied.
                    </p>
                  )}
                  <Row
                    label="Homeowners Insurance"
                    value={`${fmt(calc.monthlyHOIns)}/mo`}
                    onClick={() => insuranceSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  />
                  <Row label="Flood Insurance" value={`${fmt(calc.monthlyFlood)}/mo`} />
                  {inputs.hoaMonthly > 0 && <Row label="HOA" value={fmt(inputs.hoaMonthly)} />}
                  {inputs.cddAnnual > 0 && <Row label="CDD" value={`${fmt(calc.monthlyCDD)}/mo`} />}
                  {calc.mortgageInsurance > 0 && (
                    <Row
                      label={inputs.loanType === "fha" ? "FHA MIP" : "PMI"}
                      value={fmt(calc.mortgageInsurance)}
                    />
                  )}
                  <Separator />
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-semibold">Total Monthly Payment</span>
                    <span className="text-base font-bold text-primary">{fmt(calc.totalHousing)}</span>
                  </div>

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
                    sub={
                      calc.maxHousingDti === Infinity
                        ? "No limit (VA) · New mortgage ÷ qualifying income"
                        : `Max ${fmtPct(calc.maxHousingDti)} · New mortgage ÷ qualifying income`
                    }
                    status={
                      calc.maxHousingDti === Infinity ? "green"
                      : calc.housingDTI <= calc.maxHousingDti * 0.85 ? "green"
                      : calc.housingDTI <= calc.maxHousingDti ? "yellow"
                      : "red"
                    }
                  />
                  <Row
                    label="Total DTI"
                    value={fmtPct(calc.dti)}
                    sub={
                      calc.maxTotalDti === Infinity
                        ? "No limit (VA) · New mortgage + debts ÷ qualifying income"
                        : calc.dti > calc.maxTotalDti
                        ? `Exceeds max ${fmtPct(calc.maxTotalDti)} — needs review`
                        : `Max ${fmtPct(calc.maxTotalDti)} · New mortgage + debts ÷ qualifying income`
                    }
                    status={
                      calc.maxTotalDti === Infinity ? "green"
                      : calc.dti < calc.maxTotalDti * 0.85 ? "green"
                      : calc.dti <= calc.maxTotalDti ? "yellow"
                      : "red"
                    }
                  />
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
                  <Row label="Down Payment" value={`${fmt(calc.downPaymentAmt)} (${Number(inputs.downPaymentPct).toFixed(1)}%)`} />
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

              {/* ── Full Insurance Panel ── */}
              <div ref={insuranceSectionRef} className="scroll-mt-6">
                <Card className="border-2 border-primary/20 shadow-md">
                  <CardHeader className="pb-3 bg-primary/5 rounded-t-lg">
                    <CardTitle className="text-base flex items-center gap-2 text-primary">
                      <Shield className="h-4 w-4" />
                      Homeowners Insurance Estimate
                      <Badge className="ml-auto bg-primary/10 text-primary border-primary/30 font-mono text-sm">
                        {fmt(insPremiumCalc.mid)}/yr midpoint
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Midpoint premium feeds into your monthly payment above. Adjust factors below to refine the estimate.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-4">

                    {/* Premium hero */}
                    <div className="bg-primary rounded-xl p-4 text-white mb-5">
                      <div className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-1">Estimated Annual Premium — {INS_REGIONS[insRegionKey].name}</div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="bg-white/10 rounded-lg p-3 border border-white/10">
                          <div className="text-[9px] font-medium text-white/50 uppercase tracking-wide mb-1">Low</div>
                          <div className="text-sm font-bold font-mono">{fmt(insPremiumCalc.low)}</div>
                          <div className="text-[9px] text-white/40 mt-0.5">{(insPremiumCalc.low / inputs.purchasePrice * 100).toFixed(2)}% of price</div>
                        </div>
                        <div className="bg-white/20 rounded-lg p-3 border border-white/30 ring-1 ring-white/30">
                          <div className="text-[9px] font-medium text-white/70 uppercase tracking-wide mb-1">Midpoint</div>
                          <div className="text-base font-bold font-mono text-yellow-300">{fmt(insPremiumCalc.mid)}</div>
                          <div className="text-[9px] text-yellow-300/70 mt-0.5">{(insPremiumCalc.mid / inputs.purchasePrice * 100).toFixed(2)}% of price</div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3 border border-white/10">
                          <div className="text-[9px] font-medium text-white/50 uppercase tracking-wide mb-1">High</div>
                          <div className="text-sm font-bold font-mono">{fmt(insPremiumCalc.high)}</div>
                          <div className="text-[9px] text-white/40 mt-0.5">{(insPremiumCalc.high / inputs.purchasePrice * 100).toFixed(2)}% of price</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-white/10 rounded-lg p-2.5 border border-white/10">
                          <div className="text-[9px] text-white/50 uppercase tracking-wide">Monthly (midpoint)</div>
                          <div className="text-sm font-bold font-mono">{fmt(insPremiumCalc.monthly)}/mo</div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-2.5 border border-white/10">
                          <div className="text-[9px] text-white/50 uppercase tracking-wide">Hurricane Deductible ({insPremiumCalc.hurrPct}%)</div>
                          <div className="text-sm font-bold font-mono">{fmt(insPremiumCalc.hurrDeductible)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                      {/* Region */}
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Region / Risk Tier</label>
                        <select
                          value={insRegionKey}
                          onChange={e => setInsRegionKey(e.target.value as InsRegionKey)}
                          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {(Object.entries(INS_REGIONS) as [InsRegionKey, typeof INS_REGIONS[InsRegionKey]][]).map(([key, r]) => (
                            <option key={key} value={key}>{r.name} — {r.counties}</option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground leading-relaxed pt-1">{INS_REGIONS[insRegionKey].note}</p>
                      </div>

                      {/* Roof Age */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Roof Age</label>
                        <select value={insRoofIdx} onChange={e => setInsRoofIdx(Number(e.target.value))} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
                          <option value={0}>Under 5 years</option>
                          <option value={1}>5–14 years — standard</option>
                          <option value={2}>15–20 years</option>
                          <option value={3}>20+ years</option>
                        </select>
                      </div>

                      {/* Wind Mitigation */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Wind Mitigation</label>
                        <select value={insWindIdx} onChange={e => setInsWindIdx(Number(e.target.value))} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
                          <option value={0}>No inspection / no features</option>
                          <option value={1}>Basic inspection — standard</option>
                          <option value={2}>Full mitigation: hip roof, shutters, SWR</option>
                        </select>
                      </div>

                      {/* Hurricane Deductible */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Hurricane Deductible</label>
                        <select value={insHurrIdx} onChange={e => setInsHurrIdx(Number(e.target.value))} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
                          <option value={0}>2% of dwelling — standard</option>
                          <option value={1}>3% of dwelling</option>
                          <option value={2}>5% of dwelling</option>
                        </select>
                      </div>

                      {/* Construction */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Construction Type</label>
                        <select value={insConstIdx} onChange={e => setInsConstIdx(Number(e.target.value))} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
                          <option value={0}>Concrete block / CBS — preferred</option>
                          <option value={1}>Mixed / unknown — standard</option>
                          <option value={2}>Frame construction</option>
                        </select>
                      </div>

                      {/* Year Built */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Year Built</label>
                        <select value={insYearIdx} onChange={e => setInsYearIdx(Number(e.target.value))} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
                          <option value={0}>2002 or newer — Florida Building Code</option>
                          <option value={1}>1990–2001 — standard</option>
                          <option value={2}>1970–1989</option>
                          <option value={3}>Pre-1970</option>
                        </select>
                      </div>

                      {/* Claims */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Claims History (5 yrs)</label>
                        <select value={insClaimsIdx} onChange={e => setInsClaimsIdx(Number(e.target.value))} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
                          <option value={0}>No claims — clean history</option>
                          <option value={1}>1 claim filed</option>
                          <option value={2}>2 claims filed</option>
                          <option value={3}>3+ claims</option>
                        </select>
                      </div>

                    </div>

                    {/* Flood warning */}
                    <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-900 leading-relaxed">
                        <strong>Flood insurance not included.</strong> Properties in AE/VE flood zones require a separate NFIP or private policy — typically $800–$3,500+/year. Check FEMA's flood map for this address.
                      </p>
                    </div>

                    {/* Region insight */}
                    <div className="flex gap-2.5 bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-900 leading-relaxed">
                        <strong>Risk tier: {INS_REGIONS[insRegionKey].tier}.</strong> {INS_REGIONS[insRegionKey].note}
                      </p>
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                      Estimates sourced from FL OIR CHOICES filings, 2026. For planning only — not a binding quote.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <p className="text-xs text-muted-foreground text-center px-4 pb-4">
                All estimates are for informational purposes only and are not a commitment to lend. Actual rates, payments, and qualification requirements may vary. Contact a licensed mortgage professional for a full analysis.
              </p>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Share dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" /> Share Estimate
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Share this estimate by email or download a PDF summary.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={() => {
                const subject = encodeURIComponent(`Home Cost Estimate — ${address}`);
                const body = encodeURIComponent(
                  `Hi,\n\nHere is your Home Cost & Qualification Estimate from Tateo & Co for:\n${address}\n\n` +
                  `Monthly Payment: ${fmt(calc.totalHousing)}\n` +
                  `Cash to Close: ${fmt(calc.cashToClose)}\n` +
                  `Total DTI: ${fmtPct(calc.dti)}\n` +
                  `Qualification: ${calc.qualifies ? "Likely Qualifies" : "Needs Review"}\n\n` +
                  `View full estimate: ${window.location.href}\n\n` +
                  `— Tateo & Co\nadmin@tateoco.com | (813) 214-8356`
                );
                window.location.href = `mailto:?subject=${subject}&body=${body}`;
                setShareDialogOpen(false);
              }}
            >
              <Mail className="h-4 w-4" /> Send via Email
            </Button>
            <Button
              className="w-full gap-2"
              onClick={() => {
                generateEstimatePDF();
                setShareDialogOpen(false);
              }}
            >
              <FileDown className="h-4 w-4" /> Download PDF Summary
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LeadCaptureDialog
        open={leadDialogOpen}
        onOpenChange={(open) => { setLeadDialogOpen(open); if (!open) setLeadDialogForScenario(false); }}
        action={leadDialogForScenario ? "new-scenario" : leadDialogAction}
        address={address}
        scenarioDetails={leadScenarioDetails}
        onSuccess={handleLeadSuccess}
      />

      {/* New scenario address prompt */}
      <PropertyLookupDialog
        open={showZillowLookup}
        onOpenChange={setShowZillowLookup}
        initialAddressOrUrl={address && address !== "Unknown Address" ? address : ""}
        applyLabel="Use these values"
        onApply={handleZillowApply}
      />

      <Dialog open={showAddressPrompt} onOpenChange={setShowAddressPrompt}>
        <DialogContent
          className="sm:max-w-sm"
          aria-describedby="add-property-desc"
          // Google Places Autocomplete renders its dropdown (.pac-container)
          // directly inside <body>, which Radix sees as "outside" the dialog.
          // Without this guard, clicking a suggestion closes the dialog
          // BEFORE `place_changed` fires — and the address is lost.
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest(".pac-container")) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest(".pac-container")) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add New Property</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p id="add-property-desc" className="text-sm text-muted-foreground">
              Start typing an address and pick a suggestion — your new property tab is added automatically.
            </p>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={newScenarioInputRef}
                type="text"
                value={newScenarioAddress}
                onChange={(e) => setNewScenarioAddress(e.target.value)}
                onKeyDown={(e) => {
                  // If the suggestions dropdown is visible, always let Google
                  // consume Enter (it fires place_changed → auto-add).
                  if (e.key !== "Enter") return;
                  const pac = document.querySelector(".pac-container") as HTMLElement | null;
                  const pacOpen = pac && pac.offsetParent !== null && pac.children.length > 0;
                  if (pacOpen) e.preventDefault();
                }}
                placeholder="123 Main St, City, State…"
                autoComplete="off"
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md outline-none focus:ring-2 ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
