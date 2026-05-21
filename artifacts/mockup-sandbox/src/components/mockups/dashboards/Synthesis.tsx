import React, { useState } from "react";
import { Search, Plus, MapPin, Building, Home, CheckCircle2, Circle, AlertCircle, ChevronRight, Activity, DollarSign, TrendingUp, Settings, LayoutDashboard, ArrowRightLeft } from "lucide-react";

import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Input } from "../../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Separator } from "../../ui/separator";
import { Skeleton } from "../../ui/skeleton";

type ScenarioType = "Purchase" | "Refinance" | "Insurance";
type Status = "Qualified" | "Review" | "Action Needed" | "Loading";

interface Property {
  id: string;
  address: string;
  city: string;
  type: ScenarioType;
  price: number;
  monthly: number;
  rate: number;
  ltv: number;
  status: Status;
  photoUrl: string;
}

const properties: Property[] = [
  {
    id: "1",
    address: "412 E Davis Blvd",
    city: "Tampa, FL 33606",
    type: "Purchase",
    price: 850000,
    monthly: 5240,
    rate: 6.5,
    ltv: 80,
    status: "Qualified",
    photoUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "2",
    address: "1802 N Riverside Dr",
    city: "Tampa, FL 33602",
    type: "Refinance",
    price: 1200000,
    monthly: 6500,
    rate: 5.875,
    ltv: 75,
    status: "Review",
    photoUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "3",
    address: "2250 S Osprey Ave",
    city: "Sarasota, FL 34239",
    type: "Insurance",
    price: 680000,
    monthly: 4120,
    rate: 6.75,
    ltv: 90,
    status: "Action Needed",
    photoUrl: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "4",
    address: "941 W Amelia St",
    city: "Orlando, FL 32805",
    type: "Purchase",
    price: 450000,
    monthly: 2980,
    rate: 6.625,
    ltv: 85,
    status: "Qualified",
    photoUrl: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "5",
    address: "1024 Ocean Blvd",
    city: "Clearwater, FL 33767",
    type: "Purchase",
    price: 280000,
    monthly: 1850,
    rate: 6.25,
    ltv: 80,
    status: "Loading",
    photoUrl: "https://images.unsplash.com/photo-1576941089067-2de3c901e126?auto=format&fit=crop&q=80&w=800",
  }
];

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

