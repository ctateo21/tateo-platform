import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServicesProvider } from "./context/services-context";
import { AuthProvider } from "./context/auth-context";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

import Header from "./components/layout/header";
import Footer from "./components/layout/footer";
import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import Settings from "./pages/settings";
import Insurance from "./pages/insurance";
import Estimate from "./pages/estimate";
import Refinance from "./pages/refinance";
import SellerEstimate from "./pages/seller-estimate";
import CashBuy from "./pages/cash-buy";
import SelectService from "./pages/select-service";
import NotFound from "./pages/not-found";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <ServicesProvider>
            <ScrollToTop />
            <Switch>
              <Route>
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-grow">
                    <Switch>
                      <Route path="/" component={Home} />
                      <Route path="/dashboard" component={Dashboard} />
                      <Route path="/settings" component={Settings} />
                      <Route path="/insurance" component={Insurance} />
                      <Route path="/estimate" component={Estimate} />
                      <Route path="/refinance" component={Refinance} />
                      <Route path="/seller" component={SellerEstimate} />
                      <Route path="/cash-buy" component={CashBuy} />
                      <Route path="/select-service" component={SelectService} />
                      <Route component={NotFound} />
                    </Switch>
                  </main>
                  <Footer />
                </div>
              </Route>
            </Switch>
            <Toaster />
          </ServicesProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
