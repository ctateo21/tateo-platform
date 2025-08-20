import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, FileText, CreditCard, Building, Home, Globe, Calculator, TrendingUp, FileCheck, Eye } from "lucide-react";

const nonQMOptions = [
  {
    value: 'itin',
    label: 'ITIN',
    title: 'ITIN Loan',
    description: 'For borrowers with Individual Taxpayer Identification Numbers who don\'t have a Social Security Number but have established credit and income in the US.',
    icon: FileText,
    color: 'blue'
  },
  {
    value: 'bank-statement',
    label: 'Bank Statement',
    title: 'Bank Statement Loan',
    description: 'Income verification through bank statements rather than tax returns. Ideal for self-employed borrowers or those with non-traditional income sources.',
    icon: CreditCard,
    color: 'green'
  },
  {
    value: 'bridge',
    label: 'Bridge',
    title: 'Bridge Loan',
    description: 'Short-term financing to bridge the gap between buying a new home and selling your current one. Typically 6-12 month terms.',
    icon: Building,
    color: 'orange'
  },
  {
    value: 'reverse-mortgage',
    label: 'Reverse Mortgage',
    title: 'Reverse Mortgage',
    description: 'For homeowners 62+ who want to convert home equity into cash payments while continuing to live in their home.',
    icon: Home,
    color: 'purple'
  },
  {
    value: 'foreign-national',
    label: 'Foreign National',
    title: 'Foreign National Loan',
    description: 'For non-US residents looking to purchase property in the United States. Special documentation and down payment requirements apply.',
    icon: Globe,
    color: 'indigo'
  },
  {
    value: 'profit-loss-cpa',
    label: 'P&L by CPA',
    title: 'Profit & Loss by CPA',
    description: 'Income verification through CPA-prepared profit and loss statements. Suitable for business owners with complex financial situations.',
    icon: Calculator,
    color: 'emerald'
  },
  {
    value: 'asset-depletion',
    label: 'Asset Depletion',
    title: 'Asset Depletion Loan',
    description: 'Qualify based on liquid assets rather than monthly income. A percentage of assets is counted as monthly qualifying income.',
    icon: TrendingUp,
    color: 'rose'
  },
  {
    value: '1099',
    label: '1099',
    title: '1099 Loan Program',
    description: 'Designed for independent contractors and freelancers who receive 1099 forms. Flexible income documentation requirements.',
    icon: FileCheck,
    color: 'amber'
  },
  {
    value: 'voe-only',
    label: 'VOE Only',
    title: 'Verification of Employment Only',
    description: 'Simplified documentation with verification of employment only. Reduced paperwork for qualified borrowers with stable employment.',
    icon: Eye,
    color: 'cyan'
  }
];

interface NonQMStepProps {
  onSubmit: (data: { nonQMType: string }) => void;
  onBack: () => void;
  defaultValues?: { nonQMType?: string };
}

export function NonQMStep({ onSubmit, onBack, defaultValues }: NonQMStepProps) {
  const [selected, setSelected] = useState<string | null>(defaultValues?.nonQMType || null);

  const handleSubmit = () => {
    if (selected) {
      onSubmit({ nonQMType: selected });
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
      orange: {
        selected: "ring-2 ring-orange-500 border-orange-500 bg-orange-50",
        hover: "hover:border-orange-300",
        icon: "text-orange-600",
        bg: "bg-orange-100"
      },
      purple: {
        selected: "ring-2 ring-purple-500 border-purple-500 bg-purple-50",
        hover: "hover:border-purple-300",
        icon: "text-purple-600",
        bg: "bg-purple-100"
      },
      indigo: {
        selected: "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50",
        hover: "hover:border-indigo-300",
        icon: "text-indigo-600",
        bg: "bg-indigo-100"
      },
      emerald: {
        selected: "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50",
        hover: "hover:border-emerald-300",
        icon: "text-emerald-600",
        bg: "bg-emerald-100"
      },
      rose: {
        selected: "ring-2 ring-rose-500 border-rose-500 bg-rose-50",
        hover: "hover:border-rose-300",
        icon: "text-rose-600",
        bg: "bg-rose-100"
      },
      amber: {
        selected: "ring-2 ring-amber-500 border-amber-500 bg-amber-50",
        hover: "hover:border-amber-300",
        icon: "text-amber-600",
        bg: "bg-amber-100"
      },
      cyan: {
        selected: "ring-2 ring-cyan-500 border-cyan-500 bg-cyan-50",
        hover: "hover:border-cyan-300",
        icon: "text-cyan-600",
        bg: "bg-cyan-100"
      }
    };

    return colorMap[color] || colorMap.blue;
  };

  return (
    <Card className="w-full max-w-5xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Non-QM Loan Options</CardTitle>
        <CardDescription>
          Choose the Non-Qualified Mortgage option that best fits your situation
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nonQMOptions.map((option) => {
            const colors = getColorClasses(option.color, selected === option.value);
            const IconComponent = option.icon;
            
            return (
              <Card 
                key={option.value}
                className={`cursor-pointer transition-all border-2 h-full ${
                  selected === option.value 
                    ? colors.selected
                    : `border-gray-200 ${colors.hover}`
                }`}
                onClick={() => setSelected(option.value)}
              >
                <CardHeader className="text-center py-4">
                  <div className={`mx-auto mb-3 w-12 h-12 ${colors.bg} rounded-full flex items-center justify-center`}>
                    <IconComponent className={`h-6 w-6 ${colors.icon}`} />
                  </div>
                  <CardTitle className="text-lg">{option.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm text-center leading-relaxed">
                    {option.description}
                  </CardDescription>
                </CardContent>
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
      </CardContent>
    </Card>
  );
}