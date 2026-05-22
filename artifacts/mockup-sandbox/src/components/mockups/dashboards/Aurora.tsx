import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { 
  Bell, 
  MapPin, 
  Search, 
  Plus, 
  Home, 
  Building, 
  ShieldCheck, 
  CheckCircle2, 
  Circle, 
  Clock, 
  ArrowRight,
  ChevronRight
} from "lucide-react";
import "./aurora/aurora.css";

const SCENARIOS = [
  {
    id: "1",
    address: "1244 Bayshore Blvd",
    city: "Tampa, FL 33606",
    type: "Purchase",
    price: 1250000,
    monthly: 6500,
    status: "Qualified",
    rate: 6.5,
    ltv: 80,
    photo: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800",
  },
  {
    id: "2",
    address: "8801 Midnight Pass Rd",
    city: "Sarasota, FL 34242",
    type: "Refinance",
    price: 850000,
    monthly: 4200,
    status: "Action Needed",
    rate: 5.875,
    ltv: 75,
    photo: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
  },
  {
    id: "3",
    address: "411 N Eola Dr",
    city: "Orlando, FL 32801",
    type: "Purchase",
    price: 595000,
    monthly: 3100,
    status: "Review",
    rate: 6.75,
    ltv: 90,
    photo: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
  },
  {
    id: "4",
    address: "230 Sarasota Surf",
    city: "Sarasota, FL 34236",
    type: "Insurance",
    price: 1100000,
    monthly: 1800,
    status: "Qualified",
    rate: 0,
    ltv: 0,
    photo: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800",
  },
  {
    id: "5",
    address: "800 N Tampa St",
    city: "Tampa, FL 33602",
    type: "Purchase",
    price: 920000,
    monthly: 5400,
    status: "Qualified",
    rate: 6.25,
    ltv: 85,
    photo: "https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=800",
  }
];

function AnimatedNumber({ value, format, prefix = "", suffix = "" }: { value: number, format: (v: number) => string, prefix?: string, suffix?: string }) {
  const val = useMotionValue(0);
  const formatted = useTransform(val, (latest) => prefix + format(latest) + suffix);

  useEffect(() => {
    const controls = animate(val, value, { duration: 1.2, ease: "easeOut" });
    return controls.stop;
  }, [val, value]);

  return <motion.span className="tabular-nums">{formatted}</motion.span>;
}

const formatCurrency = (v: number) => Math.round(v).toLocaleString();
const formatCurrencyCompact = (v: number) => {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return (v / 1000).toFixed(0) + "K";
  return v.toString();
};
const formatPercent = (v: number) => v.toFixed(2);

