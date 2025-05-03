import { createContext, useContext, useState, ReactNode } from "react";
import { ServiceCategory, serviceCategories } from "@shared/schema";

interface ServicesContextType {
  selectedServices: ServiceCategory[];
  selectService: (service: ServiceCategory) => void;
  deselectService: (serviceId: string) => void;
  clearSelectedServices: () => void;
  isServiceSelected: (serviceId: string) => boolean;
}

const ServicesContext = createContext<ServicesContextType | undefined>(undefined);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const [selectedServices, setSelectedServices] = useState<ServiceCategory[]>([]);

  const selectService = (service: ServiceCategory) => {
    if (!isServiceSelected(service.id)) {
      setSelectedServices(prev => [...prev, service]);
    }
  };

  const deselectService = (serviceId: string) => {
    setSelectedServices(prev => prev.filter(service => service.id !== serviceId));
  };

  const clearSelectedServices = () => {
    setSelectedServices([]);
  };

  const isServiceSelected = (serviceId: string) => {
    return selectedServices.some(service => service.id === serviceId);
  };

  return (
    <ServicesContext.Provider
      value={{
        selectedServices,
        selectService,
        deselectService,
        clearSelectedServices,
        isServiceSelected
      }}
    >
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices() {
  const context = useContext(ServicesContext);
  if (context === undefined) {
    throw new Error("useServices must be used within a ServicesProvider");
  }
  return context;
}
