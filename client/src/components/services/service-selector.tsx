import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ServiceCategory, serviceCategories } from "@shared/schema";
import ServiceCard from "./service-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, X } from "lucide-react";
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
    <section id="services" className="py-12 pb-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <h2 className="text-3xl md:text-5xl font-bold mb-3 text-primary">
            Our Services
          </h2>
          <div className="w-20 h-1 bg-secondary mx-auto mb-4"></div>
          <p className="text-black font-bold text-lg mb-6 underline">
            Pick which services you are looking for
          </p>
        </div>
        
        {/* Service Selection */}
        <div className="mb-12">
          <div className="flex justify-end mb-2">
            {selectedServices.length > 0 && (
              <Button
                onClick={handleContinue}
                className="bg-secondary hover:bg-secondary/90 text-white"
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Service Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-80 bg-gray-100 animate-pulse rounded-lg"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map((service: ServiceCategory) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </div>
        
        {/* Selected Services */}
        {selectedServices.length > 0 && (
          <div className="mb-12 p-6 bg-white rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold mb-4 text-primary">Your Selected Services:</h3>
            <div className="flex flex-wrap gap-3">
              {selectedServices.map((service) => (
                <Badge 
                  key={service.id} 
                  className="bg-primary/10 text-primary px-4 py-2 rounded-full flex items-center text-sm"
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
