import React from "react";
import { 
  Building2, 
  Search, 
  Plus, 
  Settings, 
  Bell, 
  ChevronRight, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Home, 
  MoreHorizontal
} from "lucide-react";
import "./atelier-premium.css";

const PROPERTIES = [
  {
    id: "p1",
    address: "812 Bayshore Blvd, Tampa, FL 33606",
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800",
    scenario: "Purchase",
    headlineValue: "$4,250",
    headlineLabel: "Est. Monthly",
    price: "$895,000",
    status: "Qualified",
    updatedAt: "2 hours ago",
    loading: false
  },
  {
    id: "p2",
    address: "415 S Howard Ave, Tampa, FL 33606",
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
    scenario: "Refinance",
    headlineValue: "5.875%",
    headlineLabel: "Est. Rate",
    price: "$1,200,000",
    status: "Review",
    updatedAt: "1 day ago",
    loading: false
  },
  {
    id: "p3",
    address: "128 W Davis Blvd, Tampa, FL 33606",
    image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
    scenario: "Insurance",
    headlineValue: "$3,800",
    headlineLabel: "Annual Premium",
    price: "$750,000",
    status: "Action Needed",
    updatedAt: "3 days ago",
    loading: false
  },
  {
    id: "p4",
    address: "3901 W Beach Park Dr, Tampa, FL 33609",
    image: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800",
    scenario: "Purchase",
    headlineValue: "$6,100",
    headlineLabel: "Est. Monthly",
    price: "$1,150,000",
    status: "Qualified",
    updatedAt: "Just now",
    loading: false
  },
  {
    id: "p5",
    address: "1405 E 9th Ave, Tampa, FL 33605",
    image: "https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=800",
    scenario: "Purchase",
    headlineValue: "-",
    headlineLabel: "Est. Monthly",
    price: "-",
    status: "Loading",
    updatedAt: "-",
    loading: true
  }
];

