import { ServiceCategory } from "@shared/schema";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useServices } from "@/context/services-context";
import { SquareCheck, Square } from "lucide-react";

interface ServiceCardProps {
  service: ServiceCategory;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const { isServiceSelected, selectService, deselectService } = useServices();
  const selected = isServiceSelected(service.id);

  const handleClick = () => {
    // Keep the selection functionality for the questionnaire
    if (selected) {
      deselectService(service.id);
    } else {
      selectService(service);
    }
  };
  
  return (
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
        <div className="flex flex-wrap gap-2 justify-center items-center">
          {service.options.map((option, index) => (
            <span key={index} className="text-base bg-gray-200 text-gray-800 px-4 py-2 rounded-full font-medium text-center hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer">
              {option}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