export function Aurora() {
  const [selectedId, setSelectedId] = useState(SCENARIOS[0].id);
  const selectedScenario = SCENARIOS.find(s => s.id === selectedId) || SCENARIOS[0];

  return (
    <div className="min-h-screen font-jakarta text-slate-900 flex flex-col relative w-full overflow-hidden">
      {/* Ambient Aurora Background */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1"></div>
        <div className="aurora-blob aurora-blob-2"></div>
        <div className="aurora-blob aurora-blob-3"></div>
      </div>

      {/* Top Bar */}
      <header className="glass-panel border-b border-white/40 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-8">
          <div className="text-xl font-bold tracking-tight text-blue-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center font-black">
              T
            </div>
            Tateo & Co
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-500">
            <a href="#" className="text-blue-700">Dashboard</a>
            <a href="#" className="hover:text-slate-800 transition-colors">Compare</a>
            <a href="#" className="hover:text-slate-800 transition-colors">Settings</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search addresses..." 
              className="pl-9 pr-4 py-2 rounded-full bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm w-64 placeholder:text-slate-400"
            />
          </div>
          <motion.button 
            whileHover={{ scale: 0.98, y: -1 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg shadow-blue-700/20 hover:shadow-blue-700/40 transition-shadow"
          >
            <Plus className="w-4 h-4" />
            Add
          </motion.button>
          <div className="w-px h-6 bg-slate-200 mx-2"></div>
          <button className="relative text-slate-500 hover:text-slate-800 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
          </button>
          <div className="w-9 h-9 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden ml-2">
            <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop" alt="Avatar" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* Portfolio Summary Strip */}
      <div className="px-6 py-5 border-b border-white/30 bg-white/20 backdrop-blur-md flex items-center gap-12 z-10">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Active Scenarios</span>
          <div className="text-2xl font-bold text-slate-800">
            <AnimatedNumber value={5} format={v => Math.round(v).toString()} />
          </div>
        </div>
        <div className="w-px h-10 bg-slate-200/60"></div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Pipeline Value</span>
          <div className="text-2xl font-bold text-slate-800">
            <AnimatedNumber value={4715000} format={formatCurrencyCompact} prefix="$" />
          </div>
        </div>
        <div className="w-px h-10 bg-slate-200/60"></div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Avg Est. Rate</span>
          <div className="text-2xl font-bold text-slate-800">
            <AnimatedNumber value={6.25} format={formatPercent} suffix="%" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden z-10 max-w-[1600px] w-full mx-auto">
        
        {/* Left Sidebar */}
        <aside className="w-[410px] shrink-0 border-r border-white/40 overflow-y-auto p-4 flex flex-col gap-3">
          <AnimatePresence>
            {SCENARIOS.map((scenario, index) => {
              const isSelected = scenario.id === selectedId;
              
              return (
                <motion.div
                  key={scenario.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 + 0.1, duration: 0.4, ease: "easeOut" }}
                  onClick={() => setSelectedId(scenario.id)}
                  whileHover={{ y: -1, scale: 1.01 }}
                  className={`relative p-3 rounded-2xl cursor-pointer transition-colors ${
                    isSelected ? 'glass-panel-strong' : 'glass-panel hover:bg-white/80'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="sidebar-selection"
                      className="absolute inset-0 rounded-2xl border-2 border-blue-600/30 bg-blue-50/30 z-[-1]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  {isSelected && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-blue-600 rounded-r-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}

                  <div className="flex gap-4 items-center pl-2">
                    <div className="w-[72px] h-[72px] rounded-xl overflow-hidden shrink-0 shadow-sm relative">
                      <img src={scenario.photo} alt={scenario.address} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex justify-between items-start mb-0.5">
                        <h3 className="font-semibold text-slate-900 truncate text-base">{scenario.address}</h3>
                        <span className="font-bold text-slate-900 tabular-nums">
                          ${formatCurrency(scenario.monthly)}<span className="text-xs text-slate-400 font-normal">/mo</span>
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 truncate mb-2">{scenario.city}</p>
                      
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-medium flex items-center gap-1.5 border border-slate-200/50">
                          {scenario.type === 'Purchase' && <Home className="w-3 h-3" />}
                          {scenario.type === 'Refinance' && <Building className="w-3 h-3" />}
                          {scenario.type === 'Insurance' && <ShieldCheck className="w-3 h-3" />}
                          {scenario.type}
                        </span>
                        
                        <div className={`px-2 py-0.5 rounded-full border text-[11px] font-medium flex items-center gap-1.5 ml-auto ${
                          scenario.status === 'Qualified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' :
                          scenario.status === 'Review' ? 'bg-amber-50 text-amber-700 border-amber-200/50' :
                          'bg-rose-50 text-rose-700 border-rose-200/50'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            scenario.status === 'Qualified' ? 'bg-emerald-500' :
                            scenario.status === 'Review' ? 'bg-amber-500' :
                            'bg-rose-500 pulse-dot'
                          }`}></div>
                          {scenario.status}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            
            {/* Loading Skeleton Row */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 6 * 0.06 + 0.1, duration: 0.4 }}
              className="glass-panel p-3 rounded-2xl relative overflow-hidden flex gap-4 items-center pl-4"
            >
              <div className="absolute inset-0 shimmer-bg opacity-30 z-0"></div>
              <div className="w-[72px] h-[72px] rounded-xl bg-slate-200/60 shrink-0 relative z-10"></div>
              <div className="flex-1 flex flex-col gap-2 relative z-10">
                <div className="h-5 w-3/4 bg-slate-200/60 rounded"></div>
                <div className="h-4 w-1/2 bg-slate-200/50 rounded mb-1"></div>
                <div className="flex gap-2">
                  <div className="h-5 w-20 bg-slate-200/50 rounded"></div>
                  <div className="h-5 w-24 bg-slate-200/50 rounded ml-auto"></div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </aside>

        {/* Right Detail Panel */}
        <section className="flex-1 p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: "circOut" }}
              className="max-w-4xl mx-auto"
            >
              
              <header className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold border border-blue-200/50 shadow-sm">
                    {selectedScenario.type} Scenario
                  </span>
                  <div className={`px-3 py-1 rounded-lg border text-sm font-semibold flex items-center gap-2 shadow-sm ${
                    selectedScenario.status === 'Qualified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    selectedScenario.status === 'Review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      selectedScenario.status === 'Qualified' ? 'bg-emerald-500' :
                      selectedScenario.status === 'Review' ? 'bg-amber-500' :
                      'bg-rose-500 pulse-dot'
                    }`}></div>
                    {selectedScenario.status}
                  </div>
                </div>
                
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                  {selectedScenario.address}
                </h1>
                <p className="text-lg text-slate-500 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  {selectedScenario.city}
                </p>
              </header>

              <div className="w-full aspect-[16/7] rounded-3xl overflow-hidden mb-8 shadow-xl shadow-slate-200/50 border border-white/60 relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent z-10"></div>
                <img 
                  src={selectedScenario.photo} 
                  alt={selectedScenario.address} 
                  className="w-full h-full object-cover ken-burns" 
                />
              </div>

              <div className="glass-panel-strong rounded-3xl p-8 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/3"></div>
                
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center justify-between">
                  Scenario Overview
                  <motion.button 
                    whileHover={{ scale: 0.98 }}
                    className="text-sm text-blue-700 font-semibold px-4 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors"
                  >
                    Edit Parameters
                  </motion.button>
                </h2>
                
                <div className="grid grid-cols-4 gap-6">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-500">Est. Price</span>
                    <span className="text-3xl font-bold text-slate-800 tabular-nums">
                      $<AnimatedNumber value={selectedScenario.price} format={formatCurrency} />
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 border-l border-slate-200/60 pl-6">
                    <span className="text-sm font-medium text-slate-500">Interest Rate</span>
                    <span className="text-3xl font-bold text-slate-800 tabular-nums">
                      {selectedScenario.rate > 0 ? <AnimatedNumber value={selectedScenario.rate} format={formatPercent} /> : "N/A"}
                      {selectedScenario.rate > 0 && <span className="text-xl text-slate-500 ml-1">%</span>}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 border-l border-slate-200/60 pl-6">
                    <span className="text-sm font-medium text-slate-500">Target LTV</span>
                    <span className="text-3xl font-bold text-slate-800 tabular-nums">
                      {selectedScenario.ltv > 0 ? <AnimatedNumber value={selectedScenario.ltv} format={v => Math.round(v).toString()} /> : "N/A"}
                      {selectedScenario.ltv > 0 && <span className="text-xl text-slate-500 ml-1">%</span>}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 border-l border-slate-200/60 pl-6 relative">
                    <div className="absolute inset-0 bg-blue-50/50 rounded-xl -m-4 p-4 z-[-1]"></div>
                    <span className="text-sm font-bold text-blue-700">Est. Monthly</span>
                    <span className="text-4xl font-black text-blue-700 tabular-nums tracking-tight">
                      $<AnimatedNumber value={selectedScenario.monthly} format={formatCurrency} />
                    </span>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-8">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Next Steps</h2>
                
                <div className="flex flex-col gap-6 relative">
                  <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-200"></div>
                  
                  <div className="flex gap-4 relative z-10 opacity-60">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 border border-emerald-200 text-emerald-600">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-800">Initial Prequalification</h4>
                      <p className="text-sm text-slate-500 mt-1">Soft credit pull and income estimation completed.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 relative z-10">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 border-2 border-white shadow-md shadow-blue-500/30 text-white">
                      <Circle className="w-3 h-3 fill-current" />
                    </div>
                    <div className="flex-1 bg-white/60 p-5 rounded-2xl border border-blue-100 shadow-sm backdrop-blur-sm">
                      <h4 className="text-base font-bold text-blue-900">Upload Documents</h4>
                      <p className="text-sm text-slate-600 mt-1 mb-4">We need your latest pay stubs and bank statements to finalize the approval.</p>
                      <motion.button 
                        whileHover={{ scale: 0.98, y: -1 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-700/20 hover:shadow-blue-700/40 transition-shadow"
                      >
                        Start Upload <ArrowRight className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>

                  <div className="flex gap-4 relative z-10 opacity-50">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 text-slate-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-800">Finalize Terms</h4>
                      <p className="text-sm text-slate-500 mt-1">Lock in the rate and generate the official Loan Estimate.</p>
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          </AnimatePresence>
        </section>

      </main>
    </div>
  );
}
