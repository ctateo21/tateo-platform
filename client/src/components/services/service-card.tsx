import { ServiceCategory } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useServices } from "@/context/services-context";
import { Check } from "lucide-react";

interface ServiceCardProps {
  service: ServiceCategory;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const { isServiceSelected, selectService, deselectService } = useServices();
  const selected = isServiceSelected(service.id);

  const handleClick = () => {
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
        <img 
          src={service.imageUrl} 
          alt={`${service.displayName} Services`} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-primary p-3 transition-colors">
          <div className="flex justify-between items-center">
            <h4 className="text-white font-semibold card-title">{service.displayName}</h4>
            {selected && (
              <div className="bg-secondary rounded-full w-6 h-6 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
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
