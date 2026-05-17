import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Shield, MapPin, Home, AlertTriangle, Info, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Link } from "wouter";
import { getCountyName } from "@/lib/county-tax-estimator";

// ─── Data ────────────────────────────────────────────────────────────────────

type RegionKey = "keys" | "sefl" | "swfl" | "tampa" | "nefljax" | "central" | "ncfl";

interface Region {
  name: string;
  counties: string;
  low: number;
  high: number;
  tier: string;
  tierColor: string;
  note: string;
}

const REGIONS: Record<RegionKey, Region> = {
  keys:    { name: "Keys / Barrier Islands",        counties: "Monroe, barrier islands",                          low: 0.0495, high: 0.0665, tier: "Extreme",  tierColor: "bg-red-100 text-red-800",    note: "Extreme hurricane surge risk, very limited reinsurance appetite, and a small pool of insurable units produce premiums unlike anywhere else in the state. Most major carriers have exited this market." },
  sefl:    { name: "SE FL Coastal",                 counties: "Miami-Dade, Broward, Palm Beach",                  low: 0.0233, high: 0.0407, tier: "High",     tierColor: "bg-orange-100 text-orange-800", note: "Hurricane exposure, high rebuild costs, and older housing stock define this market. Miami-Dade, Broward, and Palm Beach are among the most expensive mainland ZIP codes in the U.S." },
  swfl:    { name: "SW FL Coastal",                 counties: "Lee, Collier, Charlotte",                          low: 0.0134, high: 0.0207, tier: "High",     tierColor: "bg-orange-100 text-orange-800", note: "Post-Hurricane Ian reinsurance pricing continues to elevate rates across Lee, Collier, and Charlotte counties. Barrier island properties run significantly higher than the county average." },
  tampa:   { name: "Tampa Bay Area",                counties: "Hillsborough, Pinellas, Pasco",                   low: 0.0110, high: 0.0170, tier: "Mod-High", tierColor: "bg-yellow-100 text-yellow-800", note: "Growing storm risk recognition, high population density, and significant flood zone coverage in low-lying areas push rates above Central Florida. Pinellas peninsula properties carry the highest exposure within this region." },
  nefljax: { name: "NE FL / Jacksonville",          counties: "Duval, Clay, St. Johns, Flagler",                  low: 0.0080, high: 0.0127, tier: "Moderate", tierColor: "bg-blue-100 text-blue-800",   note: "Moderate coastal exposure with better carrier availability than South Florida. St. Johns County waterfront properties trend toward the upper end; inland Duval and Clay closer to the lower bound." },
  central: { name: "Central FL Inland",             counties: "Orange, Osceola, Polk, Seminole",                  low: 0.0078, high: 0.0122, tier: "Moderate", tierColor: "bg-blue-100 text-blue-800",   note: "Shielded from direct coastal wind, though sinkhole risk in parts of Polk adds cost. Good carrier availability and the lowest hurricane deductibles of any Florida coastal-adjacent region." },
  ncfl:    { name: "North-Central FL Inland",       counties: "Alachua, Marion, Sumter, Lake, Columbia",           low: 0.0054, high: 0.0080, tier: "Low",      tierColor: "bg-green-100 text-green-800",  note: "Consistently the lowest rates in Florida. These counties sit 60+ miles from the coast, dramatically limiting hurricane exposure. Strong carrier competition keeps premiums in check." },
};

const REGION_TABLE: { key: RegionKey; label: string; counties: string; rateRange: string }[] = [
  { key: "keys",    label: "Keys / Barrier Islands",   counties: "Monroe, barrier islands",             rateRange: "4.95% – 6.65%" },
  { key: "sefl",    label: "SE FL Coastal",             counties: "Miami-Dade, Broward, Palm Beach",     rateRange: "2.33% – 4.07%" },
  { key: "swfl",    label: "SW FL Coastal",             counties: "Lee, Collier, Charlotte",             rateRange: "1.34% – 2.07%" },
  { key: "tampa",   label: "Tampa Bay",                 counties: "Hillsborough, Pinellas, Pasco",       rateRange: "1.10% – 1.70%" },
  { key: "nefljax", label: "NE FL / Jacksonville",      counties: "Duval, Clay, St. Johns, Flagler",     rateRange: "0.80% – 1.27%" },
  { key: "central", label: "Central FL Inland",         counties: "Orange, Osceola, Polk, Seminole",     rateRange: "0.78% – 1.22%" },
  { key: "ncfl",    label: "North-Central FL Inland",   counties: "Alachua, Marion, Sumter, Lake",       rateRange: "0.54% – 0.80%" },
];

