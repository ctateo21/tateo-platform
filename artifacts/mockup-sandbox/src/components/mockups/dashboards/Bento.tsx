import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation, useInView, useMotionValue, useSpring } from "framer-motion";
import { 
  Bell, Search, Plus, MapPin, 
  Home, FileText, Shield, ChevronRight,
  CheckCircle2, CircleDashed, Clock,
  ArrowUpRight, ArrowDownRight, Activity
} from "lucide-react";

// Google Font injection + Keyframes
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

  .bento-dashboard {
    font-family: 'Plus Jakarta Sans', sans-serif;
    background-color: #FAFAF9;
    color: #1c1917;
  }

  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }

  @keyframes kenburns {
    0% { transform: scale(1); }
    100% { transform: scale(1.05); }
  }
  .animate-kenburns {
    animation: kenburns 12s infinite alternate ease-in-out;
  }

  @keyframes pulse-dot {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-pulse-dot {
    animation: pulse-dot 1.6s infinite ease-in-out;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .animate-shimmer::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    animation: shimmer 1.5s infinite;
  }

  @keyframes noise-shift {
    0% { transform: translate(0, 0); }
    10% { transform: translate(-5%, -5%); }
    20% { transform: translate(-10%, 5%); }
    30% { transform: translate(5%, -10%); }
    40% { transform: translate(-5%, 15%); }
    50% { transform: translate(-10%, 5%); }
    60% { transform: translate(15%, 0); }
    70% { transform: translate(0, 10%); }
    80% { transform: translate(-15%, 0); }
    90% { transform: translate(10%, 5%); }
    100% { transform: translate(5%, 0); }
  }
  .bg-noise {
    position: fixed;
    top: -50%; left: -50%; right: -50%; bottom: -50%;
    width: 200%; height: 200%;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    opacity: 0.02;
    pointer-events: none;
    animation: noise-shift 8s steps(10) infinite;
    z-index: 0;
  }

  /* Custom scrollbar for sidebar */
  .sidebar-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .sidebar-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .sidebar-scroll::-webkit-scrollbar-thumb {
    background: #e7e5e4;
    border-radius: 4px;
  }
`;

// --- Data ---
type StatusType = "Qualified" | "Review" | "Action Needed" | "Loading";
type ScenarioType = "Purchase" | "Refinance" | "Insurance";

interface Scenario {
  id: string;
  address: string;
  city: string;
  type: ScenarioType;
  status: StatusType;
  price: number;
  monthly: number;
  rate: number;
  ltv: number;
  photoId: string;
  steps: { label: string; state: "done" | "active" | "pending" }[];
  history: number[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "1", address: "1428 Bay Point Dr", city: "Sarasota, FL 34236", type: "Purchase", status: "Qualified",
    price: 1250000, monthly: 6420, rate: 6.25, ltv: 80, photoId: "1568605114967-8130f3a36994",
    steps: [
      { label: "Pre-Approval Verified", state: "done" },
      { label: "Review Disclosures", state: "active" },
      { label: "Clear to Close", state: "pending" }
    ],
    history: [5200, 5800, 6100, 6300, 6420, 6420]
  },
  {
    id: "2", address: "804 S Delaware Ave", city: "Tampa, FL 33606", type: "Refinance", status: "Action Needed",
    price: 840000, monthly: 4150, rate: 5.875, ltv: 65, photoId: "1564013799919-ab600027ffc6",
    steps: [
      { label: "Appraisal Ordered", state: "done" },
      { label: "Upload W2s (2023)", state: "active" },
      { label: "Final Underwriting", state: "pending" }
    ],
    history: [4400, 4350, 4200, 4150, 4150, 4150]
  },
  {
    id: "3", address: "1905 N Orange Ave", city: "Orlando, FL 32804", type: "Insurance", status: "Review",
    price: 450000, monthly: 1850, rate: 0, ltv: 0, photoId: "1570129477492-45c003edd2be",
    steps: [
      { label: "Quote Requested", state: "done" },
      { label: "Review Policy Options", state: "active" },
      { label: "Bind Coverage", state: "pending" }
    ],
    history: [1600, 1750, 1800, 1850, 1850, 1850]
  },
  {
    id: "4", address: "5500 Gulf Blvd", city: "St. Pete Beach, FL 33706", type: "Purchase", status: "Qualified",
    price: 920000, monthly: 5100, rate: 6.125, ltv: 75, photoId: "1583608205776-bfd35f0d9f83",
    steps: [
      { label: "Contract Signed", state: "done" },
      { label: "Lock Rate", state: "active" },
      { label: "Schedule Closing", state: "pending" }
    ],
    history: [4800, 4950, 5000, 5100, 5100, 5100]
  },
  {
    id: "5", address: "Skeleton", city: "Loading...", type: "Purchase", status: "Loading",
    price: 0, monthly: 0, rate: 0, ltv: 0, photoId: "", steps: [], history: []
  }
];

// --- Components ---

function AnimatedNumber({ value, prefix = "", suffix = "", format = "number", decimals = 0 }: { value: number, prefix?: string, suffix?: string, format?: "number" | "currency", decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const springValue = useSpring(0, { bounce: 0, duration: 1200 });

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  useEffect(() => {
    return springValue.onChange((latest) => {
      setDisplayValue(latest);
    });
  }, [springValue]);

  const formatted = format === "currency" 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: decimals }).format(displayValue)
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(displayValue);

  return <span className="tabular-nums">{format === 'currency' ? formatted.replace('$', prefix + '$') : prefix + formatted + suffix}</span>;
}

export function Bento() {
  const [selectedId, setSelectedId] = useState<string>("1");
  const selectedScenario = SCENARIOS.find(s => s.id === selectedId) || SCENARIOS[0];

  return (
    <div className="bento-dashboard min-h-screen flex flex-col relative overflow-hidden text-stone-900">
      <style>{STYLES}</style>
      <div className="bg-noise" />

      {/* Top Bar */}
      <header className="h-16 border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <div className="font-bold text-xl tracking-tight text-blue-800">Tateo & Co.</div>
          <nav className="flex gap-6 text-sm font-medium">
            <a href="#" className="text-blue-700">Dashboard</a>
            <a href="#" className="text-stone-500 hover:text-stone-900 transition-colors">Compare</a>
            <a href="#" className="text-stone-500 hover:text-stone-900 transition-colors">Settings</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-stone-400" />
            <input type="text" placeholder="Find address..." className="pl-9 pr-4 py-1.5 bg-stone-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-600 outline-none w-48 transition-all" />
          </div>
          <motion.button 
            whileHover={{ scale: 0.98, y: -1 }}
            className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
          >
            <Plus className="w-4 h-4" />
          </motion.button>
          <div className="w-px h-6 bg-stone-200 mx-1" />
          <button className="relative p-2 text-stone-500 hover:text-stone-900 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white" />
          </button>
          <div className="w-8 h-8 rounded-full bg-stone-200 border-2 border-white shadow-sm overflow-hidden">
            <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Avatar" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* Portfolio Summary Strip */}
      <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-12 z-10 relative">
        <div className="flex flex-col">
          <span className="text-xs text-stone-500 font-medium uppercase tracking-wider">Active Scenarios</span>
          <span className="text-lg font-bold"><AnimatedNumber value={12} /></span>
        </div>
        <div className="w-px h-8 bg-stone-100" />
        <div className="flex flex-col">
          <span className="text-xs text-stone-500 font-medium uppercase tracking-wider">Pipeline Value</span>
          <span className="text-lg font-bold text-blue-700"><AnimatedNumber value={4250000} format="currency" /></span>
        </div>
        <div className="w-px h-8 bg-stone-100" />
        <div className="flex flex-col">
          <span className="text-xs text-stone-500 font-medium uppercase tracking-wider">Avg Est. Rate</span>
          <span className="text-lg font-bold"><AnimatedNumber value={6.12} decimals={2} suffix="%" /></span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden z-10 relative max-w-7xl mx-auto w-full">
        
        {/* Left Sidebar */}
        <div className="w-[32%] min-w-[380px] max-w-[420px] border-r border-stone-200 bg-stone-50/50 flex flex-col h-[calc(100vh-125px)]">
          <div className="p-4 border-b border-stone-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
            <h2 className="font-semibold">Recent Scenarios</h2>
            <button className="p-1.5 hover:bg-stone-200 rounded-md transition-colors"><Search className="w-4 h-4 text-stone-500" /></button>
          </div>
          
          <ul className="flex-1 overflow-y-auto sidebar-scroll p-3 space-y-2 pb-12">
            {SCENARIOS.map((scenario, i) => (
              <motion.li
                key={scenario.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className="relative"
              >
                {scenario.id === selectedId && (
                  <motion.div 
                    layoutId="selection"
                    className="absolute inset-0 bg-white shadow-sm border border-blue-100 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                
                {scenario.id === selectedId && (
                  <motion.div 
                    layoutId="selection-bar"
                    className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 rounded-r-full z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}

                {scenario.status === "Loading" ? (
                  <div className="relative z-10 p-3 flex gap-4 rounded-xl overflow-hidden animate-shimmer">
                    <div className="w-[72px] h-[72px] rounded-lg bg-stone-200 shrink-0" />
                    <div className="flex-1 py-1 space-y-2">
                      <div className="h-4 bg-stone-200 rounded w-3/4" />
                      <div className="h-3 bg-stone-200 rounded w-1/2" />
                      <div className="h-5 bg-stone-200 rounded-full w-20 mt-2" />
                    </div>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ y: -1, scale: 0.995 }}
                    onClick={() => setSelectedId(scenario.id)}
                    className="relative z-10 w-full text-left p-3 flex gap-3 rounded-xl transition-colors hover:bg-white/60 group"
                  >
                    <div className="w-[72px] h-[72px] rounded-lg overflow-hidden shrink-0 shadow-sm relative">
                      <img src={`https://images.unsplash.com/photo-${scenario.photoId}?w=150&q=80&fit=crop`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      {scenario.type === "Purchase" && <Home className="w-3 h-3 absolute bottom-1 right-1 text-white drop-shadow-md" />}
                      {scenario.type === "Refinance" && <FileText className="w-3 h-3 absolute bottom-1 right-1 text-white drop-shadow-md" />}
                      {scenario.type === "Insurance" && <Shield className="w-3 h-3 absolute bottom-1 right-1 text-white drop-shadow-md" />}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="font-semibold text-sm truncate pr-2 text-stone-900">{scenario.address}</span>
                        <span className="font-bold text-sm text-stone-900 tabular-nums">${scenario.monthly.toLocaleString()}/mo</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-stone-500 truncate">{scenario.city}</span>
                        {scenario.type === "Purchase" && <span className="text-[10px] font-medium text-stone-500">${(scenario.price/1000).toFixed(0)}k</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded">
                          {scenario.type}
                        </span>
                        
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          scenario.status === 'Qualified' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          scenario.status === 'Review' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            scenario.status === 'Qualified' ? 'bg-emerald-500' :
                            scenario.status === 'Review' ? 'bg-amber-500' :
                            'bg-rose-500 animate-pulse-dot'
                          }`} />
                          {scenario.status}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                )}
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Right Detail Panel (BENTO) */}
        <div className="flex-1 bg-stone-100/50 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedScenario.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="max-w-4xl mx-auto space-y-6"
            >
              
              {/* Header Info */}
              <div className="flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{selectedScenario.type} Scenario</span>
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border bg-white ${
                      selectedScenario.status === 'Qualified' ? 'text-emerald-700 border-emerald-100' :
                      selectedScenario.status === 'Review' ? 'text-amber-700 border-amber-100' :
                      'text-rose-700 border-rose-100'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        selectedScenario.status === 'Qualified' ? 'bg-emerald-500' :
                        selectedScenario.status === 'Review' ? 'bg-amber-500' :
                        'bg-rose-500 animate-pulse-dot'
                      }`} />
                      {selectedScenario.status}
                    </div>
                  </div>
                  <h1 className="text-3xl font-bold text-stone-900 tracking-tight">{selectedScenario.address}</h1>
                  <p className="text-stone-500 flex items-center gap-1 mt-1"><MapPin className="w-4 h-4" /> {selectedScenario.city}</p>
                </div>
                
                <motion.button 
                  whileHover={{ scale: 0.98, y: -1 }}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
                >
                  Edit Scenario <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>

              {/* BENTO GRID */}
              <div className="grid grid-cols-12 gap-4">
                
                {/* Hero Photo - Large Tile */}
                <motion.div 
                  whileHover={{ y: -2 }}
                  className="col-span-12 lg:col-span-8 rounded-2xl overflow-hidden bg-white shadow-sm border border-stone-200 relative aspect-video lg:aspect-auto h-64 lg:h-[320px] group"
                >
                  <img 
                    src={`https://images.unsplash.com/photo-${selectedScenario.photoId}?w=1200&q=80&fit=crop`} 
                    alt="Property" 
                    className="w-full h-full object-cover animate-kenburns"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                    <div className="text-white drop-shadow-md">
                      <p className="text-sm font-medium opacity-90 mb-1">Estimated Price</p>
                      <p className="text-3xl font-bold"><AnimatedNumber value={selectedScenario.price} format="currency" /></p>
                    </div>
                    <button className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-2 rounded-lg transition-colors border border-white/20">
                      <ArrowUpRight className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>

                {/* Est Monthly - Highlight Tile */}
                <motion.div 
                  whileHover={{ y: -2 }}
                  className="col-span-12 sm:col-span-6 lg:col-span-4 rounded-2xl bg-blue-700 text-white p-6 shadow-md relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Activity className="w-24 h-24" />
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm font-medium uppercase tracking-wider mb-1">Est. Monthly</p>
                    <div className="text-4xl font-bold tracking-tight mt-2 flex items-baseline gap-1">
                      <AnimatedNumber value={selectedScenario.monthly} format="currency" />
                      <span className="text-lg text-blue-300 font-normal">/mo</span>
                    </div>
                    <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-full text-xs font-medium border border-white/10">
                      <ArrowDownRight className="w-3 h-3 text-emerald-300" />
                      $120 below target
                    </div>
                  </div>
                  
                  <div className="mt-8 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-200">P&I</span>
                      <span className="font-medium"><AnimatedNumber value={selectedScenario.monthly * 0.7} format="currency" /></span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-200">Taxes & Ins</span>
                      <span className="font-medium"><AnimatedNumber value={selectedScenario.monthly * 0.3} format="currency" /></span>
                    </div>
                  </div>
                </motion.div>

                {/* Donut Chart - LTV Tile */}
                <motion.div 
                  whileHover={{ y: -2 }}
                  className="col-span-12 sm:col-span-6 lg:col-span-4 rounded-2xl bg-white p-6 shadow-sm border border-stone-200 flex items-center gap-6"
                >
                  <div className="relative w-24 h-24 shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#f5f5f4" strokeWidth="12" />
                      <motion.circle 
                        cx="50" cy="50" r="40" fill="none" stroke="#1d4ed8" strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray="251.2"
                        initial={{ strokeDashoffset: 251.2 }}
                        animate={{ strokeDashoffset: 251.2 - (251.2 * selectedScenario.ltv / 100) }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-xl font-bold tabular-nums text-stone-900"><AnimatedNumber value={selectedScenario.ltv} />%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500 font-medium uppercase tracking-wider mb-1">Target LTV</p>
                    <p className="text-2xl font-bold"><AnimatedNumber value={selectedScenario.price * (1 - selectedScenario.ltv/100)} format="currency" /></p>
                    <p className="text-xs text-stone-400 mt-1">Est. Down Payment</p>
                  </div>
                </motion.div>

                {/* Bar Chart - Projections Tile */}
                <motion.div 
                  whileHover={{ y: -2 }}
                  className="col-span-12 sm:col-span-6 lg:col-span-4 rounded-2xl bg-white p-6 shadow-sm border border-stone-200"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm text-stone-500 font-medium uppercase tracking-wider">Interest Rate</p>
                      <p className="text-2xl font-bold"><AnimatedNumber value={selectedScenario.rate} decimals={3} suffix="%" /></p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-stone-100 rounded text-stone-600 font-medium">30yr Fixed</span>
                  </div>
                  
                  <div className="h-20 flex items-end justify-between gap-2 mt-6">
                    {selectedScenario.history.map((val, i) => {
                      const max = Math.max(...selectedScenario.history);
                      const h = Math.max(20, (val / max) * 100);
                      return (
                        <div key={i} className="w-full flex flex-col items-center gap-2 group cursor-pointer relative">
                          {/* Tooltip */}
                          <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-800 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10">
                            ${val}
                          </div>
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ duration: 0.8, delay: 0.3 + i * 0.1, type: "spring", bounce: 0.2 }}
                            className={`w-full rounded-sm ${i === selectedScenario.history.length - 1 ? 'bg-blue-600' : 'bg-stone-200 group-hover:bg-blue-300 transition-colors'}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                </motion.div>

                {/* Workflow Tile */}
                <motion.div 
                  whileHover={{ y: -2 }}
                  className="col-span-12 sm:col-span-6 lg:col-span-4 rounded-2xl bg-white p-6 shadow-sm border border-stone-200"
                >
                  <p className="text-sm text-stone-500 font-medium uppercase tracking-wider mb-4">Next Steps</p>
                  <div className="space-y-4">
                    {selectedScenario.steps.map((step, i) => (
                      <div key={i} className="flex gap-3 relative">
                        {i !== selectedScenario.steps.length - 1 && (
                          <div className="absolute left-2.5 top-6 bottom-[-16px] w-px bg-stone-200" />
                        )}
                        <div className="relative z-10 bg-white">
                          {step.state === 'done' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> :
                           step.state === 'active' ? <CircleDashed className="w-5 h-5 text-blue-600 animate-spin-slow" style={{ animationDuration: '3s' }} /> :
                           <div className="w-5 h-5 rounded-full border-2 border-stone-200" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${step.state === 'done' ? 'text-stone-500 line-through' : step.state === 'active' ? 'text-blue-900' : 'text-stone-400'}`}>
                            {step.label}
                          </p>
                          {step.state === 'active' && (
                            <button className="mt-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors">
                              Complete Action
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