export function Synthesis() {
  const [selectedId, setSelectedId] = useState<string>("1");
  const selectedProp = properties.find(p => p.id === selectedId) || properties[0];

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      
      {/* Top Bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-stone-200">
        <div className="flex h-16 items-center px-6 gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#1E3A8A] flex items-center justify-center text-white font-bold text-xl leading-none">
              T
            </div>
            <span className="font-semibold text-lg tracking-tight">Tateo & Co</span>
          </div>
          
          <nav className="flex items-center gap-6 ml-4 text-sm font-medium text-stone-500">
            <a href="#" className="flex items-center gap-2 text-[#1E3A8A] transition-colors"><LayoutDashboard className="w-4 h-4" /> Dashboard</a>
            <a href="#" className="flex items-center gap-2 hover:text-stone-900 transition-colors"><ArrowRightLeft className="w-4 h-4" /> Compare</a>
            <a href="#" className="flex items-center gap-2 hover:text-stone-900 transition-colors"><Settings className="w-4 h-4" /> Settings</a>
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                <Input type="text" placeholder="Add new property address..." className="pl-9 bg-stone-50 border-stone-200 focus-visible:ring-[#1E3A8A]" />
              </div>
              <Button className="bg-[#1E3A8A] hover:bg-[#152a6b] text-white gap-2">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Avatar className="h-9 w-9 border border-stone-200">
              <AvatarImage src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=150" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-6">
        {/* Portfolio Strip */}
        <div className="flex gap-4 mb-6">
          <Card className="flex-1 shadow-sm border-stone-200 bg-white">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-blue-50 text-[#1E3A8A] rounded-full">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-500">Active Scenarios</p>
                <p className="text-2xl font-semibold tabular-nums">4</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 shadow-sm border-stone-200 bg-white">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-blue-50 text-[#1E3A8A] rounded-full">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-500">Pipeline Value</p>
                <p className="text-2xl font-semibold tabular-nums">$3,460,000</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 shadow-sm border-stone-200 bg-white">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-blue-50 text-[#1E3A8A] rounded-full">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-500">Avg Est. Rate</p>
                <p className="text-2xl font-semibold tabular-nums">6.43%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two-Column Layout */}
        <div className="flex gap-6 items-start h-[calc(100vh-220px)]">
          
          {/* Left Sidebar */}
          <div className="w-[450px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto pb-4 pr-2 custom-scrollbar">
            {properties.map((p, i) => (
              <div 
                key={p.id}
                onClick={() => p.status !== "Loading" && setSelectedId(p.id)}
                className={`relative group flex items-center p-3 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden animate-in fade-in slide-in-from-bottom-2 ${
                  selectedId === p.id 
                    ? "bg-blue-50/50 border-[#1E3A8A]/30 shadow-sm shadow-[#1E3A8A]/5" 
                    : "bg-white border-stone-200 hover:border-stone-300 hover:shadow-md hover:-translate-y-[1px]"
                }`}
                style={{ animationFillMode: "both", animationDelay: `${i * 40}ms` }}
              >
                {selectedId === p.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1E3A8A]" />
                )}
                
                {p.status === "Loading" ? (
                  <div className="flex items-center gap-4 w-full h-[72px]">
                    <Skeleton className="w-[72px] h-[72px] rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-[72px] h-[72px] rounded-lg overflow-hidden flex-shrink-0 border border-stone-100 bg-stone-100 relative">
                      <img src={p.photoUrl} alt={p.address} className="w-full h-full object-cover" />
                    </div>
                    
                    <div className="flex-1 min-w-0 ml-4">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 uppercase font-bold tracking-wider rounded-sm ${
                          p.type === 'Purchase' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                          p.type === 'Refinance' ? 'text-indigo-700 bg-indigo-50 border-indigo-200' :
                          'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}>
                          {p.type}
                        </Badge>
                        <span className="font-semibold tabular-nums text-stone-900">{formatCurrency(p.price)}</span>
                      </div>
                      <h4 className="font-semibold text-[15px] truncate text-stone-900 leading-snug">{p.address}</h4>
                      <p className="text-xs text-stone-500 truncate mt-0.5">{p.city}</p>
                    </div>

                    <div className="ml-4 flex flex-col items-end gap-2">
                      <Badge variant="secondary" className={`font-medium ${
                        p.status === 'Qualified' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                        p.status === 'Review' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                        p.status === 'Action Needed' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : ''
                      }`}>
                        {p.status === 'Action Needed' && <AlertCircle className="w-3 h-3 mr-1" />}
                        {p.status}
                      </Badge>
                      <div className="text-xs font-medium text-stone-400 group-hover:text-[#1E3A8A] transition-colors flex items-center">
                        <span className="tabular-nums mr-1">{formatCurrency(p.monthly)}/mo</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Right Detail Panel */}
          <div className="flex-1 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
            <div className="h-[270px] relative w-full overflow-hidden bg-stone-100">
              <img src={selectedProp.photoUrl} alt={selectedProp.address} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 text-white">
                <Badge className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-white/30 mb-3 uppercase tracking-widest text-[10px]">
                  {selectedProp.type} Scenario
                </Badge>
                <h2 className="text-3xl font-bold mb-1">{selectedProp.address}</h2>
                <div className="flex items-center text-white/80 text-sm">
                  <MapPin className="w-4 h-4 mr-1.5" />
                  {selectedProp.city}
                </div>
              </div>
            </div>

            <div className="p-8 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-stone-900 mb-1">Scenario Overview</h3>
                  <p className="text-sm text-stone-500">Based on today's rates and selected down payment.</p>
                </div>
                <Button className="bg-[#1E3A8A] hover:bg-[#152a6b] text-white rounded-full px-6">
                  Edit Scenario
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-10">
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                  <div className="text-sm font-medium text-stone-500 mb-1 flex items-center"><Building className="w-4 h-4 mr-1.5 opacity-70" /> Est. Price</div>
                  <div className="text-2xl font-semibold text-[#1E3A8A] tabular-nums">{formatCurrency(selectedProp.price)}</div>
                </div>
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                  <div className="text-sm font-medium text-stone-500 mb-1">Interest Rate</div>
                  <div className="text-2xl font-semibold text-[#1E3A8A] tabular-nums">{selectedProp.rate}%</div>
                </div>
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                  <div className="text-sm font-medium text-stone-500 mb-1">Target LTV</div>
                  <div className="text-2xl font-semibold text-[#1E3A8A] tabular-nums">{selectedProp.ltv}%</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-100 rounded-full opacity-50"></div>
                  <div className="text-sm font-medium text-blue-800 mb-1 relative z-10">Est. Monthly</div>
                  <div className="text-2xl font-semibold text-[#1E3A8A] tabular-nums relative z-10">{formatCurrency(selectedProp.monthly)}</div>
                </div>
              </div>

              <div className="mt-auto">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-stone-400 mb-4">Next Steps</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer border border-transparent hover:border-stone-100">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-stone-900 text-sm">Initial Qualification</p>
                      <p className="text-stone-500 text-xs mt-0.5">Credit and income overview completed.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer border border-transparent hover:border-stone-100">
                    {selectedProp.status === 'Action Needed' ? (
                      <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#1E3A8A] mt-0.5 flex-shrink-0 fill-[#1E3A8A]/10" />
                    )}
                    <div>
                      <p className={`font-medium text-sm ${selectedProp.status === 'Action Needed' ? 'text-rose-700' : 'text-stone-900'}`}>
                        {selectedProp.type === 'Purchase' ? 'Submit Pre-Approval Docs' : 'Verify Property Value'}
                      </p>
                      <p className="text-stone-500 text-xs mt-0.5">Upload recent paystubs and W2s to proceed.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer border border-transparent hover:border-stone-100">
                    <Circle className="w-5 h-5 text-stone-300 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-stone-500 text-sm">Lock Rate</p>
                      <p className="text-stone-400 text-xs mt-0.5">Pending document verification.</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #d1d5db; }
      `}} />
    </div>
  );
}
