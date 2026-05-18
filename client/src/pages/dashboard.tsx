import { useState } from "react";
import { useLocation } from "wouter";
import {
  Home, RefreshCw, Shield, Search, LogOut, Trash2, ExternalLink,
  MapPin, TrendingDown, DollarSign, Calendar, ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/auth-context";
import {
  getPurchaseScenarios, savePurchaseScenarios,
  getInsuranceScenarios, saveInsuranceScenarios,
  type PurchaseScenario, type InsuranceScenario,
} from "@/lib/auth";
import type { TrackedLoan } from "@/components/refi/loan-tracker";

const REFI_KEY = "refinance-tracked-loans";
const PROPERTY_TYPE_LABELS: Record<string, string> = {
  primary: "Primary Home", secondary: "2nd Home", investment: "Investment",
};
const PROPERTY_TYPE_COLORS: Record<string, string> = {
  primary: "bg-background text-foreground border",
  secondary: "bg-amber-600 text-white border-amber-600",
  investment: "bg-red-600 text-white border-red-600",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function loadRefiLoans(): TrackedLoan[] {
  try { return JSON.parse(localStorage.getItem(REFI_KEY) || "[]"); }
  catch { return []; }
}
function saveRefiLoans(loans: TrackedLoan[]) {
  try { localStorage.setItem(REFI_KEY, JSON.stringify(loans)); } catch {}
}

// ── Empty state ─────────────────────────────────────────────────────
function EmptyState({ icon, title, body, cta, href }: {
  icon: React.ReactNode; title: string; body: string; cta: string; href: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="text-muted-foreground/50">{icon}</div>
      <div>
        <p className="font-semibold text-lg">{title}</p>
        <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">{body}</p>
      </div>
      <Button onClick={() => setLocation(href)} className="mt-2 gap-2">
        <Search className="h-4 w-4" /> {cta}
      </Button>
    </div>
  );
}

// ── Refinance Tab ───────────────────────────────────────────────────
function RefiTab() {
  const [, setLocation] = useLocation();
  const [loans, setLoans] = useState<TrackedLoan[]>(loadRefiLoans);

  function remove(id: string) {
    const updated = loans.filter(l => l.id !== id);
    setLoans(updated);
    saveRefiLoans(updated);
  }

  if (loans.length === 0) {
    return (
      <EmptyState
        icon={<RefreshCw className="h-12 w-12" />}
        title="No refinance loans saved yet"
        body="Upload a mortgage statement on the refinance page to analyze and save your loan."
        cta="Go to Refinance"
        href="/refinance"
      />
    );
  }

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {loans.map(loan => (
        <Card key={loan.id} className="group relative hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-sm font-semibold leading-snug line-clamp-2 flex-1">
                <MapPin className="inline h-3.5 w-3.5 mr-1 text-muted-foreground shrink-0" />
                {loan.propertyAddress}
              </CardTitle>
              <Badge variant="outline" className={`text-xs shrink-0 ${PROPERTY_TYPE_COLORS[loan.propertyType] || ""}`}>
                {PROPERTY_TYPE_LABELS[loan.propertyType] || loan.propertyType}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{loan.lender}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="font-semibold">{formatCurrency(loan.loanBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rate</p>
                <p className="font-semibold">{loan.currentRate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly P&amp;I</p>
                <p className="font-semibold">{formatCurrency(loan.currentPI)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Est. Value</p>
                <p className="font-semibold">{formatCurrency(loan.estimatedHomeValue)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Saved {formatDate(loan.addedAt)}
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1 text-xs"
                onClick={() => setLocation("/refinance")}
              >
                Open <ExternalLink className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive px-2">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this loan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove {loan.propertyAddress} from your saved scenarios. You can re-analyze it anytime.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(loan.id)} className="bg-destructive hover:bg-destructive/90">
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add more CTA */}
      <button
        onClick={() => setLocation("/refinance")}
        className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[180px]"
      >
        <RefreshCw className="h-6 w-6" />
        <span className="text-sm font-medium">Analyze another loan</span>
      </button>
    </div>
  );
}

// ── Purchase Tab ────────────────────────────────────────────────────
function PurchaseTab() {
  const [, setLocation] = useLocation();
  const [scenarios, setScenarios] = useState<PurchaseScenario[]>(getPurchaseScenarios);

  function remove(id: string) {
    const updated = scenarios.filter(s => s.id !== id);
    setScenarios(updated);
    savePurchaseScenarios(updated);
  }

  if (scenarios.length === 0) {
    return (
      <EmptyState
        icon={<Home className="h-12 w-12" />}
        title="No purchase scenarios saved yet"
        body="Search for a property and save your estimate to track it here."
        cta="Search a Property"
        href="/"
      />
    );
  }

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {scenarios.map(s => (
        <Card key={s.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold leading-snug line-clamp-2">
              <MapPin className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
              {s.address}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {s.price != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="font-semibold">{formatCurrency(s.price)}</p>
                </div>
              )}
              {s.monthlyPayment != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Payment</p>
                  <p className="font-semibold">{formatCurrency(s.monthlyPayment)}</p>
                </div>
              )}
              {s.downPayment != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Down Payment</p>
                  <p className="font-semibold">{formatCurrency(s.downPayment)}</p>
                </div>
              )}
              {s.interestRate != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="font-semibold">{s.interestRate}%</p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Saved {formatDate(s.savedAt)}
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1 text-xs"
                onClick={() => setLocation(`/select-service?address=${encodeURIComponent(s.address)}`)}
              >
                Open <ExternalLink className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive px-2">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this scenario?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove {s.address} from your saved purchase scenarios.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(s.id)} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}

      <button
        onClick={() => setLocation("/")}
        className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[180px]"
      >
        <Search className="h-6 w-6" />
        <span className="text-sm font-medium">Search another property</span>
      </button>
    </div>
  );
}

// ── Insurance Tab ───────────────────────────────────────────────────
function InsuranceTab() {
  const [, setLocation] = useLocation();
  const [scenarios, setScenarios] = useState<InsuranceScenario[]>(getInsuranceScenarios);

  function remove(id: string) {
    const updated = scenarios.filter(s => s.id !== id);
    setScenarios(updated);
    saveInsuranceScenarios(updated);
  }

  if (scenarios.length === 0) {
    return (
      <EmptyState
        icon={<Shield className="h-12 w-12" />}
        title="No insurance quotes saved yet"
        body="Get an insurance quote on any property to save it here for easy reference."
        cta="Get a Quote"
        href="/insurance"
      />
    );
  }

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {scenarios.map(s => (
        <Card key={s.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold leading-snug line-clamp-2">
              <MapPin className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
              {s.address}
            </CardTitle>
            {s.coverageType && (
              <Badge variant="secondary" className="text-xs w-fit">{s.coverageType}</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {s.annualPremium != null && (
              <div>
                <p className="text-xs text-muted-foreground">Est. Annual Premium</p>
                <p className="font-semibold text-lg">{formatCurrency(s.annualPremium)}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Saved {formatDate(s.savedAt)}
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1 text-xs"
                onClick={() => setLocation(`/insurance?address=${encodeURIComponent(s.address)}`)}
              >
                Open <ExternalLink className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive px-2">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this quote?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove {s.address} from your saved insurance scenarios.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(s.id)} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}

      <button
        onClick={() => setLocation("/insurance")}
        className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[180px]"
      >
        <Shield className="h-6 w-6" />
        <span className="text-sm font-medium">Get another quote</span>
      </button>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    setLocation("/");
    return null;
  }

  const initials = user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  function handleLogout() {
    logout();
    setLocation("/");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Dashboard header bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setLocation("/")}
            >
              <Search className="h-4 w-4" /> Search Property
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" /> Log Out
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">My Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your saved property scenarios, all in one place.</p>
        </div>

        <Tabs defaultValue="purchase">
          <TabsList className="mb-6">
            <TabsTrigger value="purchase" className="gap-2">
              <Home className="h-4 w-4" /> Purchase
            </TabsTrigger>
            <TabsTrigger value="refinance" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refinance
            </TabsTrigger>
            <TabsTrigger value="insurance" className="gap-2">
              <Shield className="h-4 w-4" /> Insurance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchase">
            <PurchaseTab />
          </TabsContent>

          <TabsContent value="refinance">
            <RefiTab />
          </TabsContent>

          <TabsContent value="insurance">
            <InsuranceTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
