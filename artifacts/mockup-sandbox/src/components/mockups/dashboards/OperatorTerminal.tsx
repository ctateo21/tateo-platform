import React, { useState } from 'react';
import './operator-terminal.css';
import { 
  Search, 
  Plus, 
  Bell, 
  Settings, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Home,
  FileText,
  Shield,
  Activity,
  ArrowUpRight,
  MoreHorizontal
} from 'lucide-react';

// Sample Data
const PROPERTIES = [
  {
    id: 'p1',
    address: '4122 W Estrella St, Tampa, FL 33629',
    image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80',
    type: 'Purchase',
    headlineLabel: 'Est. Price',
    headlineNumber: '$895,000',
    status: 'Qualified',
    lastUpdated: '2m ago',
    details: {
      ltv: '80%',
      rate: '6.5%',
      monthly: '$5,820',
      dti: '32%'
    }
  },
  {
    id: 'p2',
    address: '109 E Davis Blvd, Tampa, FL 33606',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    type: 'Refinance',
    headlineLabel: 'Est. Monthly',
    headlineNumber: '$4,150',
    status: 'Action Needed',
    lastUpdated: '1h ago',
    details: {
      ltv: '65%',
      rate: '5.875%',
      monthly: '$4,150',
      dti: '41%'
    }
  },
  {
    id: 'p3',
    address: '2801 Bayshore Blvd #12B, Tampa, FL 33629',
    image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80',
    type: 'Insurance',
    headlineLabel: 'Est. Premium',
    headlineNumber: '$6,200/yr',
    status: 'Review',
    lastUpdated: '3h ago',
    details: {
      ltv: 'N/A',
      rate: 'N/A',
      monthly: '$516',
      dti: 'N/A'
    }
  },
  {
    id: 'p4',
    address: '1504 S Orleans Ave, Tampa, FL 33606',
    image: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80',
    type: 'Purchase',
    headlineLabel: 'Est. Price',
    headlineNumber: '$1,150,000',
    status: 'Qualified',
    lastUpdated: '1d ago',
    details: {
      ltv: '75%',
      rate: '6.375%',
      monthly: '$7,240',
      dti: '28%'
    }
  },
  {
    id: 'p5',
    address: 'Loading...',
    image: '',
    type: 'Loading',
    headlineLabel: '...',
    headlineNumber: '...',
    status: 'Loading',
    lastUpdated: 'Just now',
    details: null
  }
];