export function AtelierPremium() {
  return (
    <div className="atelier-premium-wrapper">
      {/* Header */}
      <header className="ap-glass-header sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--ap-text-main))] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Tateo & Co</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-[hsl(var(--ap-text-main))] font-medium text-sm">Dashboard</a>
            <a href="#" className="text-[hsl(var(--ap-text-muted))] hover:text-[hsl(var(--ap-text-main))] font-medium text-sm transition-colors">Compare</a>
            <a href="#" className="text-[hsl(var(--ap-text-muted))] hover:text-[hsl(var(--ap-text-main))] font-medium text-sm transition-colors">Settings</a>
          </nav>
        </div>
        <div className="flex items-center gap-5">
          <button className="text-[hsl(var(--ap-text-muted))] hover:text-[hsl(var(--ap-text-main))] transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-[hsl(var(--ap-border))]"></div>
          <button className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-[hsl(var(--ap-border))]">
              <img src="https://ui-avatars.com/api/?name=Jane+Doe&background=random" alt="User" className="w-full h-full object-cover" />
            </div>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 ap-animate-in" style={{ animationDelay: '0ms' }}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Portfolio Overview</h1>
            <p className="text-[hsl(var(--ap-text-muted))] text-sm">Manage your properties and active scenarios.</p>
          </div>
          
          <div className="w-full md:w-auto flex-1 max-w-md relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--ap-text-muted))]">
              <Search className="w-4 h-4" />
            </div>
            <input 
              type="text" 
              placeholder="Enter a new property address..." 
              className="w-full pl-10 pr-32 py-3 rounded-xl border border-[hsl(var(--ap-border))] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ap-accent))] focus:border-transparent transition-all shadow-sm"
            />
            <button className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[hsl(var(--ap-text-main))] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-black transition-colors flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="ap-card p-6 mb-10 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[hsl(var(--ap-border))] ap-animate-in" style={{ animationDelay: '50ms' }}>
          <div className="flex-1 px-2 py-3 md:py-0 md:pl-2 md:pr-6">
            <div className="text-[hsl(var(--ap-text-muted))] text-xs font-semibold uppercase tracking-wider mb-1">Active Scenarios</div>
            <div className="text-2xl font-bold">5 Properties</div>
          </div>
          <div className="flex-1 px-2 py-4 md:py-0 md:px-6">
            <div className="text-[hsl(var(--ap-text-muted))] text-xs font-semibold uppercase tracking-wider mb-1">Total Pipeline Value</div>
            <div className="text-2xl font-bold">$3,995,000</div>
          </div>
          <div className="flex-1 px-2 py-4 md:py-0 md:px-6">
            <div className="text-[hsl(var(--ap-text-muted))] text-xs font-semibold uppercase tracking-wider mb-1">Avg Est. Rate</div>
            <div className="text-2xl font-bold">6.125%</div>
          </div>
        </div>

        {/* Property Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PROPERTIES.map((prop, idx) => (
            <PropertyCard key={prop.id} property={prop} index={idx} />
          ))}
        </div>
      </main>
    </div>
  );
}

function PropertyCard({ property, index }: { property: typeof PROPERTIES[0], index: number }) {
  if (property.loading) {
    return (
      <div 
        className="ap-card flex flex-col overflow-hidden ap-animate-in"
        style={{ animationDelay: `${100 + index * 50}ms` }}
      >
        <div className="h-48 w-full ap-shimmer relative">
          <div className="absolute top-4 left-4 w-20 h-6 rounded-full bg-white/40 backdrop-blur-sm"></div>
        </div>
        <div className="p-5 flex flex-col flex-1">
          <div className="h-5 w-3/4 rounded-md ap-shimmer mb-2"></div>
          <div className="h-4 w-1/2 rounded-md ap-shimmer mb-6"></div>
          
          <div className="mt-auto pt-4 border-t border-[hsl(var(--ap-border))] flex justify-between items-center">
            <div>
              <div className="h-4 w-16 rounded-md ap-shimmer mb-1"></div>
              <div className="h-6 w-24 rounded-md ap-shimmer"></div>
            </div>
            <div className="h-8 w-8 rounded-full ap-shimmer"></div>
          </div>
        </div>
      </div>
    );
  }

  // Status colors mapping
  const statusConfig = {
    "Qualified": {
      bg: "bg-[hsl(var(--ap-success-bg))]",
      text: "text-[hsl(var(--ap-success))]",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />
    },
    "Review": {
      bg: "bg-[hsl(var(--ap-warning-bg))]",
      text: "text-[hsl(var(--ap-warning))]",
      icon: <Clock className="w-3.5 h-3.5" />
    },
    "Action Needed": {
      bg: "bg-[hsl(var(--ap-danger-bg))]",
      text: "text-[hsl(var(--ap-danger))]",
      icon: <AlertCircle className="w-3.5 h-3.5" />
    }
  } as Record<string, { bg: string, text: string, icon: React.ReactNode }>;

  const sConf = statusConfig[property.status] || statusConfig["Qualified"];

  return (
    <div 
      className="ap-card flex flex-col overflow-hidden cursor-pointer group ap-animate-in"
      style={{ animationDelay: `${100 + index * 50}ms` }}
    >
      <div className="h-48 w-full relative overflow-hidden">
        <img 
          src={property.image} 
          alt={property.address} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
        
        <div className="absolute top-4 left-4">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 text-[hsl(var(--ap-text-main))] shadow-sm backdrop-blur-sm">
            {property.scenario}
          </span>
        </div>
        <div className="absolute top-4 right-4">
          <button className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md flex items-center justify-center text-white transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="p-5 flex flex-col flex-1 relative">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-[hsl(var(--ap-text-main))] text-base leading-snug pr-4">
            {property.address}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[hsl(var(--ap-text-muted))] text-sm mb-5">
          <MapPin className="w-3.5 h-3.5" />
          <span>Property Value: {property.price}</span>
        </div>
        
        <div className="mt-auto pt-5 border-t border-[hsl(var(--ap-border))] flex items-end justify-between">
          <div>
            <div className="text-[hsl(var(--ap-text-muted))] text-xs font-medium mb-1 uppercase tracking-wider">
              {property.headlineLabel}
            </div>
            <div className="text-2xl font-bold tracking-tight text-[hsl(var(--ap-text-main))]">
              {property.headlineValue}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${sConf.bg} ${sConf.text}`}>
              {sConf.icon}
              {property.status}
            </span>
            <span className="text-[10px] text-[hsl(var(--ap-text-muted))] uppercase font-medium tracking-wider">
              {property.updatedAt}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
