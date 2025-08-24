import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Building2, Home, Shield, Leaf, Banknote, Users, FileText } from "lucide-react";
import { ReviewsSection } from "./reviews-section";

const loanTypes = [
  { 
    value: "conventional", 
    label: "Conventional", 
    description: "Traditional mortgage not backed by government",
    icon: Building2,
    color: "blue"
  },
  { 
    value: "fha", 
    label: "FHA", 
    description: "Government-backed loan with lower down payment",
    icon: Shield,
    color: "green"
  },
  { 
    value: "va", 
    label: "VA", 
    description: "Veterans Affairs loan for military members",
    icon: Home,
    color: "purple"
  },
  { 
    value: "usda", 
    label: "USDA", 
    description: "Rural development loan for eligible areas",
    icon: Leaf,
    color: "emerald"
  },
  { 
    value: "jumbo", 
    label: "Jumbo", 
    description: "High-balance loan exceeding conforming limits",
    icon: Banknote,
    color: "orange"
  },
  { 
    value: "non-qm", 
    label: "Non-QM", 
    description: "Non-qualified mortgage including 5+ units & unique situations",
    icon: FileText,
    color: "rose"
  }
];

interface LoanTypeStepProps {
  onSubmit: (data: { loanType: string }) => void;
  onBack: () => void;
  defaultValues?: { loanType?: string };
}

export function LoanTypeStep({ onSubmit, onBack, defaultValues }: LoanTypeStepProps) {
  const [selected, setSelected] = useState<string | null>(defaultValues?.loanType || null);

  const handleSubmit = () => {
    if (selected) {
      onSubmit({ loanType: selected });
    }
  };

  const getColorClasses = (color: string, isSelected: boolean) => {
    const colorMap: Record<string, { selected: string; hover: string; icon: string; bg: string }> = {
      blue: {
        selected: "ring-2 ring-blue-500 border-blue-500 bg-blue-50",
        hover: "hover:border-blue-300",
        icon: "text-blue-600",
        bg: "bg-blue-100"
      },
      green: {
        selected: "ring-2 ring-green-500 border-green-500 bg-green-50",
        hover: "hover:border-green-300",
        icon: "text-green-600",
        bg: "bg-green-100"
      },
      purple: {
        selected: "ring-2 ring-purple-500 border-purple-500 bg-purple-50",
        hover: "hover:border-purple-300",
        icon: "text-purple-600",
        bg: "bg-purple-100"
      },
      emerald: {
        selected: "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50",
        hover: "hover:border-emerald-300",
        icon: "text-emerald-600",
        bg: "bg-emerald-100"
      },
      orange: {
        selected: "ring-2 ring-orange-500 border-orange-500 bg-orange-50",
        hover: "hover:border-orange-300",
        icon: "text-orange-600",
        bg: "bg-orange-100"
      },
      indigo: {
        selected: "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50",
        hover: "hover:border-indigo-300",
        icon: "text-indigo-600",
        bg: "bg-indigo-100"
      },
      rose: {
        selected: "ring-2 ring-rose-500 border-rose-500 bg-rose-50",
        hover: "hover:border-rose-300",
        icon: "text-rose-600",
        bg: "bg-rose-100"
      }
    };

    return colorMap[color] || colorMap.blue;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Loan Type Selection</CardTitle>
        <CardDescription>
          Choose the type of loan that best fits your situation and needs
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-6">
            Which loan type would you like to explore?
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loanTypes.map((loanType) => {
            const colors = getColorClasses(loanType.color, selected === loanType.value);
            const IconComponent = loanType.icon;
            
            return (
              <Card 
                key={loanType.value}
                className={`cursor-pointer transition-all border-2 ${
                  selected === loanType.value 
                    ? colors.selected
                    : `border-gray-200 ${colors.hover}`
                }`}
                onClick={() => setSelected(loanType.value)}
              >
                <CardHeader className="text-center py-6">
                  <div className={`mx-auto mb-4 w-12 h-12 ${colors.bg} rounded-full flex items-center justify-center`}>
                    <IconComponent className={`h-6 w-6 ${colors.icon}`} />
                  </div>
                  <CardTitle className="text-lg">{loanType.label}</CardTitle>
                  <CardDescription className="text-sm text-center">
                    {loanType.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-between mt-8">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!selected}
          >
            Continue <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
          </Button>
        </div>

        <ReviewsSection />
      </CardContent>
    </Card>
  );
}