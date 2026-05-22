import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { Bell, MapPin, Search, Plus, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import "./pulse/pulse.css";

const SCENARIOS = [
  {
    id: "s1",
    type: "Purchase",
    address: "1248 Bayshore Blvd",
    location: "Tampa, FL 33606",
    price: 1250000,
    monthly: 6540,
    rate: 6.25,
    ltv: 80,
    status: "Qualified",
    photo: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",
    steps: [
      { id: 1, label: "Credit & Income Verified", state: "done" },
      { id: 2, label: "Review Rate Options", state: "active" },
      { id: 3, label: "Submit Pre-Approval", state: "pending" }
    ]
  },
  {
    id: "s2",
    type: "Refinance",
    address: "4920 Ocean Blvd",
    location: "Sarasota, FL 34242",
    price: 850000,
    monthly: 4120,
    rate: 5.875,
    ltv: 65,
    status: "Action Needed",
    photo: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80",
    steps: [
      { id: 1, label: "Appraisal Received", state: "done" },
      { id: 2, label: "Upload Missing Documents", state: "active" },
      { id: 3, label: "Clear to Close", state: "pending" }
    ]
  },
  {
    id: "s3",
    type: "Insurance",
    address: "8831 Lake Nona Dr",
    location: "Orlando, FL 32827",
    price: 620000,
    monthly: 1850,
    rate: 0, // N/A
    ltv: 0,
    status: "Review",
    photo: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80",
    steps: [
      { id: 1, label: "Quote Requested", state: "done" },
      { id: 2, label: "Review Bind Options", state: "active" },
      { id: 3, label: "Activate Policy", state: "pending" }
    ]
  },
  {
    id: "s4",
    type: "Purchase",
    address: "3301 S MacDill Ave",
    location: "Tampa, FL 33629",
    price: 450000,
    monthly: 2950,
    rate: 6.5,
    ltv: 90,
    status: "Qualified",
    photo: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80",
    steps: [
      { id: 1, label: "Initial Application", state: "done" },
      { id: 2, label: "Lock Interest Rate", state: "active" },
      { id: 3, label: "Final Approval", state: "pending" }
    ]
  }
];

function CountUp({ value, prefix = "", suffix = "", decimals = 0 }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v)
    });
    return controls.stop;
  }, [value]);

  const formatted = Number(display).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return <span className="tabular-nums">{prefix}{formatted}{suffix}</span>;
}

const Sparkline = () => {
  return (
    <div className="h-8 w-16 relative flex items-center">
      <svg viewBox="0 0 100 30" className="w-full h-full stroke-blue-600 stroke-2 fill-transparent overflow-visible">
        <motion.path
          d="M 0 25 C 20 25, 30 15, 50 15 C 70 15, 80 5, 100 5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
        />
        <motion.circle
          cx="100"
          cy="5"
          r="3"
          className="fill-blue-600 stroke-none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 2, duration: 0.3 }}
        />
      </svg>
    </div>
  );
};

