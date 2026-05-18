import { useState } from "react";
import { useSearch, useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { Home, Shield, Layers, ArrowRight, ArrowLeft, Key, RefreshCw } from "lucide-react";

const services = [
  {
    id: "all",
    icon: Layers,
    title: "All Services",
    description: "Real Estate, Mortgage & Insurance combined — the complete picture of what it costs to own this home.",
    color: "from-primary to-primary/80",
    border: "border-primary/30 hover:border-primary",
    badge: "Best Value",
    needsIntent: true,
  },
  {
    id: "real-estate",
    icon: Home,
    title: "Real Estate / Mortgage",
    description: "See your full purchase cost — mortgage payment, property taxes, down payment, and whether you qualify.",
    color: "from-blue-600 to-blue-800",
    border: "border-blue-200 hover:border-blue-500",
    badge: null,
    needsIntent: true,
  },
  {
    id: "insurance",
    icon: Shield,
    title: "Insurance",
    description: "Get a homeowners insurance estimate including wind mitigation credits and flood zone analysis.",
    color: "from-emerald-600 to-emerald-800",
    border: "border-emerald-200 hover:border-emerald-500",
    badge: null,
    needsIntent: false,
  },
];

export default function SelectService() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const address = params.get("address") || "";

  const [pendingService, setPendingService] = useState<string | null>(null);

  function handleSelect(id: string, needsIntent: boolean) {
    if (id === "insurance") {
      setLocation(`/insurance${address ? `?address=${encodeURIComponent(address)}` : ""}`);
    } else if (needsIntent) {
      setPendingService(id);
    } else {
      setLocation(`/estimate?address=${encodeURIComponent(address)}${id === "all" ? "&services=all" : ""}`);
    }
  }

  function handleIntent(intent: "purchase" | "refinance") {
    const addr = address ? `?address=${encodeURIComponent(address)}` : "";
    const services = pendingService === "all" ? "&services=all" : "";
    if (intent === "purchase") {
      setLocation(`/estimate${addr}${services}`);
    } else {
      setLocation(`/refinance${addr}`);
    }
  }

  return (
    <>
      <Helmet>
        <title>Choose a Service — Tateo & Co</title>
      </Helmet>

      <section className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center px-4 py-16 bg-gradient-to-br from-gray-50 to-white">

        {/* Address pill */}
        {address && (
          <div className="flex items-center gap-2 mb-8 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm text-sm text-muted-foreground">
            <Home className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate max-w-xs font-medium text-gray-700">{address}</span>
          </div>
        )}

        {/* ── Step 1: Service selection ── */}
        {!pendingService && (
          <>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-3">
              What would you like to explore?
            </h1>
            <p className="text-muted-foreground text-center mb-12 max-w-md">
              Select a service and we'll pull up everything you need for this property.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
              {services.map(({ id, icon: Icon, title, description, color, border, badge, needsIntent }) => (
                <button
                  key={id}
                  onClick={() => handleSelect(id, needsIntent)}
                  className={`group relative flex flex-col items-center text-center p-8 bg-white rounded-2xl border-2 ${border} shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer`}
                >
                  {badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                      {badge}
                    </span>
                  )}
                  <div className={`flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${color} mb-5 shadow-md group-hover:scale-105 transition-transform duration-200`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight">{title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                  <div className="mt-6 w-full py-2.5 rounded-xl bg-gray-50 group-hover:bg-primary group-hover:text-white transition-colors duration-200 text-sm font-semibold text-gray-600">
                    Select →
                  </div>
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-10">
              Free · No login required · Instant results
            </p>
          </>
        )}

        {/* ── Step 2: Purchase or Refinance? ── */}
        {pendingService && (
          <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button
              onClick={() => setPendingService(null)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-3">
              Are you looking to purchase or refinance?
            </h1>
            <p className="text-muted-foreground text-center mb-12 max-w-md mx-auto">
              We'll tailor the experience to your situation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Purchase */}
              <button
                onClick={() => handleIntent("purchase")}
                className="group flex flex-col items-center text-center p-8 bg-white rounded-2xl border-2 border-blue-200 hover:border-blue-500 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 mb-5 shadow-md group-hover:scale-105 transition-transform duration-200">
                  <Key className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight">Purchase</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Buying a new home. We'll calculate your monthly payment, cash to close, and whether you qualify.
                </p>
                <div className="mt-6 w-full py-2.5 rounded-xl bg-gray-50 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200 text-sm font-semibold text-gray-600 flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </div>
              </button>

              {/* Refinance */}
              <button
                onClick={() => handleIntent("refinance")}
                className="group flex flex-col items-center text-center p-8 bg-white rounded-2xl border-2 border-primary/30 hover:border-primary shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 mb-5 shadow-md group-hover:scale-105 transition-transform duration-200">
                  <RefreshCw className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight">Refinance</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Already own the home. We'll analyze your savings, break-even point, and whether refinancing makes sense.
                </p>
                <div className="mt-6 w-full py-2.5 rounded-xl bg-gray-50 group-hover:bg-primary group-hover:text-white transition-colors duration-200 text-sm font-semibold text-gray-600 flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
