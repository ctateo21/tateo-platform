import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, HandCoins, X, HelpCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LoanAssistanceStepProps {
  onSubmit: (data: { assistanceType: string }) => void;
  onBack: () => void;
  loanType: string;
  defaultValues?: { assistanceType?: string };
}

export function LoanAssistanceStep({ onSubmit, onBack, loanType, defaultValues }: LoanAssistanceStepProps) {
  const [selected, setSelected] = useState<string | null>(defaultValues?.assistanceType || null);

  const handleSubmit = () => {
    if (selected) {
      onSubmit({ assistanceType: selected });
    }
  };

  const getAssistanceOptions = () => {
    switch (loanType) {
      case 'conventional':
      case 'fha':
        return [
          {
            value: 'dpa',
            label: 'DPA',
            title: 'Down Payment Assistance',
            description: 'Get help with your down payment through assistance programs',
            icon: HandCoins,
            color: 'green'
          },
          {
            value: 'no-dpa',
            label: 'No DPA',
            title: 'No Down Payment Assistance',
            description: 'I will handle the down payment myself',
            icon: X,
            color: 'blue'
          }
        ];
      
      case 'va':
      case 'usda':
        return [
          {
            value: 'closing-assistance',
            label: 'Assistance',
            title: 'Assistance with Closing Costs',
            description: 'Get help with closing costs through assistance programs',
            icon: HandCoins,
            color: 'green'
          },
          {
            value: 'no-assistance',
            label: 'No Assistance',
            title: 'No Assistance with Closing Costs',
            description: 'I will handle the closing costs myself',
            icon: X,
            color: 'blue'
          }
        ];
      
      default:
        return [];
    }
  };

  const getStepTitle = () => {
    switch (loanType) {
      case 'conventional':
        return 'Conventional Loan - Down Payment Assistance';
      case 'fha':
        return 'FHA Loan - Down Payment Assistance';
      case 'va':
        return 'VA Loan - Closing Cost Assistance';
      case 'usda':
        return 'USDA Loan - Closing Cost Assistance';
      default:
        return 'Loan Assistance Options';
    }
  };

  const getStepDescription = () => {
    switch (loanType) {
      case 'conventional':
      case 'fha':
        return 'Would you like assistance with your down payment?';
      case 'va':
      case 'usda':
        return 'Would you like assistance with your closing costs?';
      default:
        return 'Choose your assistance preference';
    }
  };

  const options = getAssistanceOptions();

  const getColorClasses = (color: string, isSelected: boolean) => {
    const colorMap: Record<string, { selected: string; hover: string; icon: string; bg: string }> = {
      green: {
        selected: "ring-2 ring-green-500 border-green-500 bg-green-50",
        hover: "hover:border-green-300",
        icon: "text-green-600",
        bg: "bg-green-100"
      },
      blue: {
        selected: "ring-2 ring-blue-500 border-blue-500 bg-blue-50",
        hover: "hover:border-blue-300",
        icon: "text-blue-600",
        bg: "bg-blue-100"
      }
    };

    return colorMap[color] || colorMap.blue;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{getStepTitle()}</CardTitle>
        <CardDescription>
          {getStepDescription()}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((option) => {
            const colors = getColorClasses(option.color, selected === option.value);
            const IconComponent = option.icon;
            
            return (
              <Card 
                key={option.value}
                className={`cursor-pointer transition-all border-2 ${
                  selected === option.value 
                    ? colors.selected
                    : `border-gray-200 ${colors.hover}`
                }`}
                onClick={() => setSelected(option.value)}
              >
                <CardHeader className="text-center py-6">
                  <div className={`mx-auto mb-4 w-16 h-16 ${colors.bg} rounded-full flex items-center justify-center`}>
                    <IconComponent className={`h-8 w-8 ${colors.icon}`} />
                  </div>
                  <CardTitle className="text-lg">{option.title}</CardTitle>
                  <CardDescription className="text-sm text-center">
                    {option.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* Important notes about assistance programs */}
        <div className="space-y-4 mt-6">
          {loanType === 'conventional' || loanType === 'fha' ? (
            <>
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>Important:</strong> Lenders usually charge higher rates or fees when using down payment assistance programs.
                </AlertDescription>
              </Alert>
              <Alert className="border-blue-200 bg-blue-50">
                <HelpCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Seller Concessions:</strong> {loanType === 'fha' 
                    ? 'To cover closing costs, it is possible to get UP TO 6% in seller concessions.'
                    : 'To cover closing costs, it is possible to get UP TO 3% in seller concessions.'
                  }
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <>
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>Important:</strong> Assistance with closing costs can be in the form of a seller credit or a grant program. Grant programs may charge higher fees or rates.
                </AlertDescription>
              </Alert>
              <Alert className="border-blue-200 bg-blue-50">
                <HelpCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Seller Concessions:</strong> {loanType === 'usda' 
                    ? 'To cover closing costs, it is possible to get UP TO 6% in seller concessions.'
                    : 'To cover closing costs, it is possible to get UP TO 4% in seller concessions.'
                  }
                </AlertDescription>
              </Alert>
            </>
          )}
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