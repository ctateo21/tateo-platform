import React from "react";
import { Search, Plus, MapPin, Bell, User, Clock, ChevronRight, Home, Shield, DollarSign, Building, Settings, LayoutDashboard, ArrowRightLeft } from "lucide-react";
import "./listings-photo-forward.css";

// Data
const properties = [
  {
    id: 1,
    address: "1408 S Bayshore Blvd",
    city: "Tampa, FL 33606",
    photo: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",
    scenario: "Purchase",
    scenarioIcon: Home,
    headlineLabel: "Est. Monthly",
    headlineNumber: "$6,240",
    price: "$1,250,000",
    status: "Qualified",
    statusVariant: "green",
    lastUpdated: "2 hours ago",
    loading: false
  },
  {
    id: 2,
    address: "812 E Davis Blvd",
    city: "Tampa, FL 33606",
    photo: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
    scenario: "Refinance",
    scenarioIcon: DollarSign,
    headlineLabel: "New Payment",
    headlineNumber: "$3,850",
    price: "$820,000",
    status: "Action Needed",
    statusVariant: "red",
    lastUpdated: "1 day ago",
    loading: false
  },
  {
    id: 3,
    address: "4301 W Kennedy Blvd",
    city: "Tampa, FL 33609",
    photo: "https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=800&q=80",
    scenario: "Insurance",
    scenarioIcon: Shield,
    headlineLabel: "Annual Premium",
    headlineNumber: "$4,100",
    price: "$950,000",
    status: "Review",
    statusVariant: "orange",
    lastUpdated: "3 days ago",
    loading: false
  },
  {
    id: 4,
    address: "1120 N Franklin St",
    city: "Tampa, FL 33602",
    photo: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80",
    scenario: "Purchase",
    scenarioIcon: Home,
    headlineLabel: "Est. Monthly",
    headlineNumber: "$2,150",
    price: "$450,000",
    status: "Qualified",
    statusVariant: "green",
    lastUpdated: "5 hours ago",
    loading: false
  },
  {
    id: 5,
    address: "Loading...",
    city: "Loading...",
    photo: "",
    scenario: "Purchase",
    scenarioIcon: Home,
    headlineLabel: "Est. Monthly",
    headlineNumber: "$0",
    price: "$0",
    status: "Analyzing",
    statusVariant: "orange",
    lastUpdated: "Just now",
    loading: true
  }
];

