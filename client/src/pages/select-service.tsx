import { useSearch, useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { Shield, Layers, Banknote, Key, RefreshCw, Tag, MapPin, Pencil } from "lucide-react";

/**
 * Logged-out service picker shown after the user enters an address on
 * the home page. Six options per spec:
 *   1. All Services
 *   2. Purchase with Cash    → /cash-buy
 *   3. Purchase with Loan    → /estimate
 *   4. Refinance             → /refinance
 *   5. Insurance             → /insurance
 *   6. Sell Your Home        → /seller
 *
 * Each option's `route` is appended with the encoded address so the
 * downstream flow starts pre-populated (no re-typing). The "Back"
 * behavior is just the browser back stack: wouter's `setLocation`
 * pushes a new history entry on selection, so hitting Back returns
 * the user here with the address preserved in the URL.
 *
 * Renaming the dashboard tabs (Cash Buy → Purchase with Cash,
 * Purchase → Purchase with Loan, For Sale → Sell Your Home) is a
 * separate, label-only change in `dashboard.tsx`. Stable internal
 * IDs and routes are unchanged so saved scenarios, drag-and-drop
 * tab order, deep links, and the data layer all keep working.
 */
const services = [
  {
    id: "all",
    icon: Layers,
    title: "All Services",
    description: "Real Estate, Mortgage & Insurance combined — the complete picture of what it costs to own this home.",
    color: "from-primary to-primary/80",
    border: "border-primary/30 hover:border-primary",
    badge: "Best Value",
    route: (addr: string) => `/estimate?address=${encodeURIComponent(addr)}&services=all`,
  },
  {
    id: "cash_buy",
    icon: Banknote,
    title: "Purchase with Cash",
    description: "Buying without a loan. We'll size up closing costs, cash to close, and ongoing carrying costs.",
    color: "from-emerald-700 to-emerald-900",
    border: "border-emerald-200 hover:border-emerald-600",
    badge: null,
    route: (addr: string) => `/cash-buy${addr ? `?address=${encodeURIComponent(addr)}` : ""}`,
  },
  {
    id: "purchase",
    icon: Key,
    title: "Purchase with Loan",
    description: "Buying with a mortgage. See your monthly payment, cash to close, and whether you qualify.",
    color: "from-blue-600 to-blue-800",
    border: "border-blue-200 hover:border-blue-500",
    badge: null,
    route: (addr: string) => `/estimate${addr ? `?address=${encodeURIComponent(addr)}` : ""}`,
  },
  {
    id: "refinance",
    icon: RefreshCw,
    title: "Refinance",
    description: "Already own the home. Analyze your savings, break-even point, and whether refinancing makes sense.",
    color: "from-primary to-primary/80",
    border: "border-primary/30 hover:border-primary",
    badge: null,
    route: (addr: string) => `/refinance${addr ? `?address=${encodeURIComponent(addr)}` : ""}`,
  },
  {
    id: "insurance",
    icon: Shield,
    title: "Insurance",
    description: "Get a homeowners insurance estimate including wind mitigation credits and flood zone analysis.",
    color: "from-emerald-600 to-emerald-800",
    border: "border-emerald-200 hover:border-emerald-500",
    badge: null,
    route: (addr: string) => `/insurance${addr ? `?address=${encodeURIComponent(addr)}` : ""}`,
  },
  {
    id: "sellers",
    icon: Tag,
    title: "Sell Your Home",
    description: "See your estimated net proceeds, payoff scenarios, and what your home is worth on today's market.",
    color: "from-amber-600 to-amber-800",
    border: "border-amber-200 hover:border-amber-600",
    badge: null,
    route: (addr: string) => `/seller${addr ? `?address=${encodeURIComponent(addr)}` : ""}`,
  },
] as const;

export default function SelectService() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const address = params.get("address") || "";

  function handleSelect(route: (addr: string) => string) {
    setLocation(route(address));
  }

  // "Change address" returns the user to the home page address entry.
  // We intentionally do NOT pre-fill or clear any Zillow / property
  // cache here — that cache is keyed by the (new) address the user
  // types next, so existing entries for other properties stay intact.
  function handleChangeAddress() {
    setLocation("/");
  }

  return (
    <>
      <Helmet>
        <title>Choose a Service — Havo</title>
      </Helmet>

      <section className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center px-4 py-16 bg-gradient-to-br from-gray-50 to-white">

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-3">
          What would you like to explore?
        </h1>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Select a service and we'll pull up everything you need for this property.
        </p>

        {/* Highlighted selected-address card. Sits directly under the
            "What would you like to explore?" question so the user
            understands which property the service options below apply
            to, and can swap it without losing their place in the flow. */}
        {address && (
          <div
            data-testid="selected-address-card"
            className="w-full max-w-xl mb-10 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-primary/5 border-2 border-primary/30 rounded-2xl shadow-sm"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary/80 mb-0.5">
                  Selected property
                </p>
                <p className="text-base font-semibold text-gray-900 break-words leading-snug">
                  {address}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleChangeAddress}
              data-testid="change-address"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-primary/40 bg-white text-sm font-semibold text-primary hover:bg-primary hover:text-white transition-colors shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              Change address
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
          {services.map(({ id, icon: Icon, title, description, color, border, badge, route }) => (
            <button
              key={id}
              onClick={() => handleSelect(route)}
              data-testid={`service-${id}`}
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
      </section>
    </>
  );
}
