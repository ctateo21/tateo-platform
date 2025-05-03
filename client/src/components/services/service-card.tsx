import { ServiceCategory } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useServices } from "@/context/services-context";

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
        "service-card",
        selected && "selected"
      )}
      onClick={handleClick}
    >
      <div className="relative h-48">
        <img 
          src={service.imageUrl} 
          alt={`${service.displayName} Services`} 
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-dark/70 p-3">
          <h4 className="text-white font-semibold">{service.displayName}</h4>
        </div>
      </div>
      <div className="p-4 bg-white">
        <p className="text-foreground/80 mb-4">{service.description}</p>
        <div className="flex flex-wrap gap-2">
          {service.options.map((option, index) => (
            <span key={index} className="text-sm bg-gray-100 text-foreground/70 px-3 py-1 rounded-full">
              {option}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