export function ListingsPhotoForward() {
  return (
    <div className="photo-forward-theme w-full min-h-screen pb-20">
      
      {/* Global Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-stone-900 rounded-sm flex items-center justify-center">
                <Building className="w-5 h-5 text-white" />
              </div>
              <span className="font-serif text-2xl font-medium tracking-tight text-stone-900">Tateo & Co</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#" className="text-sm font-medium text-stone-900 border-b-2 border-stone-900 py-1 flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </a>
              <a href="#" className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" /> Compare
              </a>
              <a href="#" className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-2">
                <Settings className="w-4 h-4" /> Settings
              </a>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="w-10 h-10 rounded-full bg-stone-200 overflow-hidden border border-stone-300 flex items-center justify-center">
              <User className="w-5 h-5 text-stone-500" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-12">
        
        {/* Top Section: Title & Add Action */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-serif font-medium text-stone-900 mb-2">Portfolio Overview</h1>
            <p className="text-stone-500 text-lg">Track and analyze your real estate scenarios.</p>
          </div>
          
          <div className="w-full md:w-[480px]">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-stone-400 group-focus-within:text-amber-700 transition-colors" />
              </div>
              <input 
                type="text" 
                placeholder="Enter property address to analyze..." 
                className="w-full pl-12 pr-32 py-4 bg-white border border-stone-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all text-stone-800 placeholder:text-stone-400 text-lg"
              />
              <button className="absolute inset-y-2 right-2 bg-stone-900 hover:bg-stone-800 text-white px-4 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> Analyze
              </button>
            </div>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 flex flex-wrap gap-8 md:gap-16 mb-12 shadow-sm">
          <div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-1">Tracked Scenarios</p>
            <p className="text-3xl font-serif text-stone-900">12</p>
          </div>
          <div className="hidden md:block w-px bg-stone-200"></div>
          <div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-1">Total Est. Monthly</p>
            <p className="text-3xl font-serif text-stone-900">$18,450</p>
          </div>
          <div className="hidden md:block w-px bg-stone-200"></div>
          <div>
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-1">Avg LTV</p>
            <p className="text-3xl font-serif text-stone-900">76%</p>
          </div>
        </div>

        {/* Property Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          {properties.map((prop, idx) => (
            <div 
              key={prop.id} 
              className={`pf-card group bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {prop.loading ? (
                <>
                  <div className="aspect-[16/9] w-full pf-shimmer"></div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-3 w-2/3">
                        <div className="h-6 bg-stone-200 rounded pf-shimmer w-full"></div>
                        <div className="h-4 bg-stone-200 rounded pf-shimmer w-2/3"></div>
                      </div>
                      <div className="h-8 bg-stone-200 rounded-full pf-shimmer w-24"></div>
                    </div>
                    <div className="pt-6 border-t border-stone-100 flex justify-between items-end">
                      <div className="space-y-2">
                        <div className="h-3 bg-stone-200 rounded pf-shimmer w-20"></div>
                        <div className="h-8 bg-stone-200 rounded pf-shimmer w-32"></div>
                      </div>
                      <div className="h-4 bg-stone-200 rounded pf-shimmer w-24"></div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Photo Area */}
                  <div className="pf-card-img-wrapper aspect-[16/9] w-full bg-stone-100">
                    <img 
                      src={prop.photo} 
                      alt={prop.address} 
                      className="w-full h-full object-cover pf-card-img"
                    />
                    <div className="absolute inset-0 pf-card-gradient mix-blend-multiply opacity-80 transition-opacity group-hover:opacity-90"></div>
                    
                    {/* Floating Badges over Image */}
                    <div className="absolute top-4 left-4 flex gap-2">
                      <div className="bg-white/90 backdrop-blur-sm text-stone-900 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                        <prop.scenarioIcon className="w-3.5 h-3.5 text-amber-700" />
                        {prop.scenario}
                      </div>
                    </div>
                    
                    <div className="absolute top-4 right-4">
                      {prop.statusVariant === "green" && (
                        <div className="bg-[#ECFDF5]/90 backdrop-blur-sm text-[#065F46] border border-[#34D399]/30 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
                          {prop.status}
                        </div>
                      )}
                      {prop.statusVariant === "red" && (
                        <div className="bg-[#FEF2F2]/90 backdrop-blur-sm text-[#991B1B] border border-[#F87171]/30 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse"></span>
                          {prop.status}
                        </div>
                      )}
                      {prop.statusVariant === "orange" && (
                        <div className="bg-[#FFF7ED]/90 backdrop-blur-sm text-[#9A3412] border border-[#FDBA74]/30 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
                          {prop.status}
                        </div>
                      )}
                    </div>
                    
                    {/* Bottom Image Overlay (Address) */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-black/80 to-transparent">
                      <h3 className="text-white text-2xl font-serif mb-1 group-hover:text-amber-100 transition-colors">{prop.address}</h3>
                      <p className="text-stone-300 text-sm flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> {prop.city}
                      </p>
                    </div>
                  </div>

                  {/* Data Footer */}
                  <div className="p-6 bg-white flex flex-col justify-between">
                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">{prop.headlineLabel}</p>
                        <p className="text-3xl font-serif text-stone-900 leading-none">{prop.headlineNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">Est. Value</p>
                        <p className="text-lg font-medium text-stone-700 leading-none">{prop.price}</p>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-stone-400">
                        <Clock className="w-3.5 h-3.5" />
                        Updated {prop.lastUpdated}
                      </div>
                      <div className="flex items-center gap-1 text-sm font-medium text-amber-700 group-hover:text-amber-800 transition-colors">
                        View Details
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        
      </main>
    </div>
  );
}
