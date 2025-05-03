import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ServiceCategory, serviceCategories } from "@shared/schema";
import ServiceCard from "./service-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useServices } from "@/context/services-context";
import { useToast } from "@/hooks/use-toast";

export default function ServiceSelector() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { selectedServices, deselectService } = useServices();

  const { data: services, isLoading } = useQuery({
    queryKey: ["/api/services"],
    initialData: serviceCategories,
  });

  const handleContinue = () => {
    if (selectedServices.length === 0) {
      toast({
        title: "No services selected",
        description: "Please select at least one service to continue.",
        variant: "destructive",
      });
      return;
    }
    
    navigate("/questionnaire");
  };

  return (
    <section id="services" className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Services</h2>
          <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
            Select from our comprehensive range of real estate services to get started on your journey.
          </p>
        </div>
        
        {/* Service Selection */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <h3 className="text-2xl font-semibold mb-4 md:mb-0">What can we help you with today?</h3>
            <Button
              onClick={handleContinue}
              className={selectedServices.length === 0 ? "hidden" : ""}
            >
              Continue <span className="ml-2">→</span>
            </Button>
          </div>
          
          <p className="text-foreground/70 mb-6">Select one or more services to begin:</p>
          
          {/* Service Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-80 bg-gray-100 animate-pulse rounded-lg"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service: ServiceCategory) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </div>
        
        {/* Selected Services */}
        {selectedServices.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xl font-semibold mb-4">Your Selected Services:</h3>
            <div className="flex flex-wrap gap-3">
              {selectedServices.map((service) => (
                <Badge 
                  key={service.id} 
                  className="bg-primary/10 text-primary px-3 py-1 rounded-full flex items-center"
                >
                  {service.displayName}
                  <button
                    className="ml-2 text-primary/70 hover:text-primary"
                    onClick={() => deselectService(service.id)}
                    aria-label={`Remove ${service.displayName}`}
                  >
                    <X size={14} />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
