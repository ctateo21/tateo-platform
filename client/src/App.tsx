import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServicesProvider } from "./context/services-context";

import Header from "./components/layout/header";
import Footer from "./components/layout/footer";
import Home from "./pages/home";
import Questionnaire from "./pages/questionnaire";
import RealEstate from "./pages/real-estate";
import NotFound from "./pages/not-found";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ServicesProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/questionnaire" component={Questionnaire} />
                <Route path="/real-estate" component={RealEstate} />
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