const ROOF_ADJ  = [0.90, 1.00, 1.20, 1.38];
const WIND_ADJ  = [1.14, 1.00, 0.82];
const HURR_ADJ  = [1.10, 1.05, 1.00];
const CONST_ADJ = [0.93, 1.00, 1.08];
const YEAR_ADJ  = [0.90, 1.00, 1.10, 1.28];
const CLAIM_ADJ = [1.00, 1.14, 1.26, 1.40];

const MODIFIERS = [
  { factor: "Roof 0–5 years",           adjustment: "−10% to −20%",    dir: "save" },
  { factor: "Roof 6–10 years",           adjustment: "Baseline",         dir: "neutral" },
  { factor: "Roof 11–15 years",          adjustment: "+10% to +25%",    dir: "cost" },
  { factor: "Roof 16+ years",            adjustment: "+25% to +75%",    dir: "cost" },
  { factor: "Masonry / block (CBS)",     adjustment: "−5% to −15%",     dir: "save" },
  { factor: "Frame construction",        adjustment: "+10% to +30%",    dir: "cost" },
  { factor: "Wind mitigation credits",   adjustment: "−10% to −40%",    dir: "save" },
  { factor: "Hip roof",                  adjustment: "−5% to −15%",     dir: "save" },
  { factor: "No opening protection",     adjustment: "+10% to +25%",    dir: "cost" },
  { factor: "Coastal ZIP / barrier isl.", adjustment: "+25% to +100%",  dir: "cost" },
  { factor: "AE / VE flood zone",        adjustment: "Separate flood policy required", dir: "neutral" },
];

// ─── Region detection from address ────────────────────────────────────────────

const COUNTY_TO_REGION: Record<string, RegionKey> = {
  "monroe": "keys",
  "miami-dade": "sefl", "broward": "sefl", "palm beach": "sefl",
  "lee": "swfl", "collier": "swfl", "charlotte": "swfl",
  "hillsborough": "tampa", "pinellas": "tampa", "pasco": "tampa", "hernando": "tampa",
  "duval": "nefljax", "clay": "nefljax", "st. johns": "nefljax", "st johns": "nefljax", "flagler": "nefljax", "nassau": "nefljax",
  "orange": "central", "osceola": "central", "polk": "central", "seminole": "central", "lake": "central", "volusia": "central",
  "alachua": "ncfl", "marion": "ncfl", "sumter": "ncfl", "columbia": "ncfl", "putnam": "ncfl",
  "manatee": "swfl", "sarasota": "swfl",
  "brevard": "central", "indian river": "central", "st. lucie": "sefl", "martin": "sefl",
  "okaloosa": "nefljax", "santa rosa": "nefljax", "escambia": "nefljax",
  "leon": "ncfl", "gadsden": "ncfl", "wakulla": "ncfl",
};

function getRegionFromAddress(address: string): RegionKey {
  const county = getCountyName(address);
  if (county && COUNTY_TO_REGION[county]) return COUNTY_TO_REGION[county];
  return "tampa";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) { return "$" + Math.round(n).toLocaleString(); }
function fmtK(n: number) { return n >= 1_000_000 ? "$" + (n / 1_000_000).toFixed(1) + "M" : "$" + Math.round(n / 1000) + "K"; }

// ─── Slider component ─────────────────────────────────────────────────────────