export function Pulse() {
  const [selectedId, setSelectedId] = useState(SCENARIOS[0].id);
  const selected = SCENARIOS.find(s => s.id === selectedId);

  return (
    <div className="pulse-wrapper w-full min-h-screen bg-stone-50 text-slate-900 overflow-hidden relative font-sans">
      <div className="ambient-bg absolute inset-0 z-0 pointer-events-none opacity-60 mix-blend-multiply"></div>
      
      {/* Top Bar */}
      <div className="relative z-10 w-full h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <div className="font-bold text-xl tracking-tight text-slate-900">
            Tateo <span className="text-slate-400 font-normal">&amp; Co</span>
          </div>
          <nav className="flex gap-6 text-sm font-medium">
            <span className="text-blue-700 cursor-pointer">Dashboard</span>
            <span className="text-slate-500 hover:text-slate-900 cursor-pointer transition-colors">Compare</span>
            <span className="text-slate-500 hover:text-slate-900 cursor-pointer transition-colors">Settings</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search address..." 
              className="pl-9 pr-4 py-1.5 bg-slate-100 border border-transparent rounded-full text-sm focus:outline-none focus:bg-white focus:border-blue-200 focus:ring-2 focus:ring-blue-100 transition-all w-64"
            />
          </div>
          <motion.button 
            whileHover={{ scale: 0.98, y: -1 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-700/20"
          >
            <Plus className="w-5 h-5" />
          </motion.button>
          <div className="w-px h-6 bg-slate-200"></div>
          <button className="relative text-slate-500 hover:text-slate-700">
            <Bell className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
            <img src="https://ui-avatars.com/api/?name=User&background=cbd5e1&color=475569" alt="User" />
          </div>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="relative z-10 w-full bg-white border-b border-slate-200 px-6 py-4 flex gap-12 items-center">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Active Scenarios</div>
          <div className="text-2xl font-bold text-slate-900"><CountUp value={14} /></div>
        </div>
        <div className="w-px h-8 bg-slate-100"></div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Pipeline Value</div>
          <div className="text-2xl font-bold text-slate-900"><CountUp value={8450000} prefix="$" /></div>
        </div>
        <div className="w-px h-8 bg-slate-100"></div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Avg Est. Rate</div>
          <div className="text-2xl font-bold text-slate-900"><CountUp value={6.125} suffix="%" decimals={3} /></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto p-6 flex gap-6 h-[calc(100vh-140px)]">
        
        {/* Sidebar */}
        <div className="w-[410px] shrink-0 flex flex-col gap-3 overflow-y-auto pb-12 pr-2">
          {SCENARIOS.map((scenario, i) => {
            const isSelected = scenario.id === selectedId;
            return (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                whileHover={{ y: -1, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)" }}
                onClick={() => setSelectedId(scenario.id)}
                className="relative bg-white rounded-xl p-3 flex gap-4 cursor-pointer border border-slate-100 transition-colors"
              >
                {isSelected && (
                  <motion.div 
                    layoutId="sidebar-selection"
                    className="absolute inset-0 rounded-xl border-2 border-blue-600 bg-blue-50/30 z-0"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                <div className="relative z-10 w-[72px] h-[72px] rounded-lg overflow-hidden shrink-0">
                  <img src={scenario.photo} alt="Property" className="w-full h-full object-cover" />
                </div>
                
                <div className="relative z-10 flex-1 min-w-0 py-0.5 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="truncate">
                      <div className="font-semibold text-slate-900 text-sm truncate">{scenario.address}</div>
                      <div className="text-xs text-slate-500 truncate">{scenario.location}</div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="font-bold text-slate-900 text-sm tabular-nums">
                        ${scenario.monthly > 0 ? scenario.monthly.toLocaleString() : scenario.price.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                        {scenario.monthly > 0 ? 'Monthly' : 'Price'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      {scenario.type}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {scenario.status === 'Action Needed' && (
                        <div className="w-2 h-2 rounded-full bg-rose-500 micro-pulse"></div>
                      )}
                      {scenario.status === 'Review' && (
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                      )}
                      {scenario.status === 'Qualified' && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      )}
                      <span className={`text-[11px] font-semibold ${
                        scenario.status === 'Action Needed' ? 'text-rose-600' : 
                        scenario.status === 'Review' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {scenario.status}
                      </span>
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
            transition={{ delay: SCENARIOS.length * 0.07, duration: 0.4 }}
            className="bg-white rounded-xl p-3 flex gap-4 border border-slate-100"
          >
            <div className="w-[72px] h-[72px] rounded-lg animate-shimmer shrink-0"></div>
            <div className="flex-1 py-1 flex flex-col gap-3">
              <div className="flex justify-between">
                <div className="space-y-2 w-full">
                  <div className="h-4 w-3/4 rounded animate-shimmer"></div>
                  <div className="h-3 w-1/2 rounded animate-shimmer"></div>
                </div>
                <div className="w-16 h-4 rounded animate-shimmer shrink-0"></div>
              </div>
              <div className="flex justify-between mt-auto">
                <div className="w-16 h-5 rounded animate-shimmer"></div>
                <div className="w-20 h-4 rounded animate-shimmer"></div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 overflow-y-auto p-8"
            >
              {/* Header section with photo */}
              <div className="flex gap-8 mb-10">
                <div className="w-[480px] h-[270px] rounded-xl overflow-hidden shrink-0 relative bg-slate-900 shadow-md">
                  <img 
                    src={selected.photo} 
                    alt={selected.address}
                    className="w-full h-full object-cover opacity-90 ken-burns"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-4 left-4 flex gap-2">
                    <span className="bg-white/90 backdrop-blur text-slate-900 text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">
                      {selected.type}
                    </span>
                    <span className={`bg-white/90 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1.5 ${
                        selected.status === 'Action Needed' ? 'text-rose-600' : 
                        selected.status === 'Review' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                      {selected.status === 'Action Needed' && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 micro-pulse"></div>}
                      {selected.status === 'Review' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>}
                      {selected.status === 'Qualified' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
                      {selected.status}
                    </span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">{selected.address}</h1>
                  <div className="flex items-center text-slate-500 mb-6">
                    <MapPin className="w-4 h-4 mr-1.5" />
                    <span className="text-sm font-medium">{selected.location}</span>
                  </div>
                  
                  <motion.button 
                    whileHover={{ scale: 0.98, y: -2, boxShadow: "0 10px 15px -3px rgba(30, 64, 175, 0.2)" }}
                    whileTap={{ scale: 0.95 }}
                    className="self-start px-6 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg shadow flex items-center gap-2"
                  >
                    Edit Scenario <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="mb-10">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Scenario Overview</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <div className="text-xs font-semibold text-slate-500 mb-2">Est. Price</div>
                    <div className="text-xl font-bold text-slate-900"><CountUp value={selected.price} prefix="$" /></div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col relative overflow-hidden">
                    <div className="text-xs font-semibold text-slate-500 mb-2 z-10">Interest Rate</div>
                    <div className="text-xl font-bold text-slate-900 z-10 flex items-center justify-between">
                      <CountUp value={selected.rate} suffix="%" decimals={3} />
                      {selected.rate > 0 && <Sparkline />}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <div className="text-xs font-semibold text-slate-500 mb-2">Target LTV</div>
                    <div className="text-xl font-bold text-slate-900"><CountUp value={selected.ltv} suffix="%" /></div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-600/5 rounded-full blur-xl"></div>
                    <div className="text-xs font-semibold text-blue-700 mb-2 relative z-10">Est. Monthly</div>
                    <div className="text-2xl font-bold text-blue-700 relative z-10"><CountUp value={selected.monthly} prefix="$" /></div>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-4">Next Steps</h3>
                <div className="space-y-4">
                  {selected.steps.map((step, idx) => (
                    <div key={step.id} className="flex gap-4 items-start relative">
                      {idx !== selected.steps.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-slate-100 z-0"></div>
                      )}
                      <div className="relative z-10 bg-white">
                        {step.state === 'done' && <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-50" />}
                        {step.state === 'active' && <Circle className="w-6 h-6 text-blue-600 fill-blue-50" />}
                        {step.state === 'pending' && <Circle className="w-6 h-6 text-slate-200" />}
                      </div>
                      <div className={`flex-1 pt-0.5 ${step.state === 'pending' ? 'opacity-50' : ''}`}>
                        <div className={`text-sm font-semibold ${step.state === 'active' ? 'text-blue-700' : 'text-slate-900'}`}>
                          {step.label}
                        </div>
                        {step.state === 'active' && (
                          <motion.button 
                            whileHover={{ scale: 0.98 }}
                            className="mt-2 text-xs font-semibold bg-slate-900 text-white px-3 py-1.5 rounded-md"
                          >
                            Complete Task
                          </motion.button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
