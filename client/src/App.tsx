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
import ResetPassword from "./pages/reset-password";
import SelectService from "./pages/select-service";
import Subscribe from "./pages/subscribe";
import SubscribeSuccess from "./pages/subscribe-success";
import ProtectedRoute from "./components/protected-route";
import ToolGate from "./components/tool-gate";
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
                      <Route path="/settings" component={Settings} />
                      <Route path="/subscribe" component={Subscribe} />
                      <Route path="/subscribe/success" component={SubscribeSuccess} />
                      <Route path="/dashboard">
                        <ProtectedRoute><Dashboard /></ProtectedRoute>
                      </Route>
                      <Route path="/insurance">
                        <ToolGate><Insurance /></ToolGate>
                      </Route>
                      <Route path="/estimate">
                        <ToolGate><Estimate /></ToolGate>
                      </Route>
                      <Route path="/refinance">
                        <ToolGate><Refinance /></ToolGate>
                      </Route>
                      <Route path="/seller">
                        <ToolGate><SellerEstimate /></ToolGate>
                      </Route>
                      <Route path="/cash-buy">
                        <ToolGate><CashBuy /></ToolGate>
                      </Route>
                      <Route path="/reset-password" component={ResetPassword} />
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
