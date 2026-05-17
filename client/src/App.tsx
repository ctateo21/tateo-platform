import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServicesProvider } from "./context/services-context";

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
import Questionnaire from "./pages/questionnaire";
import ServiceQuestionnaire from "./pages/service-questionnaire";
import RealEstate from "./pages/real-estate";
import Mortgage from "./pages/mortgage-new-fixed";
import Insurance from "./pages/insurance";
import Construction from "./pages/construction";
import PropertyManagement from "./pages/property-management";
import HomeServices from "./pages/home-services";
import Review from "./pages/review-new";
import Estimate from "./pages/estimate";
import SelectService from "./pages/select-service";
import NotFound from "./pages/not-found";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ServicesProvider>
          <ScrollToTop />
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/questionnaire" component={Questionnaire} />
                <Route path="/service-questionnaire" component={ServiceQuestionnaire} />
                <Route path="/real-estate" component={RealEstate} />
                <Route path="/mortgage" component={Mortgage} />
                <Route path="/insurance" component={Insurance} />
                <Route path="/construction" component={Construction} />
                <Route path="/property-management" component={PropertyManagement} />
                <Route path="/home-services" component={HomeServices} />
                <Route path="/review" component={Review} />
                <Route path="/estimate" component={Estimate} />
                <Route path="/select-service" component={SelectService} />
                <Route component={NotFound} />
              </Switch>
            </main>
            <Footer />
          </div>
          <Toaster />
        </ServicesProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
