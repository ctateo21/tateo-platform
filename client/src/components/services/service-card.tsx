import { useState } from "react";
import { ServiceCategory } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useServices } from "@/context/services-context";
import { SquareCheck, Square, ArrowRight, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ServiceCardProps {
  service: ServiceCategory;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const { isServiceSelected, selectService, deselectService } = useServices();
  const selected = isServiceSelected(service.id);
  const [isExpanded, setIsExpanded] = useState(false);

  const [location, navigate] = useLocation();

  const handleClick = () => {
    // Toggle service selection instead of immediate navigation
    if (selected) {
      deselectService(service.id);
    } else {
      selectService(service);
    }
  };

  // Service-specific detailed information with service options integrated
  const serviceDetails = {
    'real-estate': {
      description: "Expert guidance on buying, selling, and investing in properties across the market.",
      options: ["Buy", "Sell"], // From service.options
      benefits: [
        "Market analysis and property valuation",
        "Strategic marketing for sellers", 
        "Property search and negotiation for buyers",
        "Investment property consultation",
        "Comprehensive buyer representation",
        "Professional seller services",
        "Investment property analysis",
        "Market trend insights"
      ]
    },
    'mortgage': {
      description: "Competitive rates and flexible terms for all your home financing needs.",
      options: ["Purchase", "Refinance"], // From service.options
      benefits: [
        "Personalized loan options",
        "Refinancing opportunities", 
        "First-time homebuyer programs",
        "Cash-out refinance solutions",
        "Conventional and government loans",
        "Jumbo loan specialists",
        "Rate and term refinancing",
        "Home equity solutions"
      ]
    },
    'insurance': {
      description: "Comprehensive coverage to protect your valuable assets and investments.",
      options: ["Auto", "Property", "Flood", "Commercial"], // From service.options
      benefits: [
        "Homeowners insurance",
        "Auto insurance coverage",
        "Flood insurance protection",
        "Commercial property coverage",
        "Umbrella liability policies", 
        "Life and disability coverage",
        "Multi-policy discounts",
        "Claims assistance and support"
      ]
    },
    'construction': {
      description: "Quality construction and renovation services for residential and commercial properties.",
      options: ["Build", "Rehab"], // From service.options
      benefits: [
        "Custom home building",
        "Property rehabilitation",
        "Renovation and remodeling",
        "Project management services",
        "Construction consulting",
        "Permit assistance",
        "Quality craftsmanship",
        "Timeline and budget management"
      ]
    },
    'property-management': {
      description: "Professional management services for rental properties and investment portfolios.",
      options: ["Manage", "Rentals"], // From service.options
      benefits: [
        "Full-service property management",
        "Rental property services",
        "Tenant screening and placement",
        "Rent collection and accounting",
        "Maintenance coordination",
        "Regular property inspections",
        "Financial reporting",
        "Legal compliance assistance"
      ]
    },
    'home-services': {
      description: "Reliable home services to keep your property in top condition year-round.",
      options: ["Maintenance", "Cleaning", "Landscaping", "Other"], // From service.options
      benefits: [
        "Regular home maintenance",
        "Professional cleaning services",
        "Landscaping and lawn care", 
        "HVAC and plumbing services",
        "Electrical and handyman work",
        "Seasonal maintenance programs",
        "Emergency repair services",
        "Preventive maintenance planning"
      ]
    }
  };

  const details = serviceDetails[service.id as keyof typeof serviceDetails];
  
  return (
    <div className="flex flex-col">
      <div 
        className={cn(
          "service-card group transition-all duration-300",
          selected ? "ring-2 ring-secondary shadow-md" : "hover:shadow-lg"
        )}
        onClick={handleClick}
      >
        <div className="relative h-48 overflow-hidden">
          <div className="absolute top-3 right-3 z-10">
            {selected ? (
              <div className="bg-white rounded p-0.5 shadow-md">
                <SquareCheck className="h-6 w-6 text-primary" />
              </div>
            ) : (
              <div className="bg-white rounded p-0.5 shadow-md">
                <Square className="h-6 w-6 text-gray-600" />
              </div>
            )}
          </div>
          <img 
            src={service.imageUrl} 
            alt={`${service.displayName} Services`} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-primary p-3 transition-colors">
            <div className="flex justify-between items-center">
              <h4 className="text-white font-semibold card-title">{service.displayName}</h4>
            </div>
          </div>
        </div>
        <div className="py-4 px-5 bg-white">
          <p className="text-center text-gray-600 text-sm">
            Click to select this service for your questionnaire
          </p>
        </div>
      </div>
      
      {/* Expandable Learn More Section */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="mt-4 text-center">
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              className="border-primary text-primary hover:bg-primary hover:text-white transition-colors"
            >
              Learn More {isExpanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>
        
        <CollapsibleContent className="mt-4">
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-100">
            <p className="text-gray-600 mb-4">{details?.description}</p>
            
            {/* Service Options */}
            <div className="mb-4">
              <h4 className="font-semibold text-primary mb-2">Our {service.displayName} Services:</h4>
              <div className="flex flex-wrap gap-2 mb-4">
                {details?.options.map((option, i) => (
                  <span key={i} className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
                    {option}
                  </span>
                ))}
              </div>
            </div>

            {/* Benefits */}
            <div>
              <h4 className="font-semibold text-primary mb-2">What We Offer:</h4>
              <ul className="space-y-2">
                {details?.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start">
                    <Check className="h-5 w-5 text-secondary shrink-0 mr-2 mt-0.5" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