export function OperatorTerminal() {
  const [activePropertyId, setActivePropertyId] = useState('p1');
  const [searchQuery, setSearchQuery] = useState('');

  const activeProperty = PROPERTIES.find(p => p.id === activePropertyId);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Qualified': return 'text-[var(--accent-green)] bg-[var(--accent-green-bg)] border-[var(--accent-green)]';
      case 'Action Needed': return 'text-[var(--accent-red)] bg-[var(--accent-red-bg)] border-[var(--accent-red)]';
      case 'Review': return 'text-[var(--accent-yellow)] bg-[var(--accent-yellow-bg)] border-[var(--accent-yellow)]';
      default: return 'text-[var(--text-muted)] bg-[var(--bg-active)] border-[var(--border-strong)]';
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'Purchase': return <Home size={14} className="text-[var(--accent-blue)]" />;
      case 'Refinance': return <Activity size={14} className="text-[var(--accent-yellow)]" />;
      case 'Insurance': return <Shield size={14} className="text-[var(--accent-green)]" />;
      default: return <FileText size={14} className="text-[var(--text-muted)]" />;
    }
  };

  return (
    <div className="operator-terminal flex flex-col h-screen overflow-hidden text-sm">
      {/* Global Header */}
      <header className="h-14 border-b divider flex items-center justify-between px-4 shrink-0 bg-[var(--bg-base)]">
        <div className="flex items-center gap-6">
          <div className="font-bold tracking-tight text-lg flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[var(--text-main)] text-[var(--bg-base)] flex items-center justify-center text-xs">T</div>
            Tateo & Co.
          </div>
          <nav className="flex items-center gap-4 text-[var(--text-muted)]">
            <a href="#" className="text-[var(--text-main)] font-medium">Dashboard</a>
            <a href="#" className="hover:text-[var(--text-main)] transition-colors">Compare</a>
            <a href="#" className="hover:text-[var(--text-main)] transition-colors">Settings</a>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 panel text-xs mono text-[var(--text-muted)]">
            <span>PORTFOLIO VOL:</span>
            <span className="text-[var(--text-main)]">$4.2M</span>
            <span className="mx-2 text-[var(--border-strong)]">|</span>
            <span>AVG LTV:</span>
            <span className="text-[var(--text-main)]">73%</span>
          </div>
          
          <button className="p-2 hover:bg-[var(--bg-hover)] rounded-md transition-colors text-[var(--text-muted)]">
            <Bell size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-[var(--bg-active)] border border-[var(--border-subtle)] flex items-center justify-center font-medium text-xs">
            OP
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar / List View */}
        <div className="w-[450px] border-r divider flex flex-col bg-[var(--bg-base)]">
          {/* Action Bar */}
          <div className="p-4 border-b divider space-y-3 shrink-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input 
                  type="text" 
                  placeholder="Enter property address to add..."
                  className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="bg-[var(--text-main)] text-[var(--bg-base)] px-4 rounded-md font-medium flex items-center gap-2 hover:bg-white transition-colors">
                <Plus size={16} /> Add
              </button>
            </div>
            
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
              <span>{PROPERTIES.length - 1} ACTIVE SCENARIOS</span>
              <div className="flex gap-3">
                <button className="hover:text-[var(--text-main)]">Filter</button>
                <button className="hover:text-[var(--text-main)]">Sort: Updated</button>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {PROPERTIES.map((prop) => (
              <div 
                key={prop.id}
                onClick={() => prop.id !== 'p5' && setActivePropertyId(prop.id)}
                className={`flex gap-3 p-3 rounded-md cursor-pointer transition-all border border-transparent ${
                  activePropertyId === prop.id 
                    ? 'bg-[var(--bg-active)] border-[var(--border-strong)]' 
                    : 'hover:bg-[var(--bg-hover)]'
                }`}
              >
                {prop.type === 'Loading' ? (
                  <>
                    <div className="w-12 h-12 rounded-sm bg-[var(--bg-panel)] animate-pulse shrink-0"></div>
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-[var(--bg-panel)] rounded animate-pulse w-3/4"></div>
                      <div className="h-3 bg-[var(--bg-panel)] rounded animate-pulse w-1/2"></div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-sm overflow-hidden shrink-0 border border-[var(--border-subtle)] bg-[var(--bg-panel)]">
                      <img src={prop.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium truncate text-[var(--text-main)]">{prop.address.split(',')[0]}</span>
                        <div className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${getStatusColor(prop.status)} shrink-0`}>
                          {prop.status}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                          {getTypeIcon(prop.type)}
                          <span>{prop.type}</span>
                        </div>
                        <div className="mono font-medium text-[var(--text-main)]">
                          {prop.headlineNumber}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 bg-[var(--bg-panel)] flex flex-col overflow-y-auto">
          {activeProperty && activeProperty.type !== 'Loading' && (
            <div className="p-8 max-w-4xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              
              {/* Header */}
              <div className="flex gap-6 items-start">
                <div className="w-32 h-32 rounded-lg overflow-hidden border border-[var(--border-subtle)] shrink-0 shadow-lg">
                  <img src={activeProperty.image} alt="Property" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-4 pt-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-2xl font-semibold text-[var(--text-main)] mb-1">{activeProperty.address.split(',')[0]}</h1>
                      <div className="text-[var(--text-muted)] flex items-center gap-2">
                        {activeProperty.address.split(',').slice(1).join(',')}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {activeProperty.lastUpdated}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 panel hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                        <MoreHorizontal size={16} />
                      </button>
                      <button className="px-4 py-2 bg-[var(--text-main)] text-[var(--bg-base)] rounded-md font-medium text-xs hover:bg-white transition-colors">
                        Open Full Scenario
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 panel rounded-md">
                      {getTypeIcon(activeProperty.type)}
                      <span className="font-medium text-xs">{activeProperty.type}</span>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-semibold ${getStatusColor(activeProperty.status)}`}>
                      {activeProperty.status === 'Qualified' && <CheckCircle2 size={14} />}
                      {activeProperty.status === 'Action Needed' && <AlertCircle size={14} />}
                      {activeProperty.status === 'Review' && <Clock size={14} />}
                      {activeProperty.status}
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div className="panel overflow-hidden">
                <div className="px-5 py-4 border-b divider bg-[var(--bg-active)] flex justify-between items-center">
                  <h3 className="font-medium">Scenario Overview</h3>
                  <button className="text-[var(--accent-blue)] text-xs font-medium hover:underline flex items-center gap-1">
                    Edit Assumptions <ArrowUpRight size={12} />
                  </button>
                </div>
                <div className="grid grid-cols-2 divide-x divider">
                  
                  {/* Left Column */}
                  <div className="divide-y divider">
                    <div className="px-5 py-4 flex justify-between items-center hover:bg-[var(--bg-hover)] transition-colors">
                      <span className="text-[var(--text-muted)]">{activeProperty.headlineLabel}</span>
                      <span className="mono text-lg font-medium">{activeProperty.headlineNumber}</span>
                    </div>
                    <div className="px-5 py-4 flex justify-between items-center hover:bg-[var(--bg-hover)] transition-colors">
                      <span className="text-[var(--text-muted)]">Target LTV</span>
                      <span className="mono">{activeProperty.details?.ltv}</span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="divide-y divider">
                    <div className="px-5 py-4 flex justify-between items-center hover:bg-[var(--bg-hover)] transition-colors">
                      <span className="text-[var(--text-muted)]">Interest Rate</span>
                      <span className="mono">{activeProperty.details?.rate}</span>
                    </div>
                    <div className="px-5 py-4 flex justify-between items-center hover:bg-[var(--bg-hover)] transition-colors">
                      <span className="text-[var(--text-muted)]">Est. Monthly</span>
                      <span className="mono text-[var(--accent-blue)]">{activeProperty.details?.monthly}</span>
                    </div>
                  </div>
                  
                </div>
              </div>
              
              {/* Action Needed Warning (if applicable) */}
              {activeProperty.status === 'Action Needed' && (
                <div className="panel border-[var(--accent-red)] bg-[var(--accent-red-bg)] p-4 rounded-md flex gap-4 items-start">
                  <AlertCircle className="text-[var(--accent-red)] shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="font-semibold text-[var(--accent-red)] mb-1">Appraisal Value Shortfall</h4>
                    <p className="text-sm text-[var(--text-main)] mb-3">The estimated property value came in lower than the required amount to maintain the current LTV. You may need to adjust the loan amount or bring additional funds.</p>
                    <button className="text-xs font-semibold px-3 py-1.5 bg-[var(--accent-red)] text-white rounded hover:opacity-90 transition-opacity">
                      Review Options
                    </button>
                  </div>
                </div>
              )}

              {/* Tasks / Workflow */}
              <div>
                <h3 className="font-medium mb-3 text-[var(--text-muted)]">Workflow</h3>
                <div className="panel divide-y divider">
                  <div className="px-5 py-3 flex items-center gap-3 hover:bg-[var(--bg-hover)] cursor-pointer">
                    <CheckCircle2 size={16} className="text-[var(--accent-green)]" />
                    <span className="flex-1 text-sm line-through text-[var(--text-muted)]">Zillow Data Extracted</span>
                  </div>
                  <div className="px-5 py-3 flex items-center gap-3 hover:bg-[var(--bg-hover)] cursor-pointer bg-[var(--bg-active)]">
                    <div className="w-4 h-4 rounded-full border-2 border-[var(--accent-blue)] shrink-0" />
                    <span className="flex-1 text-sm font-medium">Review Estimated Taxes & Insurance</span>
                    <button className="text-xs bg-[var(--accent-blue)] text-white px-2 py-1 rounded">Start</button>
                  </div>
                  <div className="px-5 py-3 flex items-center gap-3 hover:bg-[var(--bg-hover)] cursor-pointer">
                    <div className="w-4 h-4 rounded-full border-2 border-[var(--border-strong)] shrink-0" />
                    <span className="flex-1 text-sm text-[var(--text-muted)]">Generate Pre-Approval Letter</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