function SliderRow({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  function startEdit() {
    setRaw(String(value));
    setEditing(true);
  }
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
            autoFocus
            type="text"
            value={raw}
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
        type="range"
        min={min} max={max} step={step} value={value}
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
  const params = new URLSearchParams(search);
  const address = params.get("address") || "";

  const detectedRegion = address ? getRegionFromAddress(address) : "tampa";

  const [regionKey, setRegionKey] = useState<RegionKey>(detectedRegion);
  const [rebuild, setRebuild] = useState(400000);
  const [roofIdx, setRoofIdx] = useState(1);
  const [windIdx, setWindIdx] = useState(1);
  const [hurrIdx, setHurrIdx] = useState(0);
  const [constIdx, setConstIdx] = useState(0);
  const [yearIdx, setYearIdx] = useState(1);
  const [claimsIdx, setClaimsIdx] = useState(0);

  const calc = useMemo(() => {
    const region = REGIONS[regionKey];
    const adj = ROOF_ADJ[roofIdx] * WIND_ADJ[windIdx] * HURR_ADJ[hurrIdx] * CONST_ADJ[constIdx] * YEAR_ADJ[yearIdx] * CLAIM_ADJ[claimsIdx];
    const lowRate  = region.low  * adj;
    const highRate = region.high * adj;
    const midRate  = (lowRate + highRate) / 2;
    const hurrDeductiblePct = [0.02, 0.03, 0.05][hurrIdx];
    return {
      low: rebuild * lowRate,
      mid: rebuild * midRate,
      high: rebuild * highRate,
      monthly: rebuild * midRate / 12,
      hurrDeductible: rebuild * hurrDeductiblePct,
      hurrPct: hurrDeductiblePct * 100,
      adj,
      windEffect: windIdx === 2 ? { label: "−18%", dir: "save" } : windIdx === 0 ? { label: "+14%", dir: "cost" } : { label: "Baseline", dir: "neutral" },
      roofEffect: roofIdx === 0 ? { label: "−10%", dir: "save" } : roofIdx === 1 ? { label: "Baseline", dir: "neutral" } : roofIdx === 2 ? { label: "+20%", dir: "cost" } : { label: "+38%", dir: "cost" },
      hurrEffect: hurrIdx === 0 ? { label: "Standard (2%)", dir: "neutral" } : hurrIdx === 1 ? { label: "−5% vs 2%", dir: "save" } : { label: "−10% vs 2%", dir: "save" },
      constEffect: constIdx === 0 ? { label: "−7%", dir: "save" } : constIdx === 2 ? { label: "+8%", dir: "cost" } : { label: "Baseline", dir: "neutral" },
    };
  }, [regionKey, rebuild, roofIdx, windIdx, hurrIdx, constIdx, yearIdx, claimsIdx]);

  const region = REGIONS[regionKey];

  function EffectBadge({ label, dir }: { label: string; dir: string }) {
    if (dir === "save") return <span className="inline-flex items-center gap-1 text-green-700 font-semibold text-sm"><TrendingDown className="h-3.5 w-3.5" />{label}</span>;
    if (dir === "cost") return <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-sm"><TrendingUp className="h-3.5 w-3.5" />{label}</span>;
    return <span className="inline-flex items-center gap-1 text-muted-foreground text-sm"><Minus className="h-3.5 w-3.5" />{label}</span>;
  }

  return (
    <>
      <Helmet><title>Insurance Estimate — Tateo & Co</title></Helmet>

      {/* ── Page header ── */}
      <div className="bg-primary text-white">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center gap-4 flex-wrap">
          <Link href={`/select-service${address ? `?address=${encodeURIComponent(address)}` : ""}`}>
            <button className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-white/80" />
            <span className="font-semibold text-lg">Florida Homeowners Insurance Estimator</span>
          </div>
          {address && (
            <div className="ml-auto flex items-center gap-1.5 text-white/70 text-sm">
              <MapPin className="h-4 w-4" />
              <span className="truncate max-w-xs">{address}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ── Region note ── */}
        {address && (
          <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <Info className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
            <p className="text-sm text-emerald-800">
              <strong>Auto-detected region:</strong> {region.name} — {region.counties}. Adjust below if needed.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">

          {/* ── LEFT: Inputs ── */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" /> Property Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

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

            </CardContent>
          </Card>

          {/* ── RIGHT: Results ── */}
          <div className="space-y-5 lg:sticky lg:top-4">

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

            {/* Region insight */}
            <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-900 leading-relaxed">
                <strong>{region.name}:</strong> {region.note}
              </p>
            </div>

            {/* Rate adjustments applied */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Applied Rate Adjustments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    { label: "Wind Mitigation", effect: calc.windEffect },
                    { label: "Roof Age",        effect: calc.roofEffect },
                    { label: "Hurricane Deductible", effect: calc.hurrEffect },
                    { label: "Construction Type",    effect: calc.constEffect },
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

        {/* ── Flood warning ── */}
        <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900 leading-relaxed">
            <strong>Flood insurance is not included in this estimate.</strong> Properties in AE or VE flood zones require a separate NFIP or private flood policy — often $800–$3,500+/year depending on zone and elevation. Ask your agent about an elevation certificate to reduce flood premiums.
          </p>
        </div>

        {/* ── Disclaimer ── */}
        <p className="text-xs text-muted-foreground text-center leading-relaxed pb-4">
          Data sourced from FL OIR CHOICES filings, Insure.com, Insurance.com, Greene & Associates, Broker One (2026).
          Estimates are for planning purposes only. Actual premiums depend on carrier underwriting, credit score,
          specific property inspection, and market availability. Not a binding quote.
        </p>

      </div>
    </>
  );
}
