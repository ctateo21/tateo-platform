import { useMemo, useState, useRef, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import ScenarioActions from "@/components/scenario-actions";
import {
  getInsuranceScenarios, saveInsuranceScenarios, type InsuranceScenario,
  getPurchaseScenarios, getCashBuyScenarios, getTrackedLoans,
} from "@/lib/auth";
import { notifyNewScenario } from "@/lib/notify-scenario";
import { authedFetch } from "@/lib/authed-fetch";
import {
  getQRCache,
  setQRCache,
  clearQRCache,
  type QRCacheEntry,
} from "@/lib/quoterush-auto";
import {
  DEFAULT_HOMEOWNERS_INSURANCE_PERCENT,
  getInsuranceCoverageMultiplier,
} from "@/lib/insurance-default";
import {
  getDefaultInsurancePolicyType,
  resolveInsurancePropertyTypeForAddress,
  INSURANCE_POLICY_TYPE_LABELS,
  type InsurancePolicyType,
} from "@/lib/insurance-policy-type";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Shield, MapPin, Home, AlertTriangle, Info,
  TrendingDown, TrendingUp, Minus, Share2, Save, Plus, X, Pencil,
} from "lucide-react";
import { getCountyName } from "@/lib/county-tax-estimator";
import { normalizePropertyKey } from "@/lib/property-key";
import { fetchFloodZone } from "@/lib/flood-zone";
import { loadGoogleMapsApi } from "@/lib/script-loader";
import LeadCaptureDialog from "@/components/ui/lead-capture-dialog";
import { posthog } from "@/lib/posthog";
import { useToast } from "@/hooks/use-toast";

// ─── Data ─────────────────────────────────────────────────────────────────────

type RegionKey = "keys" | "sefl" | "swfl" | "tampa" | "nefljax" | "central" | "ncfl";

interface Region {
  name: string; counties: string; low: number; high: number;
  tier: string; tierColor: string; note: string;
}

const REGIONS: Record<RegionKey, Region> = {
  keys:    { name: "Keys / Barrier Islands",    counties: "Monroe, barrier islands",                low: 0.0495, high: 0.0665, tier: "Extreme",  tierColor: "bg-red-100 text-red-800",      note: "Extreme hurricane surge risk, very limited reinsurance appetite, and a small pool of insurable units produce premiums unlike anywhere else in the state. Most major carriers have exited this market." },
  sefl:    { name: "SE FL Coastal",             counties: "Miami-Dade, Broward, Palm Beach",        low: 0.0233, high: 0.0407, tier: "High",     tierColor: "bg-orange-100 text-orange-800", note: "Hurricane exposure, high rebuild costs, and older housing stock define this market. Miami-Dade, Broward, and Palm Beach are among the most expensive mainland ZIP codes in the U.S." },
  swfl:    { name: "SW FL Coastal",             counties: "Lee, Collier, Charlotte",                low: 0.0134, high: 0.0207, tier: "High",     tierColor: "bg-orange-100 text-orange-800", note: "Post-Hurricane Ian reinsurance pricing continues to elevate rates across Lee, Collier, and Charlotte counties. Barrier island properties run significantly higher than the county average." },
  tampa:   { name: "Tampa Bay Area",            counties: "Hillsborough, Pinellas, Pasco",          low: 0.0110, high: 0.0170, tier: "Mod-High", tierColor: "bg-yellow-100 text-yellow-800",  note: "Growing storm risk recognition, high population density, and significant flood zone coverage in low-lying areas push rates above Central Florida. Pinellas peninsula properties carry the highest exposure within this region." },
  nefljax: { name: "NE FL / Jacksonville",      counties: "Duval, Clay, St. Johns, Flagler",        low: 0.0080, high: 0.0127, tier: "Moderate", tierColor: "bg-blue-100 text-blue-800",     note: "Moderate coastal exposure with better carrier availability than South Florida. St. Johns County waterfront properties trend toward the upper end; inland Duval and Clay closer to the lower bound." },
  central: { name: "Central FL Inland",         counties: "Orange, Osceola, Polk, Seminole",        low: 0.0078, high: 0.0122, tier: "Moderate", tierColor: "bg-blue-100 text-blue-800",     note: "Shielded from direct coastal wind, though sinkhole risk in parts of Polk adds cost. Good carrier availability and the lowest hurricane deductibles of any Florida coastal-adjacent region." },
  ncfl:    { name: "North-Central FL Inland",   counties: "Alachua, Marion, Sumter, Lake, Columbia", low: 0.0054, high: 0.0080, tier: "Low",     tierColor: "bg-green-100 text-green-800",   note: "Consistently the lowest rates in Florida. These counties sit 60+ miles from the coast, dramatically limiting hurricane exposure. Strong carrier competition keeps premiums in check." },
};

const ROOF_ADJ  = [0.90, 1.00, 1.20, 1.38];
const WIND_ADJ  = [1.14, 1.00, 0.82];
const HURR_ADJ  = [1.10, 1.05, 1.00];
const CONST_ADJ = [0.93, 1.00, 1.08];
const YEAR_ADJ  = [0.90, 1.00, 1.10, 1.28];
const CLAIM_ADJ = [1.00, 1.14, 1.26, 1.40];

const COUNTY_TO_REGION: Record<string, RegionKey> = {
  "monroe": "keys",
  "miami-dade": "sefl", "broward": "sefl", "palm beach": "sefl",
  "lee": "swfl", "collier": "swfl", "charlotte": "swfl", "manatee": "swfl", "sarasota": "swfl",
  "hillsborough": "tampa", "pinellas": "tampa", "pasco": "tampa", "hernando": "tampa",
  "duval": "nefljax", "clay": "nefljax", "st. johns": "nefljax", "st johns": "nefljax", "flagler": "nefljax", "nassau": "nefljax",
  "okaloosa": "nefljax", "santa rosa": "nefljax", "escambia": "nefljax",
  "orange": "central", "osceola": "central", "polk": "central", "seminole": "central", "lake": "central", "volusia": "central",
  "brevard": "central", "indian river": "central",
  "st. lucie": "sefl", "martin": "sefl",
  "alachua": "ncfl", "marion": "ncfl", "sumter": "ncfl", "columbia": "ncfl", "putnam": "ncfl",
  "leon": "ncfl", "gadsden": "ncfl", "wakulla": "ncfl",
};

function getRegionFromAddress(address: string): RegionKey {
  const county = getCountyName(address);
  if (county && COUNTY_TO_REGION[county]) return COUNTY_TO_REGION[county];
  return "tampa";
}

// Product of every factor table at its default index — used to normalize
// the raw factor product so a property with default factors yields
// exactly `0.75% × rebuild` (matches the shared estimate everywhere).
const NEUTRAL_FACTOR_PRODUCT =
  ROOF_ADJ[1] * WIND_ADJ[1] * HURR_ADJ[0] * CONST_ADJ[0] * YEAR_ADJ[1] * CLAIM_ADJ[0];

// Look up the best-known property value for an address across the
// other scenario tabs (Purchase with Loan, Cash Buy, Refinance) and
// any existing Insurance scenario for that same address. Returns 0
// if nothing is known so callers can fall back to URL ?price=.
// Match two addresses by normalized property key (so differently
// formatted strings for the SAME property correlate), falling back to
// exact trimmed/lowercased equality when either address can't be parsed.
// Never collapses onto an empty key.
function isSamePropertyAddress(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  const ka = normalizePropertyKey(a).key;
  const kb = normalizePropertyKey(b).key;
  if (ka && kb) return ka === kb;
  const sa = (a ?? "").trim().toLowerCase();
  const sb = (b ?? "").trim().toLowerCase();
  return !!sa && sa === sb;
}

function getKnownPropertyValueForAddress(address: string): number {
  if (!address) return 0;
  if (!address.trim()) return 0;

  const purchase = getPurchaseScenarios().find(
    p => isSamePropertyAddress(p.address, address)
  );
  if (purchase?.price && purchase.price > 0) return purchase.price;

  const cash = getCashBuyScenarios().find(
    c => isSamePropertyAddress(c.address, address)
  );
  if (cash?.purchasePrice && cash.purchasePrice > 0) return cash.purchasePrice;

  const loan = getTrackedLoans().find(
    l => isSamePropertyAddress(l.propertyAddress, address)
  );
  if (loan?.estimatedHomeValue && loan.estimatedHomeValue > 0) return loan.estimatedHomeValue;

  const ins = getInsuranceScenarios().find(
    s => isSamePropertyAddress(s.address, address)
  );
  if (ins?.annualPremium && ins.annualPremium > 0) {
    // annualPremium ≈ coverageA × 0.75% = (propertyValue × multiplier) × 0.75%.
    // Divide the multiplier back out so this returns the FULL property value,
    // consistent with the Purchase/Cash/Loan branches above. Callers
    // (defaultRebuildFor) then re-apply the multiplier exactly once — without
    // this an HO6 premium-only row would be halved twice (→ 25%).
    const { policyType } = resolvePolicyTypeForAddress(address);
    const multiplier = (policyType ? getInsuranceCoverageMultiplier(policyType) : 1) || 1;
    return Math.round(ins.annualPremium / (DEFAULT_HOMEOWNERS_INSURANCE_PERCENT * multiplier));
  }

  return 0;
}

// Resolve the policy type (HO3 / HO6 / DP3) for an address from saved
// insurance state, then a matching Purchase / Cash / Loan scenario, then
// the shared default rule. Module-level so both the Rebuild Cost seeding
// (`defaultRebuildFor`) and the component can share one implementation.
function resolvePolicyTypeForAddress(addr: string): {
  policyType: InsurancePolicyType | "";
  source: "default_rule" | "manual" | null;
} {
  if (!addr || !addr.trim()) return { policyType: "", source: null };
  const ins = getInsuranceScenarios().find(
    s => isSamePropertyAddress(s.address, addr)
  );
  // A manual policy-type pick always wins — never recompute or override.
  if (ins?.policyType && ins.policyTypeSource === "manual") {
    return { policyType: ins.policyType, source: "manual" };
  }
  // Gather matching source scenarios for the SAME normalized property key
  // (address fallback). Their `propertyType` carries the Zillow /
  // property_cache physical type (Purchase/Cash/Refi were seeded from
  // `/api/zillow-property-lookup`). Refinance physical type lives on
  // `physicalPropertyType` (its `propertyType` is occupancy).
  const purchase = getPurchaseScenarios().find(
    p => isSamePropertyAddress(p.address, addr)
  );
  const cash = getCashBuyScenarios().find(
    c => isSamePropertyAddress(c.address, addr)
  );
  const loan = getTrackedLoans().find(
    l => isSamePropertyAddress(l.propertyAddress, addr)
  );
  const occupancy =
    cash?.occupancyType ?? (loan?.propertyType as any) ?? ins?.occupancyType ?? (purchase ? "primary" : undefined);
  const resolved = resolveInsurancePropertyTypeForAddress({
    insurancePropertyType: ins?.propertyType,
    insurancePropertyTypeSource: ins?.propertyTypeSource,
    sourcePropertyTypes: [purchase?.propertyType, cash?.propertyType, loan?.physicalPropertyType],
  });
  const def = getDefaultInsurancePolicyType({
    occupancyType: occupancy,
    propertyType: resolved.propertyType,
  });
  // Condo / townhome forces HO6 over any stale, non-manual persisted
  // value (spec example 5). Otherwise keep the persisted policy type if
  // present, else use the freshly computed default.
  if (def === "HO6") return { policyType: "HO6", source: "default_rule" };
  if (ins?.policyType) {
    return { policyType: ins.policyType, source: ins.policyTypeSource ?? "default_rule" };
  }
  return { policyType: def ?? "", source: def ? "default_rule" : null };
}

function defaultRebuildFor(address: string, priceParam: string | null): number {
  const fromScenarios = getKnownPropertyValueForAddress(address);
  const fromParam = priceParam ? parseInt(priceParam, 10) : 0;
  const baseValue = fromScenarios > 0 ? fromScenarios : (fromParam > 0 ? fromParam : 0);
  if (baseValue <= 0) return 0;
  // Seed Rebuild Cost / Coverage A using the policy-type multiplier so an
  // HO6 (condo/townhome) property defaults to 50% of the property value
  // pulled from Zillow, while HO3 / DP3 / unknown stay at the full value.
  // Spec: insurance-ho6-half-coverage-and-premium.
  const { policyType } = resolvePolicyTypeForAddress(address);
  const multiplier = policyType ? getInsuranceCoverageMultiplier(policyType) : 1;
  return Math.round(baseValue * multiplier);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface InsuranceSettings {
  regionKey: RegionKey; rebuild: number;
  roofIdx: number; windIdx: number; hurrIdx: number;
  constIdx: number; yearIdx: number; claimsIdx: number;
}

interface Scenario {
  id: string; address: string; savedSettings: InsuranceSettings | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return "$" + Math.round(n).toLocaleString(); }

function shortLabel(addr: string) {
  const parts = addr.split(",")[0].trim().split(" ");
  return parts.slice(0, 3).join(" ");
}

// All-Other-Perils (AOP) deductible — the standard Florida HO deductible
// for non-hurricane claims. Default $2,500 (matches typical FL carrier
// minimums). Carrier defaults to a "TBD" placeholder until a real quote
// carrier is selected. Both values + the FEMA-resolved flood zone are
// persisted inside the `insurance_scenarios.user_answer_sources` jsonb
// column (no new DB column needed).
const DEFAULT_AOP_DEDUCTIBLE = 2500;
const DEFAULT_CARRIER = "TBD";

// ─── Sub-components ───────────────────────────────────────────────────────────

function SliderRow({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  function startEdit() { setRaw(String(value)); setEditing(true); }
  function commitEdit() {
    const parsed = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
    setEditing(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        {editing ? (
          <input
            autoFocus type="text" value={raw}
            onChange={e => setRaw(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
            className="w-32 text-right text-sm font-bold text-primary font-mono border border-primary rounded px-2 py-0.5 focus:outline-none"
          />
        ) : (
          <button
            onClick={startEdit}
            title="Click to edit"
            className="text-sm font-bold text-primary font-mono border border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary rounded-md px-2.5 py-0.5 cursor-text transition-colors"
          >
            ${value.toLocaleString()}
          </button>
        )}
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 accent-primary cursor-pointer"
      />
    </div>
  );
}

function SelectRow({ label, value, onChange, options }: {
  label: string; value: number; onChange: (v: number) => void;
  options: { value: number; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">{label}</label>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InsuranceDashboard() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const addressParam = params.get("address") || "";
  const priceParam = params.get("price");
  // Default Coverage A / Rebuild Cost from (in order): a MANUAL
  // InsuranceScenario.coverageA override (preserves a user-typed value
  // across logout/login), then the policy-type-aware default derived
  // from the saved Purchase / Cash Buy / Refinance scenario value,
  // ?price= URL param, or existing Insurance scenario premium ÷ 0.75%.
  // Auto-seeded ("default" source) coverageA is intentionally NOT used
  // here — it is recomputed via `defaultRebuildFor` so the policy-type
  // multiplier (HO6 → 50%) is always applied, even to values seeded
  // before the multiplier existed. This is idempotent for already-correct
  // values (base × multiplier === stored value).
  function initialRebuildFor(addr: string, price: string | null): number {
    const key = (addr ?? "").trim().toLowerCase();
    if (key) {
      const ins = getInsuranceScenarios().find(
        s => (s.address ?? "").trim().toLowerCase() === key
      );
      if (ins && ins.coverageASource === "manual"
          && typeof ins.coverageA === "number" && ins.coverageA > 0) {
        return ins.coverageA;
      }
    }
    return defaultRebuildFor(addr, price);
  }
  const initialRebuild = initialRebuildFor(addressParam, priceParam);

  const { toast } = useToast();

  // ── Scenario state ───────────────────────────────────────────────────────
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: "sc0", address: addressParam, savedSettings: null },
  ]);
  const [activeScenarioId, setActiveScenarioId] = useState("sc0");
  const [showAddressPrompt, setShowAddressPrompt] = useState(false);
  const [newScenarioAddress, setNewScenarioAddress] = useState("");
  const newScenarioInputRef = useRef<HTMLInputElement>(null);

  // Keep active scenario address in sync with URL
  useEffect(() => {
    setScenarios(prev =>
      prev.map(s => s.id === activeScenarioId ? { ...s, address: addressParam } : s)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressParam]);

  // ── Settings state ───────────────────────────────────────────────────────
  const [regionKey, setRegionKey] = useState<RegionKey>(getRegionFromAddress(addressParam));
  const [rebuild, setRebuild] = useState(initialRebuild);

  // ── Manual Annual Premium override ───────────────────────────────────────
  // When the user types a dollar amount into the editable Annual Premium
  // input, we persist that value and stamp `premiumSource = "manual"` on
  // save. The cross-tab property-value sync helper then skips the premium
  // (see `isInsurancePremiumOverridable` in lib/property-value-sync.ts) so
  // a Refinance / Purchase / Cash / Seller value change can update
  // Coverage A without overwriting the user's manual premium.
  //
  // `null` means "not manual — show the calculated midpoint". A saved
  // InsuranceScenario with `premiumSource === "manual"` hydrates the
  // input on mount / address change.
  function resolveManualPremiumFor(addr: string): number | null {
    const key = (addr ?? "").trim().toLowerCase();
    if (!key) return null;
    const ins = getInsuranceScenarios().find(
      s => (s.address ?? "").trim().toLowerCase() === key
    );
    if (ins?.premiumSource === "manual" && typeof ins.annualPremium === "number"
        && Number.isFinite(ins.annualPremium) && ins.annualPremium > 0) {
      return ins.annualPremium;
    }
    return null;
  }
  const [manualAnnualPremium, setManualAnnualPremium] = useState<number | null>(
    resolveManualPremiumFor(addressParam)
  );
  // Editable input value (kept as a string so partial entry like "5" → "50"
  // → "500" doesn't reset the cursor or coerce to 0 mid-typing).
  const [manualPremiumInput, setManualPremiumInput] = useState<string>(
    () => {
      const v = resolveManualPremiumFor(addressParam);
      return v == null ? "" : String(Math.round(v));
    }
  );
  // Re-hydrate from saved state when the address switches.
  useEffect(() => {
    const v = resolveManualPremiumFor(addressParam);
    setManualAnnualPremium(v);
    setManualPremiumInput(v == null ? "" : String(Math.round(v)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressParam]);

  // ── Policy type (HO3 / HO6 / DP3) ────────────────────────────────────────
  // Defaulted from occupancy + propertyType using the shared rule helper.
  // Hydrates from a saved InsuranceScenario when present (so a manual
  // override survives logout/login). When the user picks a value from
  // the Select, we mark policyTypeSource = "manual" and persist on save.
  // (Resolution logic lives in the module-level `resolvePolicyTypeForAddress`
  // so Rebuild Cost seeding and this component stay in lockstep.)
  const initialPolicy = resolvePolicyTypeForAddress(addressParam);
  const [policyType, setPolicyType] = useState<InsurancePolicyType | "">(initialPolicy.policyType);
  const [policyTypeSource, setPolicyTypeSource] = useState<"default_rule" | "manual" | null>(
    initialPolicy.source
  );
  // Re-hydrate from the new address's own saved/default state whenever
  // the address changes. We do NOT carry over a previous address's
  // manual override — that would leak Property A's manual HO6 onto
  // Property B. `resolvePolicyTypeForAddress` reads the saved
  // InsuranceScenario for this address (preserving manual overrides
  // saved to Supabase) before falling back to the rule helper.
  useEffect(() => {
    const next = resolvePolicyTypeForAddress(addressParam);
    setPolicyType(next.policyType);
    setPolicyTypeSource(next.source);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressParam]);

  // ── Policy-type → Coverage A recompute (spec: insurance-ho6-half-coverage-and-premium) ──
  // When the user (or an upstream rule) changes policy type, recompute
  // Coverage A / Rebuild Cost using the policy-type multiplier:
  //   HO6 → propertyValue × 0.50,  HO3 / DP3 → propertyValue × 1.00.
  // Premium recomputes automatically because the autosave below derives
  // premium from `rebuild` (premium = rebuild × 0.75% × adj). Manual
  // Coverage A is protected (`coverageASource === "manual"`); manual /
  // quoted premium is already protected by the autosave's
  // `manualAnnualPremium != null` branch and `match.premiumSource ===
  // "quote"` carry-forward.
  //
  // We only act on transitions of `policyType` for the SAME address —
  // an address switch also reseeds policyType, but the address-change
  // useEffect above already reset Coverage A via `defaultRebuildFor`,
  // so we must not double-transform here. A ref keyed on address +
  // last-seen policy guards this.
  const prevPolicyContextRef = useRef<{ address: string; policy: InsurancePolicyType | "" }>({
    address: addressParam,
    policy: policyType,
  });
  useEffect(() => {
    const prev = prevPolicyContextRef.current;
    // Address changed → the address-switch effects own Coverage A. Just
    // record the new context and skip.
    if (prev.address !== addressParam) {
      prevPolicyContextRef.current = { address: addressParam, policy: policyType };
      return;
    }
    if (prev.policy === policyType) return;
    prevPolicyContextRef.current = { address: addressParam, policy: policyType };
    if (!prev.policy || !policyType) return; // ignore initial empty → resolved hydration
    const prevMult = getInsuranceCoverageMultiplier(prev.policy);
    const newMult = getInsuranceCoverageMultiplier(policyType);
    if (prevMult === newMult || prevMult <= 0) return;

    // Manual Coverage A lock — read the persisted source from the
    // saved insurance scenario for this address.
    const key = (addressParam ?? "").trim().toLowerCase();
    const ins = key
      ? getInsuranceScenarios().find(s => (s.address ?? "").trim().toLowerCase() === key)
      : undefined;
    if (ins?.coverageASource === "manual") {
      return;
    }
    if (manualAnnualPremium != null) {
      // Coverage A still recomputes — manual-premium protection is
      // separate from coverageA. The autosave preserves the manual
      // premium value because `manualAnnualPremium != null` wins.
    } else if (ins?.premiumSource === "quote") {
    }

    // Transform existing rebuild from old multiplier → new multiplier
    // so a user toggling HO3↔HO6↔HO3 lands back on the same number
    // (idempotent up to rounding).
    const baseValue = rebuild / prevMult;
    const nextRebuild = Math.round(baseValue * newMult);
    const nextPremium = Math.round(nextRebuild * DEFAULT_HOMEOWNERS_INSURANCE_PERCENT);
    setRebuild(nextRebuild);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyType, addressParam]);

  // ── Factor dropdowns (roof / wind / hurricane / construction / year
  //    / claims). These ARE the discounts/mitigation surface in this
  //    UI — moving them changes the calculated midpoint premium.
  //    Persisted inside `insurance_scenarios.user_answer_sources` jsonb
  //    under `factor_<name>` keys (no new column needed). When any are
  //    changed by the user we stamp `discountsSource = "manual"` so a
  //    future property-value sync can't reset them.
  function resolveFactorsFor(addr: string): {
    roof: number; wind: number; hurr: number; cons: number; year: number; claims: number;
  } {
    const defaults = { roof: 1, wind: 1, hurr: 0, cons: 0, year: 1, claims: 0 };
    const key = (addr ?? "").trim().toLowerCase();
    if (!key) return defaults;
    const ins = getInsuranceScenarios().find(
      s => (s.address ?? "").trim().toLowerCase() === key
    );
    const ua = ins?.userAnswerSources;
    if (!ua) return defaults;
    const pick = (k: string, d: number) => {
      const v = ua[k];
      return typeof v === "number" && Number.isFinite(v) ? v : d;
    };
    return {
      roof:   pick("factor_roofIdx",   defaults.roof),
      wind:   pick("factor_windIdx",   defaults.wind),
      hurr:   pick("factor_hurrIdx",   defaults.hurr),
      cons:   pick("factor_constIdx",  defaults.cons),
      year:   pick("factor_yearIdx",   defaults.year),
      claims: pick("factor_claimsIdx", defaults.claims),
    };
  }
  const initialFactors = resolveFactorsFor(addressParam);
  const [roofIdx, setRoofIdx]     = useState(initialFactors.roof);
  const [windIdx, setWindIdx]     = useState(initialFactors.wind);
  const [hurrIdx, setHurrIdx]     = useState(initialFactors.hurr);
  const [constIdx, setConstIdx]   = useState(initialFactors.cons);
  const [yearIdx, setYearIdx]     = useState(initialFactors.year);
  const [claimsIdx, setClaimsIdx] = useState(initialFactors.claims);

  // AOP deductible + carrier — same persistence pattern as the factor
  // dropdowns (stored in `user_answer_sources`). Resolve a saved value
  // for this address, else fall back to the standard defaults.
  function resolveExtrasFor(addr: string): { aop: number; carrier: string } {
    const key = (addr ?? "").trim().toLowerCase();
    const ins = key
      ? getInsuranceScenarios().find(s => (s.address ?? "").trim().toLowerCase() === key)
      : undefined;
    const ua = ins?.userAnswerSources;
    const aopRaw = ua?.aop_deductible;
    const carrierRaw = ua?.carrier;
    return {
      aop: typeof aopRaw === "number" && Number.isFinite(aopRaw) && aopRaw > 0
        ? aopRaw : DEFAULT_AOP_DEDUCTIBLE,
      carrier: typeof carrierRaw === "string" && carrierRaw.trim()
        ? carrierRaw.trim() : DEFAULT_CARRIER,
    };
  }
  const initialExtras = resolveExtrasFor(addressParam);
  const [aopDeductible, setAopDeductible] = useState<number>(initialExtras.aop);
  const [carrier, setCarrier]             = useState<string>(initialExtras.carrier);
  // Flood zone resolved from FEMA (or a previously-saved value). Empty
  // string = unknown / still resolving (the UI shows "—").
  const [floodZone, setFloodZone]             = useState<string>("");
  const [floodZoneSource, setFloodZoneSource] = useState<string>("");

  // ── QuoteRUSH live quotes ──────────────────
  const [qrLeadId, setQrLeadId] =
    useState<number | null>(null);
  const [qrQuotes, setQrQuotes] = useState<
    QRCacheEntry["quotes"]
  >([]);
  const [qrStatus, setQrStatus] = useState<
    | "idle"
    | "starting"
    | "pending"
    | "success"
    | "error"
    | "expired"
  >("idle");
  const [qrElapsed, setQrElapsed] = useState(0);
  const [qrQuoteCounter, setQrQuoteCounter] =
    useState(0);
  const [qrExpiresAt, setQrExpiresAt] =
    useState<string | null>(null);
  const [qrRefreshing, setQrRefreshing] =
    useState(false);
  const qrPollRef = useRef<
    ReturnType<typeof setInterval> | null
  >(null);
  const qrTimerRef = useRef<
    ReturnType<typeof setInterval> | null
  >(null);
  const qrPrevCounterRef = useRef(0);
  const qrStableRef = useRef(0);
  // Tracks the retry timer used while waiting for another concurrent
  // request to publish the shared-cache leadId (lost-claim-race case).
  const qrWaitRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);
  // Guards the auto-trigger effect so a given address is processed once.
  const qrAutoRef = useRef<string>("");

  // Re-hydrate factors when the active address changes (mirrors the
  // manual-premium / policy-type rehydration pattern above) so
  // switching between scenario tabs restores each property's saved
  // dropdown picks.
  useEffect(() => {
    if (qrPollRef.current)
      clearInterval(qrPollRef.current);
    if (qrTimerRef.current)
      clearInterval(qrTimerRef.current);
    if (qrWaitRef.current)
      clearTimeout(qrWaitRef.current);
    qrAutoRef.current = "";
    setQrQuotes([]);
    setQrStatus("idle");
    setQrLeadId(null);
    setQrQuoteCounter(0);
    setQrExpiresAt(null);
    const f = resolveFactorsFor(addressParam);
    setRoofIdx(f.roof);    setWindIdx(f.wind);    setHurrIdx(f.hurr);
    setConstIdx(f.cons);   setYearIdx(f.year);    setClaimsIdx(f.claims);
    const ex = resolveExtrasFor(addressParam);
    setAopDeductible(ex.aop); setCarrier(ex.carrier);
    console.debug("[insurance-user-load] loaded user fields", {
      address: addressParam, factors: f, aop: ex.aop, carrier: ex.carrier,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressParam]);

  // Auto-detect region when address changes
  useEffect(() => {
    if (addressParam) setRegionKey(getRegionFromAddress(addressParam));
  }, [addressParam]);

  // One-time note: AOP deductible, carrier, and flood zone reuse the
  // existing `user_answer_sources` jsonb column — no schema migration
  // was required to add them.
  useEffect(() => {
  }, []);

  // ── Address editing ──────────────────────────────────────────────────────
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editAddressVal, setEditAddressVal] = useState(addressParam);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const addressAcRef = useRef<any>(null);

  const address = scenarios.find(s => s.id === activeScenarioId)?.address || addressParam;

  // ── Flood-zone resolution ─────────────────────────────────────────────────
  // Resolve the FEMA flood zone for the active address. Priority:
  //   1. a value already saved on this insurance scenario
  //   2. the shared `/api/flood-zone` FEMA lookup (same source the
  //      Purchase-with-Loan / Cash-Buy flows use; cached server-side 24h)
  //   3. unknown → "" (the UI renders "—", never fake data)
  // The resolved zone is then persisted by the autosave effect below.
  useEffect(() => {
    const addr = (address ?? "").trim();
    if (!addr) { setFloodZone(""); setFloodZoneSource(""); return; }
    const saved = getInsuranceScenarios().find(
      s => (s.address ?? "").trim().toLowerCase() === addr.toLowerCase(),
    );
    const savedZone = saved?.userAnswerSources?.flood_zone;
    if (typeof savedZone === "string" && savedZone.trim()) {
      setFloodZone(savedZone.trim());
      setFloodZoneSource(String(saved?.userAnswerSources?.flood_zone_source ?? "saved"));
      return;
    }
    let cancelled = false;
    setFloodZone(""); setFloodZoneSource("");
    fetchFloodZone(addr).then(res => {
      if (cancelled || !res) return;
      setFloodZone(res.zone);
      setFloodZoneSource(res.source);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (!isEditingAddress) return;
    setEditAddressVal(address);
    setTimeout(() => addressInputRef.current?.select(), 30);

    async function init() {
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
        addressAcRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
          types: ["address"], componentRestrictions: { country: "us" }, fields: ["formatted_address"],
        });
        addressAcRef.current.addListener("place_changed", () => {
          const place = addressAcRef.current.getPlace();
          if (place?.formatted_address) {
            setIsEditingAddress(false);
            setLocation(`/insurance?address=${encodeURIComponent(place.formatted_address)}`);
          }
        });
      } catch { /* autocomplete unavailable */ }
    }
    init();
    return () => {
      if (addressAcRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(addressAcRef.current);
        addressAcRef.current = null;
      }
    };
  }, [isEditingAddress]);

  // ── New scenario autocomplete ────────────────────────────────────────────
  useEffect(() => {
    if (!showAddressPrompt) return;
    const timer = setTimeout(() => {
      if (!newScenarioInputRef.current) return;
      loadGoogleMapsApi((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "").then(() => {
        const ac = new (window as any).google.maps.places.Autocomplete(
          newScenarioInputRef.current, { types: ["address"] }
        );
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (place.formatted_address) setNewScenarioAddress(place.formatted_address);
        });
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [showAddressPrompt]);

  // ── Scenario helpers ─────────────────────────────────────────────────────
  function currentSettings(): InsuranceSettings {
    return { regionKey, rebuild, roofIdx, windIdx, hurrIdx, constIdx, yearIdx, claimsIdx };
  }

  function applySettings(s: InsuranceSettings) {
    setRegionKey(s.regionKey); setRebuild(s.rebuild);
    setRoofIdx(s.roofIdx); setWindIdx(s.windIdx); setHurrIdx(s.hurrIdx);
    setConstIdx(s.constIdx); setYearIdx(s.yearIdx); setClaimsIdx(s.claimsIdx);
  }

  function switchScenario(targetId: string) {
    if (targetId === activeScenarioId) return;
    const target = scenarios.find(s => s.id === targetId);
    if (!target) return;
    setScenarios(prev => prev.map(s => s.id === activeScenarioId ? { ...s, savedSettings: currentSettings() } : s));
    setActiveScenarioId(targetId);
    setLocation(`/insurance?address=${encodeURIComponent(target.address)}`);
    if (target.savedSettings) applySettings(target.savedSettings);
    else {
      setRegionKey(getRegionFromAddress(target.address));
      setRebuild(defaultRebuildFor(target.address, null));
    }
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
      setLocation(`/insurance?address=${encodeURIComponent(next.address)}`);
      if (next.savedSettings) applySettings(next.savedSettings);
      else {
        setRegionKey(getRegionFromAddress(next.address));
        setRebuild(defaultRebuildFor(next.address, null));
      }
    }
  }

  function requestAddScenario() {
    if (scenarios.length >= 5) {
      toast({ title: "Maximum 5 properties", description: "Remove a tab to add a new property." });
      return;
    }
    setShowAddressPrompt(true);
  }

  function confirmNewScenario() {
    const addr = newScenarioAddress.trim();
    if (!addr) return;
    const newId = `sc_${Date.now()}`;
    setScenarios(prev => [
      ...prev.map(s => s.id === activeScenarioId ? { ...s, savedSettings: currentSettings() } : s),
      { id: newId, address: addr, savedSettings: null },
    ]);
    setActiveScenarioId(newId);
    setLocation(`/insurance?address=${encodeURIComponent(addr)}`);
    setRegionKey(getRegionFromAddress(addr));
    setRebuild(defaultRebuildFor(addr, null)); setRoofIdx(1); setWindIdx(1); setHurrIdx(0);
    setConstIdx(0); setYearIdx(1); setClaimsIdx(0);
    setNewScenarioAddress("");
    setShowAddressPrompt(false);
  }

  // ── Share / Save ─────────────────────────────────────────────────────────
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadDialogAction, setLeadDialogAction] = useState<"share" | "save">("share");
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("tateo_auth") === "1"
  );

  // ── Logged-in landing behavior (no address param) ────────────────────────
  // 1) If the user has saved Insurance scenarios, auto-jump to the first
  //    one so they land directly on their property instead of a blank
  //    simulator. Only runs while addressParam is empty so the redirect
  //    can't loop (after navigation, addressParam is set and the guard
  //    short-circuits).
  // 2) If the user has zero saved scenarios, an empty state is rendered
  //    below (no redirect, no auto-mounting of the simulator content).
  // 3) Guests are untouched — they keep the simulator-first experience.
  const [showEmptyAddInput, setShowEmptyAddInput] = useState(false);
  const savedInsuranceCount = isAuthenticated && !addressParam
    ? getInsuranceScenarios().length
    : -1; // sentinel: don't read when not needed
  useEffect(() => {
    if (!isAuthenticated) return;
    if (addressParam) return;
    const saved = getInsuranceScenarios();
    if (saved.length === 0) return;
    const first = saved[0];
    const target = first?.address;
    if (!target) return;
    setLocation(`/insurance?address=${encodeURIComponent(target)}`, { replace: true });
  }, [isAuthenticated, addressParam, setLocation]);

  // ── Address-tab hydration (spec: insurance-detail-address-tabs-sync) ─────
  // The top scenario tabs need to mirror the Insurance overview cards.
  // Without this, `scenarios` only ever contains the single tab the user
  // arrived on (initial useState above), so a user with three saved
  // Insurance properties would still only see one tab in the detail view.
  //
  // We hydrate once per mount when the user is authenticated and an
  // address is in the URL. We dedupe by normalized address (same key the
  // overview's `buildInsuranceRows` uses) so duplicate insurance_scenarios
  // rows collapse to a single tab — we never delete the underlying rows
  // here (spec: "do not delete/merge duplicates in this task").
  const didHydrateTabsRef = useRef(false);
  useEffect(() => {
    if (didHydrateTabsRef.current) return;
    if (!isAuthenticated) return;
    if (!addressParam) return; // wait for the auto-jump above to land us on an address
    const saved = getInsuranceScenarios();
    if (saved.length === 0) return;
    didHydrateTabsRef.current = true;

    // Use the SAME normalization primitive the overview uses
    // (`normalizePropertyKey` from lib/property-key.ts — same helper
    // `buildInsuranceRows` and `insurance_scenarios.normalized_property_key`
    // are keyed on). Plain `trim().toLowerCase()` would let "123 Main St"
    // and "123 main st, st petersburg, fl" land in different buckets and
    // produce parity drift vs the overview cards.
    const keyFor = (addr: string) => normalizePropertyKey(addr).key
      || (addr ?? "").trim().toLowerCase();
    const activeKey = keyFor(addressParam);
    const seen = new Map<string, string>(); // key → address (kept tab)
    const tabs: Scenario[] = [];
    let activeId = "";
    let dupCount = 0;
    for (const s of saved) {
      const addr = (s.address ?? "").trim();
      if (!addr) continue;
      const k = keyFor(addr);
      if (!k) continue;
      if (seen.has(k)) {
        dupCount += 1;
        continue;
      }
      seen.set(k, addr);
      const id = s.id || `sc_saved_${tabs.length}`;
      tabs.push({ id, address: addr, savedSettings: null });
      if (activeKey && activeKey === k) activeId = id;
    }
    // URL address isn't in saved scenarios yet (e.g. brand-new property the
    // user navigated into but hasn't saved) — keep it as a tab so we don't
    // strand them on a blank UI.
    if (activeKey && !seen.has(activeKey)) {
      const id = `sc_current_${Date.now()}`;
      tabs.unshift({ id, address: addressParam, savedSettings: null });
      seen.set(activeKey, addressParam);
      activeId = id;
    }
    if (!activeId) activeId = tabs[0].id;

    // Parity check: any overview-source address whose normalized key is
    // not represented in the detail tab set. Should be empty after the
    // dedupe loop above — this log exists so we can spot drift quickly.
    const tabKeys = new Set(tabs.map(t => keyFor(t.address)));
    const missing = saved
      .map(s => ({ address: (s.address ?? "").trim(), key: keyFor((s.address ?? "").trim()) }))
      .filter(x => x.address && x.key && !tabKeys.has(x.key));
    if (dupCount > 0) {
    }
    setScenarios(tabs);
    setActiveScenarioId(activeId);
  }, [isAuthenticated, addressParam]);

  // Wire Google autocomplete onto the empty-state inline input. Mirrors the
  // existing address-edit autocomplete pattern (uses addressInputRef /
  // addressAcRef) — these refs are mutually exclusive because the edit
  // input only renders inside the simulator, and the simulator is skipped
  // when the empty state is shown.
  useEffect(() => {
    if (!showEmptyAddInput) return;
    setTimeout(() => addressInputRef.current?.focus(), 30);

    async function init() {
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
        addressAcRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
          types: ["address"], componentRestrictions: { country: "us" }, fields: ["formatted_address"],
        });
        addressAcRef.current.addListener("place_changed", () => {
          const place = addressAcRef.current.getPlace();
          if (place?.formatted_address) {
            setShowEmptyAddInput(false);
            setLocation(`/insurance?address=${encodeURIComponent(place.formatted_address)}`);
          }
        });
      } catch { /* autocomplete unavailable */ }
    }
    init();
    return () => {
      if (addressAcRef.current) {
        (window as any).google?.maps?.event?.clearInstanceListeners?.(addressAcRef.current);
        addressAcRef.current = null;
      }
    };
  }, [showEmptyAddInput, setLocation]);

  const showInsuranceEmptyState =
    isAuthenticated && !addressParam && savedInsuranceCount === 0;

  function openLeadDialog(action: "share" | "save") {
    setLeadDialogAction(action);
    setLeadDialogOpen(true);
  }

  function handleLeadSuccess() {
    setIsAuthenticated(true);
    localStorage.setItem("tateo_auth", "1");
    if (leadDialogAction === "share") {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
      toast({ title: "Link copied!", description: "Share the URL with anyone to show this estimate." });
    } else {
      toast({ title: "Scenario saved!", description: "Your insurance estimate has been saved." });
    }
  }

  function handleShare() {
    if (isAuthenticated) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
      toast({ title: "Link copied!", description: "Share the URL with anyone to show this estimate." });
    } else {
      openLeadDialog("share");
    }
  }

  function handleSave() {
    if (isAuthenticated) {
      toast({ title: "Scenario saved!", description: "Your insurance estimate has been saved." });
    } else {
      openLeadDialog("save");
    }
  }

  // PostHog: scenario_calculated (insurance). Fires once per address the
  // first time the rebuild-derived premium becomes meaningful (> 0). Keying
  // by address (rather than a page-level boolean) lets a second scenario
  // emit on the same mount if the user navigates between addresses.
  const phInsuranceCalcFiredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!(rebuild > 0)) return;
    const key = (address || "").trim().toLowerCase();
    if (!key) return;
    if (phInsuranceCalcFiredRef.current.has(key)) return;
    phInsuranceCalcFiredRef.current.add(key);
    posthog.capture("scenario_calculated", { type: "insurance" });
  }, [rebuild, address]);

  // ── Autosave ─────────────────────────────────────────────────────────────
  // Debounced 600 ms writer that mirrors the Save button payload so
  // every editable field (Coverage A, factor dropdowns, policy type,
  // manual annual premium) round-trips to `insurance_scenarios`
  // without the user clicking Save. Gated on:
  //   1. `isAuthenticated` — guests don't have a Supabase user_id
  //   2. `hydratedRef.current` — first render after address change
  //      seeds defaults; saving before hydration would clobber the
  //      saved row with placeholder values (same race-prevention
  //      pattern used in seller-estimate.tsx).
  const insuranceHydratedRef = useRef(false);
  useEffect(() => {
    // Mark hydrated one tick after the address-change rehydration
    // effect above has run. That effect updates state synchronously,
    // so by the time this microtask resolves the new factor/premium
    // values are in place.
    insuranceHydratedRef.current = false;
    const t = window.setTimeout(() => { insuranceHydratedRef.current = true; }, 0);
    return () => window.clearTimeout(t);
  }, [addressParam]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!insuranceHydratedRef.current) return;
    const addr = (address ?? "").trim();
    if (!addr) return;
    const t = window.setTimeout(() => {
      const existing = getInsuranceScenarios();
      const key = addr.toLowerCase();
      const match = existing.find(s => s.address.trim().toLowerCase() === key);
      const incomingKey = normalizePropertyKey(addr).key || undefined;
      // Roll a fresh midpoint from current factors so a coverage-only
      // change keeps annual premium consistent (mirrors the Save
      // button). When the user has typed a manual premium, that wins.
      const midNow = (() => {
        const rawAdj = ROOF_ADJ[roofIdx] * WIND_ADJ[windIdx] * HURR_ADJ[hurrIdx]
          * CONST_ADJ[constIdx] * YEAR_ADJ[yearIdx] * CLAIM_ADJ[claimsIdx];
        const adj = rawAdj / NEUTRAL_FACTOR_PRODUCT;
        return rebuild * DEFAULT_HOMEOWNERS_INSURANCE_PERCENT * adj;
      })();
      // Detect manual factor edits by comparing against defaults
      // (1,1,0,0,1,0). Any drift stamps discountsSource = "manual"
      // so future syncs leave them alone. If the user resets back to
      // all-defaults, we still preserve a prior manual stamp on the
      // existing row so they don't lose the lock by accident.
      const factorsChangedFromDefault =
        roofIdx !== 1 || windIdx !== 1 || hurrIdx !== 0 ||
        constIdx !== 0 || yearIdx !== 1 || claimsIdx !== 0;
      const discountsSource =
        factorsChangedFromDefault || match?.discountsSource === "manual"
          ? "manual" as const
          : match?.discountsSource;
      // AOP deductible / carrier: stamp "manual" once edited away from the
      // default, preserving any prior manual lock on the existing row.
      const carrierNow = carrier.trim() || DEFAULT_CARRIER;
      const aopSourceNow =
        aopDeductible !== DEFAULT_AOP_DEDUCTIBLE || match?.aopDeductibleSource === "manual"
          ? "manual" as const
          : match?.aopDeductibleSource;
      const carrierSourceNow =
        carrierNow !== DEFAULT_CARRIER || match?.carrierSource === "manual"
          ? "manual" as const
          : match?.carrierSource;
      const updated: InsuranceScenario = {
        id: match?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        address: addr,
        savedAt: new Date().toISOString(),
        // Spec: insurance-ho6-half-coverage-and-premium — manual / quote
        // premium MUST be preserved when policy type recomputes Coverage A.
        // Manual input wins, then a prior quote upload (locked dollar
        // value, not just label), else the calculated midpoint.
        annualPremium:
          manualAnnualPremium != null
            ? manualAnnualPremium
            : match?.premiumSource === "quote" && typeof match.annualPremium === "number"
              ? match.annualPremium
              : Math.round(midNow),
        coverageA: rebuild,
        coverageASource: match?.coverageASource ?? "default",
        premiumSource:
          manualAnnualPremium != null
            ? "manual"
            : match?.premiumSource === "quote" ? "quote" : "default_0_75_percent",
        coverageType: region.name,
        ...(incomingKey ? { normalizedPropertyKey: incomingKey } : {}),
        ...(policyType
          ? { policyType, policyTypeSource: policyTypeSource ?? "default_rule" }
          : {}),
        ...(match?.occupancyType ? { occupancyType: match.occupancyType } : {}),
        ...(match?.propertyType ? { propertyType: match.propertyType } : {}),
        // Carry forward all previously-stamped source fields so we
        // don't wipe locks set by future UI work (carrier / AOP /
        // deductibles / quote details).
        ...(match?.occupancyTypeSource ? { occupancyTypeSource: match.occupancyTypeSource } : {}),
        ...(match?.propertyTypeSource ? { propertyTypeSource: match.propertyTypeSource } : {}),
        // Carrier / AOP source: stamp "manual" once the user changes the
        // value away from the default, and keep a prior manual stamp so a
        // reset back to the default doesn't silently unlock it.
        ...(carrierSourceNow ? { carrierSource: carrierSourceNow } : {}),
        ...(aopSourceNow ? { aopDeductibleSource: aopSourceNow } : {}),
        ...(match?.hurricaneDeductibleSource ? { hurricaneDeductibleSource: match.hurricaneDeductibleSource } : {}),
        ...(match?.floodDeductibleSource ? { floodDeductibleSource: match.floodDeductibleSource } : {}),
        ...(match?.quoteDetailsSource ? { quoteDetailsSource: match.quoteDetailsSource } : {}),
        ...(discountsSource ? { discountsSource } : {}),
        // Persist the six factor picks inside the jsonb scratch map.
        // Keys are namespaced with `factor_` so they don't collide
        // with any future source-tag entries the cash-buy / seller
        // pattern might add to the same column. AOP deductible, carrier,
        // and the FEMA flood zone live here too (no dedicated value
        // column needed).
        userAnswerSources: {
          ...(match?.userAnswerSources ?? {}),
          factor_roofIdx: roofIdx,
          factor_windIdx: windIdx,
          factor_hurrIdx: hurrIdx,
          factor_constIdx: constIdx,
          factor_yearIdx: yearIdx,
          factor_claimsIdx: claimsIdx,
          ...(factorsChangedFromDefault ? { factor_source: "manual" } : {}),
          aop_deductible: aopDeductible,
          carrier: carrierNow,
          // Only write a flood zone once one is actually resolved so the
          // empty mid-lookup state never wipes a previously-saved value.
          ...(floodZone
            ? { flood_zone: floodZone, flood_zone_source: floodZoneSource || "fema" }
            : {}),
        },
      };
      console.debug("[insurance-user-save] scenario id", updated.id);
      console.debug("[insurance-user-save] normalized property key", incomingKey);
      console.debug("[insurance-user-save] changed field", "(autosave snapshot)");
      console.debug("[insurance-user-save] value", {
        coverageA: rebuild, policyType, manualAnnualPremium,
        factors: { roofIdx, windIdx, hurrIdx, constIdx, yearIdx, claimsIdx },
      });
      console.debug("[insurance-user-save] source", {
        coverageA: updated.coverageASource, policy: updated.policyTypeSource,
        premium: updated.premiumSource, discounts: updated.discountsSource,
      });
      const next = match
        ? existing.map(s => (s.id === match.id ? updated : s))
        : [...existing, updated];
      saveInsuranceScenarios(next).catch(err => {
        console.debug("[insurance-user-save] upsert error", err?.message ?? err);
      });
      // New scenario only (!match fires once): notify the assigned agent
      // (non-blocking, fire-and-forget).
      if (!match) notifyNewScenario("Insurance", address, "Saved an insurance scenario");
      posthog.capture("scenario_saved", { type: "insurance" });
    }, 600);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthenticated, address, rebuild, policyType, policyTypeSource,
    manualAnnualPremium, roofIdx, windIdx, hurrIdx, constIdx, yearIdx, claimsIdx,
    aopDeductible, carrier, floodZone, floodZoneSource,
  ]);

  // Auto-trigger / cache-hydrate QuoteRUSH when address + rebuild ready.
  // Goal: no manual "Get Quotes" button — entering an address auto-runs a
  // quote, but shared cache (localStorage → server DB) is consulted first
  // so a repeat address (within 30 days) never re-pays the cost.
  useEffect(() => {
    if (!isAuthenticated || !address || !rebuild) return;
    if (address === "Unknown Address") return;
    if (qrAutoRef.current === address) return;
    qrAutoRef.current = address;

    let cancelled = false;
    (async () => {
      // 1) Fast local cache.
      const local = getQRCache(address);
      if (
        local &&
        (local.status === "success" ||
          local.status === "pending")
      ) {
        loadFromCacheEntry(local);
        if (local.status === "pending") {
          if (local.leadId) {
            startPolling(local.leadId);
          } else {
            // Claimed by a concurrent request but leadId not yet
            // published — wait for it instead of stalling.
            setQrStatus("pending");
            pollCacheForLead(address);
          }
        }
        return;
      }

      // 2) Shared server cache.
      try {
        const res = await fetch(
          `/api/insurance/qr-cache?address=` +
            encodeURIComponent(address)
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.found) {
          const entry: QRCacheEntry = {
            address,
            leadId: data.leadId ?? null,
            status: data.status ?? "pending",
            quotes: data.quotes ?? [],
            quoteCounter: data.quoteCounter ?? 0,
            coverageA: data.coverageA ?? 0,
            expiresAt:
              data.expiresAt ??
              new Date().toISOString(),
            triggeredAt:
              data.triggeredAt ??
              new Date().toISOString(),
          };
          if (data.expired) {
            // Show stale top-3 but flag expired → prompt re-run.
            setQrLeadId(entry.leadId);
            setQrQuotes(entry.quotes);
            setQrQuoteCounter(entry.quoteCounter);
            setQrExpiresAt(entry.expiresAt);
            setQrStatus("expired");
            return;
          }
          setQRCache(address, entry);
          loadFromCacheEntry(entry);
          if (entry.status === "pending") {
            if (entry.leadId) {
              startPolling(entry.leadId);
            } else {
              // Row claimed by a concurrent request but leadId not
              // published yet — wait for it instead of re-submitting.
              setQrStatus("pending");
              pollCacheForLead(address);
            }
          }
          return;
        }
      } catch (e) {
        console.error("[qr-auto-hydrate]", e);
      }

      // 3) Nothing cached anywhere → auto-trigger fresh quote.
      if (cancelled) return;
      startQuoteRush();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, rebuild, isAuthenticated]);

  // ── QuoteRUSH quoting ─────────────────────

  // Loads QR component state from a cache entry (localStorage or server).
  function loadFromCacheEntry(e: QRCacheEntry): void {
    setQrLeadId(e.leadId);
    setQrQuotes(e.quotes ?? []);
    setQrQuoteCounter(e.quoteCounter ?? 0);
    setQrExpiresAt(e.expiresAt ?? null);
    if (
      e.status === "success" &&
      (e.quotes?.length ?? 0) > 0
    ) {
      setQrStatus("success");
    } else if (e.status === "pending" && e.leadId) {
      setQrStatus("pending");
    } else if (e.status === "error") {
      setQrStatus("error");
    }
  }

  // Waits for a concurrent request to publish the shared-cache leadId (the
  // lost-claim-race case where qr-start returns pending with no leadId).
  // Polls qr-cache every 5s and hands off to startPolling once ready.
  function pollCacheForLead(addr: string, attempts = 0): void {
    if (qrWaitRef.current) clearTimeout(qrWaitRef.current);
    if (attempts > 24) {
      if (qrQuotes.length === 0) setQrStatus("error");
      return;
    }
    qrWaitRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/insurance/qr-cache?address=` +
            encodeURIComponent(addr)
        );
        const data = await res.json();
        if (data.found && data.expired) {
          setQrStatus("expired");
          return;
        }
        if (
          data.found &&
          data.status === "success" &&
          (data.quotes?.length ?? 0) > 0
        ) {
          setQrQuotes(data.quotes);
          setQrQuoteCounter(data.quoteCounter);
          setQrExpiresAt(data.expiresAt ?? null);
          setQrStatus("success");
          setQRCache(addr, {
            status: "success",
            leadId: data.leadId,
            quotes: data.quotes,
            quoteCounter: data.quoteCounter,
            ...(data.expiresAt
              ? { expiresAt: data.expiresAt }
              : {}),
          });
          return;
        }
        if (data.found && data.leadId) {
          setQrLeadId(data.leadId);
          setQrStatus("pending");
          setQRCache(addr, {
            leadId: data.leadId,
            status: "pending",
          });
          startPolling(data.leadId);
          return;
        }
        pollCacheForLead(addr, attempts + 1);
      } catch {
        pollCacheForLead(addr, attempts + 1);
      }
    }, 5000);
  }

  // Refresh — pulls the latest carrier results for an existing lead
  // WITHOUT re-submitting (no new cost). Fixes "only 1 carrier showing".
  async function refreshQuotes(): Promise<void> {
    if (!qrLeadId || qrRefreshing) return;
    setQrRefreshing(true);
    try {
      const res = await authedFetch(
        "/api/insurance/qr-refresh",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: qrLeadId,
            address,
          }),
        }
      );
      const data = await res.json();
      if ((data.quotes?.length ?? 0) > 0) {
        setQrQuotes(data.quotes);
        setQrQuoteCounter(data.quoteCounter);
        setQrStatus("success");
        setQRCache(address, {
          status: "success",
          quotes: data.quotes,
          quoteCounter: data.quoteCounter,
        });
      }
    } catch (e) {
      console.error("[qr-refresh]", e);
    } finally {
      setQrRefreshing(false);
    }
  }

  // Polls qr-quotes until the carrier count is stable across 3
  // consecutive polls (gives slower carriers time to respond).
  function startPolling(leadId: number): void {
    if (qrPollRef.current)
      clearInterval(qrPollRef.current);
    if (qrTimerRef.current)
      clearInterval(qrTimerRef.current);

    setQrElapsed(0);
    qrPrevCounterRef.current = 0;
    qrStableRef.current = 0;

    qrTimerRef.current = setInterval(() => {
      setQrElapsed((p) => p + 1);
    }, 1000);

    let pollCount = 0;
    const MAX_POLLS = 24; // 12 minutes

    const doPoll = async () => {
      pollCount++;
      try {
        const res = await authedFetch(
          "/api/insurance/qr-quotes",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId, address }),
          }
        );
        const data = await res.json();
        const counter: number = data.quoteCounter ?? 0;

        if (counter > 0) {
          setQrQuotes(data.quotes ?? []);
          setQrQuoteCounter(counter);
          setQrStatus("success");
          setQRCache(address, {
            status: "success",
            quotes: data.quotes ?? [],
            quoteCounter: counter,
          });

          // Stop only after 3 consecutive stable polls.
          if (counter === qrPrevCounterRef.current) {
            qrStableRef.current += 1;
          } else {
            qrStableRef.current = 0;
          }
          qrPrevCounterRef.current = counter;

          if (
            qrStableRef.current >= 3 ||
            pollCount >= MAX_POLLS
          ) {
            if (qrPollRef.current)
              clearInterval(qrPollRef.current);
            if (qrTimerRef.current)
              clearInterval(qrTimerRef.current);
          }
        } else if (pollCount >= MAX_POLLS) {
          if (qrPollRef.current)
            clearInterval(qrPollRef.current);
          if (qrTimerRef.current)
            clearInterval(qrTimerRef.current);
          if (qrQuotes.length === 0) {
            setQrStatus("error");
          }
        }
      } catch (e) {
        console.error("[qr-poll]", e);
      }
    };

    qrPollRef.current = setInterval(doPoll, 30000);
  }

  async function startQuoteRush(): Promise<void> {
    if (!address || !rebuild || !isAuthenticated)
      return;

    if (qrPollRef.current)
      clearInterval(qrPollRef.current);
    if (qrTimerRef.current)
      clearInterval(qrTimerRef.current);

    setQrStatus("starting");
    setQrQuotes([]);
    setQrQuoteCounter(0);
    setQrElapsed(0);
    clearQRCache(address);

    try {
      const startRes = await authedFetch(
        "/api/insurance/qr-start",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address,
            coverageA: rebuild,
            policyType: policyType || "HO3",
            yearIdx,
            roofIdx,
            constIdx,
            windIdx,
            hurrIdx,
            claimsIdx,
            aopDeductible,
            floodZone: floodZone || "X",
            sqFt: 0,
            newPurchase: false,
          }),
        }
      );

      const data = await startRes.json();

      if (!startRes.ok) {
        setQrStatus("error");
        if (qrTimerRef.current)
          clearInterval(qrTimerRef.current);
        return;
      }

      // Lost the claim race — another concurrent request is submitting
      // this address but its leadId isn't published yet. Wait for it
      // rather than firing a second (paid) submission.
      if (!data.leadId) {
        if (data.status === "pending") {
          setQrStatus("pending");
          pollCacheForLead(address);
        } else {
          setQrStatus("error");
          if (qrTimerRef.current)
            clearInterval(qrTimerRef.current);
        }
        return;
      }

      const leadId: number = data.leadId;
      setQrLeadId(leadId);
      setQRCache(address, { leadId, status: "pending" });

      // Server may return cached quotes for a shared address.
      if (data.fromCache && (data.quotes?.length ?? 0) > 0) {
        setQrQuotes(data.quotes);
        setQrQuoteCounter(data.quoteCounter);
        setQrStatus("success");
        if (data.expiresAt) setQrExpiresAt(data.expiresAt);
        setQRCache(address, {
          leadId,
          status: "success",
          quotes: data.quotes,
          quoteCounter: data.quoteCounter,
          ...(data.expiresAt
            ? { expiresAt: data.expiresAt }
            : {}),
        });
        return;
      }

      setQrStatus("pending");
      startPolling(leadId);
    } catch (err) {
      console.error("[qr-start]", err);
      setQrStatus("error");
      if (qrTimerRef.current)
        clearInterval(qrTimerRef.current);
    }
  }

  // ── Calculations ─────────────────────────────────────────────────────────
  const region = REGIONS[regionKey];

  const calc = useMemo(() => {
    // Anchor the midpoint to the shared 0.75%-of-value default so this
    // tab always agrees with Purchase with Loan, Cash Buy, and the
    // Ongoing Costs row for the same property. Factors still scale the
    // band, but they're normalized against the default product so a
    // property with neutral factors lands exactly on the 0.75% number.
    const rawAdj = ROOF_ADJ[roofIdx] * WIND_ADJ[windIdx] * HURR_ADJ[hurrIdx] * CONST_ADJ[constIdx] * YEAR_ADJ[yearIdx] * CLAIM_ADJ[claimsIdx];
    const adj = rawAdj / NEUTRAL_FACTOR_PRODUCT;
    const midRate  = DEFAULT_HOMEOWNERS_INSURANCE_PERCENT * adj;
    const lowRate  = midRate * 0.85;
    const highRate = midRate * 1.15;
    const hurrDeductiblePct = [0.02, 0.03, 0.05][hurrIdx];
    return {
      low: rebuild * lowRate, mid: rebuild * midRate, high: rebuild * highRate,
      monthly: rebuild * midRate / 12,
      hurrDeductible: rebuild * hurrDeductiblePct,
      hurrPct: hurrDeductiblePct * 100,
      windEffect: windIdx === 2 ? { label: "−18%", dir: "save" } : windIdx === 0 ? { label: "+14%", dir: "cost" } : { label: "Baseline", dir: "neutral" },
      roofEffect: roofIdx === 0 ? { label: "−10%", dir: "save" } : roofIdx === 1 ? { label: "Baseline", dir: "neutral" } : roofIdx === 2 ? { label: "+20%", dir: "cost" } : { label: "+38%", dir: "cost" },
      hurrEffect: hurrIdx === 0 ? { label: "Standard (2%)", dir: "neutral" } : hurrIdx === 1 ? { label: "−5% vs 2%", dir: "save" } : { label: "−10% vs 2%", dir: "save" },
      constEffect: constIdx === 0 ? { label: "−7%", dir: "save" } : constIdx === 2 ? { label: "+8%", dir: "cost" } : { label: "Baseline", dir: "neutral" },
    };
  }, [region, rebuild, roofIdx, windIdx, hurrIdx, constIdx, yearIdx, claimsIdx]);

  function EffectBadge({ label, dir }: { label: string; dir: string }) {
    if (dir === "save") return <span className="inline-flex items-center gap-1 text-green-700 font-semibold text-sm"><TrendingDown className="h-3.5 w-3.5" />{label}</span>;
    if (dir === "cost") return <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-sm"><TrendingUp className="h-3.5 w-3.5" />{label}</span>;
    return <span className="inline-flex items-center gap-1 text-muted-foreground text-sm"><Minus className="h-3.5 w-3.5" />{label}</span>;
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Helmet><title>Insurance Estimate — {address || "Havo"}</title></Helmet>

      {showInsuranceEmptyState ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardContent className="py-10 px-6 flex flex-col items-center text-center gap-4">
              <Shield className="h-12 w-12 text-primary" />
              <div className="space-y-1">
                <h2 className="text-xl font-bold">No properties added yet</h2>
                <p className="text-sm text-muted-foreground">
                  Add a property address to get an insurance estimate
                </p>
              </div>
              {!showEmptyAddInput ? (
                <Button
                  className="mt-2"
                  onClick={() => setShowEmptyAddInput(true)}
                  data-testid="insurance-empty-add-property"
                >
                  Add Property Address
                </Button>
              ) : (
                <div className="w-full mt-2">
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      ref={addressInputRef}
                      type="text"
                      placeholder="Enter a property address"
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) {
                            setShowEmptyAddInput(false);
                            setLocation(`/insurance?address=${encodeURIComponent(val)}`);
                          }
                        } else if (e.key === "Escape") {
                          setShowEmptyAddInput(false);
                        }
                      }}
                      className="flex-1 bg-transparent outline-none text-sm"
                      autoComplete="off"
                      data-testid="insurance-empty-address-input"
                    />
                  </div>
                  <button
                    onClick={() => setShowEmptyAddInput(false)}
                    className="text-xs text-muted-foreground hover:text-foreground mt-2"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
      <div className="min-h-screen bg-gray-50">

        {/* ── Sticky top bar (same pattern as estimate page) ── */}
        <div className="bg-white border-b shadow-sm sticky top-[73px] z-40">

          {/* Scenario tabs */}
          <div className="container mx-auto px-4 pt-2 flex items-center gap-1 overflow-x-auto scrollbar-none">
            {scenarios.map((sc) => (
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
                <span>{shortLabel(sc.address) || "New property"}</span>
                {scenarios.length > 1 && (
                  <button
                    onClick={(e) => removeScenario(sc.id, e)}
                    className="ml-0.5 rounded-full hover:bg-black/10 p-0.5 transition-colors"
                    aria-label="Remove"
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
                title="Compare another property"
              >
                <Plus className="h-3.5 w-3.5" /> Add Property
              </button>
            )}
          </div>

          {/* Address + action bar */}
          <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              {/* Back routing matches Cash Buy / Seller / Purchase: a
                  logged-in user is always inside a dashboard scenario, so
                  Back returns to Dashboard → Insurance tab. Only the
                  logged-out flow (entered via the six-service picker)
                  should land back on /select-service. */}
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    setLocation("/dashboard?tab=insurance");
                  } else {
                    setLocation(
                      `/select-service${addressParam ? `?address=${encodeURIComponent(addressParam)}` : ""}`
                    );
                  }
                }}
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label={isAuthenticated ? "Back to Insurance dashboard" : "Back to Services"}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1.5">
                  <Shield className="h-3 w-3" /> Insurance Estimate
                </p>
                {isEditingAddress ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <input
                      ref={addressInputRef}
                      type="text"
                      value={editAddressVal}
                      onChange={e => setEditAddressVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const val = editAddressVal.trim();
                          if (val) setLocation(`/insurance?address=${encodeURIComponent(val)}`);
                          setIsEditingAddress(false);
                        } else if (e.key === "Escape") {
                          setIsEditingAddress(false);
                        }
                      }}
                      onBlur={() => setTimeout(() => setIsEditingAddress(false), 200)}
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
                    <span className="font-semibold text-sm leading-tight">{address || "Enter an address"}</span>
                    <Pencil className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Standard Share + Save Scenario pair, identical to
                  the other four detail views. Save persists one row
                  per address into `insurance_scenarios`; the call is
                  awaited so the success toast only fires after the
                  Supabase write returns OK. */}
              <ScenarioActions
                scenarioType="insurance"
                getPdfData={() => {
                  if (!address || !address.trim()) return null;
                  const annualPremium =
                    manualAnnualPremium != null
                      ? manualAnnualPremium
                      : Math.round(calc.mid);
                  // Occupancy / structure type aren't held in component
                  // state — derive them from the saved source scenarios
                  // for this address, mirroring the default-policy helper.
                  const pdfKey = address.trim().toLowerCase();
                  const pdfPurchase = getPurchaseScenarios().find(
                    p => (p.address ?? "").trim().toLowerCase() === pdfKey,
                  );
                  const pdfCash = getCashBuyScenarios().find(
                    c => (c.address ?? "").trim().toLowerCase() === pdfKey,
                  );
                  const pdfLoan = getTrackedLoans().find(
                    l => (l.propertyAddress ?? "").trim().toLowerCase() === pdfKey,
                  );
                  const occupancy =
                    pdfCash?.occupancyType ??
                    (pdfLoan?.propertyType as string | undefined) ??
                    (pdfPurchase ? "primary" : undefined);
                  const propertyType =
                    pdfPurchase?.propertyType ?? pdfLoan?.physicalPropertyType;
                  const POLICY_LABELS: Record<string, string> = {
                    HO3: "HO-3 (Homeowners)",
                    HO6: "HO-6 (Condo / Townhome)",
                    DP3: "DP-3 (Dwelling / Rental)",
                  };
                  const OCCUPANCY_LABELS: Record<string, string> = {
                    primary: "Primary residence",
                    secondary: "Secondary home",
                    investment: "Investment property",
                  };
                  return {
                    address,
                    sections: [
                      {
                        heading: "Policy Summary",
                        rows: [
                          { label: "Policy type", value: policyType ? POLICY_LABELS[policyType] ?? policyType : "—" },
                          { label: "Occupancy", value: occupancy ? OCCUPANCY_LABELS[occupancy] ?? occupancy : "—" },
                          { label: "Property type", value: propertyType || "—" },
                          { label: "Coverage A / Rebuild cost", value: fmt(rebuild) },
                          { label: "Annual premium", value: fmt(annualPremium) },
                          { label: "Monthly premium", value: fmt(calc.monthly) },
                          { label: `Hurricane deductible (${calc.hurrPct.toFixed(0)}%)`, value: fmt(calc.hurrDeductible) },
                          { label: "AOP deductible", value: fmt(aopDeductible) },
                          { label: "Flood zone", value: floodZone || "—" },
                          { label: "Carrier", value: carrier.trim() || DEFAULT_CARRIER },
                        ],
                      },
                      {
                        heading: "Discounts / Mitigation",
                        rows: [
                          { label: "Roof", value: calc.roofEffect.label },
                          { label: "Wind mitigation", value: calc.windEffect.label },
                          { label: "Hurricane deductible", value: calc.hurrEffect.label },
                          { label: "Construction", value: calc.constEffect.label },
                        ],
                      },
                    ],
                    disclaimer:
                      "These are estimates only based on regional data, property characteristics, and standard assumptions. Results vary by specific property inspection and market availability. Not a binding quote. Coverage is not effective until confirmed by a licensed agent. Tateo Insurance Corp (Company) - License #L132640. Paul Christian Tateo (Agent) - License #W142842.",
                  };
                }}
                onSave={async () => {
                  if (!address || !address.trim()) {
                    throw new Error("Enter an address before saving.");
                  }
                  const key = address.trim().toLowerCase();
                  const existing = getInsuranceScenarios();
                  const match = existing.find(
                    s => s.address.trim().toLowerCase() === key
                  );
                  const updated: InsuranceScenario = {
                    id: match?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    address,
                    savedAt: new Date().toISOString(),
                    // If the user has typed a manual Annual Premium,
                    // persist that exact value and stamp the source.
                    // Otherwise fall back to the calculated midpoint
                    // (Coverage A × 0.75% × factor adjustment) — the
                    // sync helper is free to recompute this later.
                    annualPremium:
                      manualAnnualPremium != null
                        ? manualAnnualPremium
                        : match?.premiumSource === "quote" && typeof match.annualPremium === "number"
                          ? match.annualPremium
                          : Math.round(calc.mid),
                    // Persist Coverage A so the Phase 1 cross-tab value
                    // sync can read/protect it. Source carries forward
                    // from the saved scenario; if the user moved the
                    // Rebuild Cost slider this save call,
                    // `_stampManualOnValueDiff` in saveInsuranceScenarios
                    // will detect the diff vs `match.coverageA` and
                    // stamp coverageASource = "manual". If unchanged,
                    // the prior source ("property_value_sync" /
                    // "default" / "manual") is preserved.
                    coverageA: rebuild,
                    coverageASource: match?.coverageASource ?? "default",
                    // Stamp premium provenance from the manual-input
                    // state, preserving any prior "quote" upload that
                    // the page can't override today.
                    premiumSource:
                      manualAnnualPremium != null
                        ? "manual"
                        : match?.premiumSource === "quote"
                          ? "quote"
                          : "default_0_75_percent",
                    coverageType: region.name,
                    ...(policyType
                      ? {
                          policyType,
                          policyTypeSource: policyTypeSource ?? "default_rule",
                        }
                      : {}),
                    ...(match?.occupancyType ? { occupancyType: match.occupancyType } : {}),
                    ...(match?.propertyType ? { propertyType: match.propertyType } : {}),
                  };
                  const next = match
                    ? existing.map(s => (s.id === match.id ? updated : s))
                    : [...existing, updated];
                  await saveInsuranceScenarios(next);
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="container mx-auto px-4 py-6 space-y-6">

          {/* Page indicator */}
          <div className="max-w-2xl mx-auto lg:max-w-none">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">Insurance Estimate</p>
              <p className="text-xs text-muted-foreground font-medium">Page 1 of 1</p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-primary" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">

            {/* ── LEFT: Inputs ── */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="h-4 w-4 text-primary" /> Property Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">
                    Policy Type
                    {policyTypeSource === "default_rule" && policyType && (
                      <span className="ml-2 normal-case tracking-normal text-[10px] font-medium text-muted-foreground/80">
                        auto-defaulted
                      </span>
                    )}
                    {policyTypeSource === "manual" && (
                      <span className="ml-2 normal-case tracking-normal text-[10px] font-medium text-primary">
                        manual
                      </span>
                    )}
                  </label>
                  <select
                    value={policyType}
                    onChange={e => {
                      const v = e.target.value as InsurancePolicyType | "";
                      setPolicyType(v);
                      setPolicyTypeSource(v ? "manual" : null);
                    }}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    data-testid="select-policy-type"
                  >
                    <option value="">— select —</option>
                    {(["HO3", "HO6", "DP3"] as InsurancePolicyType[]).map(k => (
                      <option key={k} value={k}>{INSURANCE_POLICY_TYPE_LABELS[k]}</option>
                    ))}
                  </select>
                </div>

                <SelectRow
                  label="Region / Risk Tier"
                  value={Object.keys(REGIONS).indexOf(regionKey)}
                  onChange={i => setRegionKey(Object.keys(REGIONS)[i] as RegionKey)}
                  options={Object.entries(REGIONS).map(([, r], i) => ({ value: i, label: r.name + " — " + r.counties }))}
                />

                <SliderRow
                  label="Rebuild / Replacement Cost (Coverage A)"
                  value={rebuild}
                  onChange={setRebuild}
                  min={150000} max={1500000} step={25000}
                />

                <Separator />

                <SelectRow
                  label="Roof Age"
                  value={roofIdx}
                  onChange={setRoofIdx}
                  options={[
                    { value: 0, label: "Under 5 years" },
                    { value: 1, label: "5–14 years — standard" },
                    { value: 2, label: "15–20 years" },
                    { value: 3, label: "20+ years — limited carrier options" },
                  ]}
                />

                <SelectRow
                  label="Wind Mitigation"
                  value={windIdx}
                  onChange={setWindIdx}
                  options={[
                    { value: 0, label: "No inspection / no features on file" },
                    { value: 1, label: "Basic inspection on file — standard" },
                    { value: 2, label: "Full mitigation: hip roof, shutters, SWR" },
                  ]}
                />

                <SelectRow
                  label="Hurricane Deductible"
                  value={hurrIdx}
                  onChange={setHurrIdx}
                  options={[
                    { value: 0, label: "2% of dwelling — standard" },
                    { value: 1, label: "3% of dwelling" },
                    { value: 2, label: "5% of dwelling" },
                  ]}
                />

                <SelectRow
                  label="Construction Type"
                  value={constIdx}
                  onChange={setConstIdx}
                  options={[
                    { value: 0, label: "Concrete block / CBS — preferred" },
                    { value: 1, label: "Mixed / unknown — standard" },
                    { value: 2, label: "Frame construction" },
                  ]}
                />

                <SelectRow
                  label="Year Built"
                  value={yearIdx}
                  onChange={setYearIdx}
                  options={[
                    { value: 0, label: "2002 or newer — Florida Building Code" },
                    { value: 1, label: "1990–2001 — standard" },
                    { value: 2, label: "1970–1989" },
                    { value: 3, label: "Pre-1970" },
                  ]}
                />

                <SelectRow
                  label="Claims History (past 5 years)"
                  value={claimsIdx}
                  onChange={setClaimsIdx}
                  options={[
                    { value: 0, label: "No claims — clean history" },
                    { value: 1, label: "1 claim filed" },
                    { value: 2, label: "2 claims filed" },
                    { value: 3, label: "3+ claims" },
                  ]}
                />

                <SelectRow
                  label="AOP Deductible (all other perils)"
                  value={aopDeductible}
                  onChange={setAopDeductible}
                  options={[
                    { value: 1000, label: "$1,000" },
                    { value: 2500, label: "$2,500 — standard" },
                    { value: 5000, label: "$5,000" },
                    { value: 10000, label: "$10,000" },
                  ]}
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Carrier</label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={e => setCarrier(e.target.value)}
                    placeholder={DEFAULT_CARRIER}
                    data-testid="input-carrier"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Flood Zone</label>
                  <div
                    data-testid="text-flood-zone"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-muted/40 text-muted-foreground"
                  >
                    {floodZone || "—"}
                    {floodZone && floodZoneSource ? (
                      <span className="ml-2 text-xs text-muted-foreground/70">({floodZoneSource === "fema" ? "FEMA" : floodZoneSource})</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground/70">Auto-detected from the FEMA flood map for this address.</p>
                </div>

              </CardContent>
            </Card>

            {/* ── RIGHT: Results ── */}
            <div className="space-y-5 lg:sticky lg:top-[145px]">

              {/* Premium hero */}
              <div className="bg-primary rounded-2xl p-6 text-white shadow-lg">
                <div className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1">Estimated Annual Premium</div>
                <div className="text-xs text-white/50 mb-5">{region.name} · ${rebuild.toLocaleString()} rebuild · HO-3 wind policy</div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                    <div className="text-[10px] font-medium text-white/50 uppercase tracking-wide mb-2">Low Estimate</div>
                    <div className="text-xl font-bold font-mono">{fmt(calc.low)}</div>
                    <div className="text-[10px] text-white/40 mt-1">{(calc.low / rebuild * 100).toFixed(2)}% of rebuild</div>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-4 border border-secondary/50">
                    <div className="text-[10px] font-medium text-secondary-foreground/70 uppercase tracking-wide mb-2">Midpoint</div>
                    <div className="text-2xl font-bold font-mono text-secondary">{fmt(calc.mid)}</div>
                    <div className="text-[10px] text-secondary/70 mt-1">{(calc.mid / rebuild * 100).toFixed(2)}% of rebuild</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                    <div className="text-[10px] font-medium text-white/50 uppercase tracking-wide mb-2">High Estimate</div>
                    <div className="text-xl font-bold font-mono">{fmt(calc.high)}</div>
                    <div className="text-[10px] text-white/40 mt-1">{(calc.high / rebuild * 100).toFixed(2)}% of rebuild</div>
                  </div>
                </div>
              </div>

              {/* Annual Premium override (editable) */}
              <Card className="border shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Annual Premium
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {manualAnnualPremium != null
                          ? "Manual override — sync will not change this"
                          : "Auto-estimated from Coverage A — editable"}
                      </div>
                    </div>
                    {manualAnnualPremium != null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          setManualAnnualPremium(null);
                          setManualPremiumInput("");
                        }}
                        data-testid="insurance-reset-premium"
                      >
                        Reset to Estimate
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Annual
                      </div>
                      <div className="flex items-center gap-1 border rounded-md px-2 py-1.5 bg-white">
                        <span className="text-muted-foreground text-sm">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="flex-1 text-base font-mono font-semibold text-primary bg-transparent outline-none w-full min-w-0"
                          value={
                            manualAnnualPremium != null
                              ? manualPremiumInput
                              : String(Math.round(calc.mid))
                          }
                          onFocus={(e) => {
                            // First focus while still on the auto-estimate:
                            // seed the input with the current midpoint so
                            // the user edits a real number, not a blank.
                            if (manualAnnualPremium == null) {
                              const seed = String(Math.round(calc.mid));
                              setManualPremiumInput(seed);
                              setManualAnnualPremium(Math.round(calc.mid));
                              // Select the seeded text for quick replacement.
                              setTimeout(() => e.target.select(), 0);
                            }
                          }}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            setManualPremiumInput(raw);
                            if (raw === "") {
                              // Empty input — clear manual stamp so the
                              // calculated midpoint shows through and Reset
                              // is effectively automatic.
                              setManualAnnualPremium(null);
                            } else {
                              const n = parseInt(raw, 10);
                              setManualAnnualPremium(Number.isFinite(n) ? n : null);
                            }
                          }}
                          data-testid="insurance-manual-premium"
                        />
                        <span className="text-muted-foreground text-xs">/yr</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Monthly
                      </div>
                      <div className="text-base font-mono font-semibold text-primary px-2 py-1.5">
                        {fmt(
                          (manualAnnualPremium != null
                            ? manualAnnualPremium
                            : calc.mid) / 12
                        )}
                        <span className="text-muted-foreground text-xs ml-1">/mo</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key metric cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Monthly (midpoint)", value: fmt(calc.monthly) + "/mo", sub: "Budget planning figure" },
                  { label: "Hurricane Deductible", value: fmt(calc.hurrDeductible), sub: `${calc.hurrPct}% of dwelling — per event` },
                  { label: "Flood Insurance", value: "Separate", sub: "NFIP or private — not included" },
                  { label: "Risk Tier", value: region.tier, sub: region.name, badge: true, tierColor: region.tierColor },
                ].map((m, i) => (
                  <Card key={i} className="border shadow-sm">
                    <CardContent className="p-4">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{m.label}</div>
                      {m.badge
                        ? <Badge className={`text-xs font-bold mt-1 ${m.tierColor} border-0`}>{m.value}</Badge>
                        : <div className="text-base font-bold font-mono text-primary">{m.value}</div>
                      }
                      <div className="text-[10px] text-muted-foreground mt-1">{m.sub}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* QuoteRUSH Live Carrier Quotes */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary shrink-0" />
                        Live Carrier Quotes
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {qrStatus === "idle" &&
                          "Get real-time rates from your Florida-appointed carriers."}
                        {qrStatus === "starting" &&
                          "Submitting to QuoteRUSH…"}
                        {qrStatus === "pending" &&
                          `QuoteBot is quoting your carriers — ${qrQuoteCounter} quote${qrQuoteCounter !== 1 ? "s" : ""} so far · ${qrElapsed}s`}
                        {qrStatus === "success" &&
                          `${qrQuoteCounter} carrier${qrQuoteCounter !== 1 ? "s" : ""} quoted${
                            qrExpiresAt
                              ? ` · saved rates, valid ${Math.max(
                                  0,
                                  Math.ceil(
                                    (new Date(qrExpiresAt).getTime() -
                                      Date.now()) /
                                      86400000
                                  )
                                )} more day${
                                  Math.ceil(
                                    (new Date(qrExpiresAt).getTime() -
                                      Date.now()) /
                                      86400000
                                  ) !== 1
                                    ? "s"
                                    : ""
                                }`
                              : " · checking for more…"
                          }`}
                        {qrStatus === "expired" &&
                          "These saved rates are over 30 days old — re-run for current pricing."}
                        {qrStatus === "error" &&
                          "Quote request failed — call us for a custom quote."}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {qrStatus === "idle" && (
                        <Button
                          size="sm"
                          onClick={startQuoteRush}
                          disabled={
                            !address ||
                            !rebuild ||
                            !isAuthenticated
                          }
                        >
                          Get Live Quotes
                        </Button>
                      )}
                      {(qrStatus === "starting" ||
                        qrStatus === "pending") && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="h-2.5 w-2.5 rounded-full bg-primary/50 animate-pulse" />
                          Working…
                        </div>
                      )}
                      {qrStatus === "success" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={refreshQuotes}
                          disabled={
                            qrRefreshing || !qrLeadId
                          }
                        >
                          {qrRefreshing
                            ? "Refreshing…"
                            : "Refresh"}
                        </Button>
                      )}
                      {(qrStatus === "expired" ||
                        qrStatus === "error") && (
                        <Button
                          size="sm"
                          onClick={startQuoteRush}
                        >
                          Re-run
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">

                  {/* Progress bar */}
                  {(qrStatus === "starting" ||
                    qrStatus === "pending") && (
                    <div className="mb-4 space-y-2">
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.min(
                              (qrElapsed / 600) * 100,
                              90
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        QuoteBot is logging into carrier websites and pulling real-time rates. This typically takes 2–5 minutes.
                      </p>
                    </div>
                  )}

                  {/* Not authenticated */}
                  {!isAuthenticated &&
                    qrStatus === "idle" && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Create a free account to get live carrier quotes from your Florida-appointed insurers.
                    </p>
                  )}

                  {/* Quotes (top 3) */}
                  {qrQuotes.length > 0 && (
                    <div className="space-y-2">
                      {qrQuotes.slice(0, 3).map((q, i) => (
                        <div
                          key={q.siteName + i}
                          className={`flex items-start justify-between p-3 rounded-lg border ${
                            i === 0
                              ? "border-yellow-300 bg-yellow-50"
                              : "border-border bg-muted/20"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-base mt-0.5">
                              {i === 0
                                ? "🥇"
                                : i === 1
                                ? "🥈"
                                : i === 2
                                ? "🥉"
                                : "•"}
                            </span>
                            <div>
                              <div className="text-sm font-semibold">
                                {q.siteName}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                                {q.hurricaneDeductible && (
                                  <div>
                                    Hurricane deductible:{" "}
                                    {q.hurricaneDeductible}
                                  </div>
                                )}
                                {q.aop && (
                                  <div>
                                    AOP deductible: {q.aop}
                                  </div>
                                )}
                                {q.coverageA > 0 && (
                                  <div>
                                    Coverage A:{" "}
                                    {new Intl.NumberFormat(
                                      "en-US",
                                      {
                                        style: "currency",
                                        currency: "USD",
                                        maximumFractionDigits: 0,
                                      }
                                    ).format(q.coverageA)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <div className="text-base font-bold font-mono text-primary">
                              {new Intl.NumberFormat(
                                "en-US",
                                {
                                  style: "currency",
                                  currency: "USD",
                                  maximumFractionDigits: 0,
                                }
                              ).format(q.annualPremium)}
                              /yr
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Intl.NumberFormat(
                                "en-US",
                                {
                                  style: "currency",
                                  currency: "USD",
                                  maximumFractionDigits: 0,
                                }
                              ).format(q.monthlyPremium)}
                              /mo
                            </div>
                            {q.quoteUrl && (
                              <a
                                href={q.quoteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary underline mt-1 block"
                              >
                                View quote →
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      {qrStatus === "pending" && (
                        <p className="text-xs text-muted-foreground text-center">
                          More quotes may still be arriving…
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground text-center leading-relaxed pt-1">
                        Real-time carrier rates via Tateo &amp; Co ·
                        Tateo Insurance Corp · License #L132640 ·
                        Not a binding quote. Coverage not effective
                        until confirmed by a licensed agent.
                      </p>
                    </div>
                  )}

                  {/* Error / no quotes fallback */}
                  {qrStatus === "error" &&
                    qrQuotes.length === 0 && (
                    <div className="text-center py-4 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        This property may need a custom quote.
                        Contact Tateo &amp; Co directly.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a href="tel:+18132148356">
                            (813) 214-8356
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a href="mailto:christian@tateoco.com">
                            Email Us
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>

              {/* Region insight */}
              <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-900 leading-relaxed">
                  <strong>{region.name}:</strong> {region.note}
                </p>
              </div>

              {/* Rate adjustments */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Applied Rate Adjustments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {[
                      { label: "Wind Mitigation",       effect: calc.windEffect },
                      { label: "Roof Age",              effect: calc.roofEffect },
                      { label: "Hurricane Deductible",  effect: calc.hurrEffect },
                      { label: "Construction Type",     effect: calc.constEffect },
                    ].map((item, i) => (
                      <div key={i}>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{item.label}</div>
                        <EffectBadge label={item.effect.label} dir={item.effect.dir} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>

          {/* Flood warning */}
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-900 leading-relaxed">
              <strong>Flood insurance is not included in this estimate.</strong> Properties in AE or VE flood zones require a separate NFIP or private flood policy — often $800–$3,500+/year depending on zone and elevation. Ask your agent about an elevation certificate to reduce flood premiums.
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center leading-relaxed pb-4">
            These are estimates only based on regional data, property characteristics, and standard assumptions. Results vary by specific property inspection and market availability. Not a binding quote. Coverage not effective until confirmed by a licensed agent. Tateo Insurance Corp (Company) - License #L132640. Paul Christian Tateo (Agent) - License #W142842.
          </p>

        </div>
      </div>
      )}

      {/* ── Lead capture dialog ── */}
      <LeadCaptureDialog
        open={leadDialogOpen}
        onOpenChange={setLeadDialogOpen}
        action={leadDialogAction}
        address={address}
        onSuccess={handleLeadSuccess}
      />

      {/* ── Add property dialog ── */}
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
                onChange={e => setNewScenarioAddress(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmNewScenario()}
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
