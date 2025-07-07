import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { TruvIntegration } from "./truv-integration";
import { TaxStatusIntegration } from "./taxstatus-integration";

interface IncomeTypeSelectionProps {
  onComplete: (data: any) => void;
  onBack: () => void;
  defaultValues?: any;
}

export function IncomeTypeSelection({ onComplete, onBack, defaultValues }: IncomeTypeSelectionProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(defaultValues?.incomeTypes || []);
  const [currentStep, setCurrentStep] = useState<'selection' | 'truv' | 'taxstatus' | 'retired'>('selection');
  const [apiData, setApiData] = useState<any>({});

  const incomeTypes = [
    {
      id: 'salary-hourly',
      label: 'Salary or Hourly',
      description: 'W-2 employment income from salary or hourly wages'
    },
    {
      id: 'self-employed',
      label: 'Self Employed or 1099',
      description: 'Self-employment income, contractor work, or business ownership'
    },
    {
      id: 'retired',
      label: 'Retired',
      description: 'Social Security, pension, retirement accounts, or other retirement income'
    }
  ];

  const handleTypeChange = (typeId: string, checked: boolean) => {
    if (checked) {
      setSelectedTypes(prev => [...prev, typeId]);
    } else {
      setSelectedTypes(prev => prev.filter(id => id !== typeId));
    }
  };

  const handleContinue = () => {
    if (selectedTypes.length === 0) return;

    // If only retired is selected, go directly to retired flow
    if (selectedTypes.length === 1 && selectedTypes.includes('retired')) {
      setCurrentStep('retired');
      return;
    }

    // If salary-hourly is selected, start with Truv
    if (selectedTypes.includes('salary-hourly')) {
      setCurrentStep('truv');
      return;
    }

    // If self-employed is selected, start with TaxStatus
    if (selectedTypes.includes('self-employed')) {
      setCurrentStep('taxstatus');
      return;
    }
  };

  const handleTruvComplete = (data: any) => {
    setApiData(prev => ({ ...prev, truv: data }));
    
    // If also self-employed, go to TaxStatus next
    if (selectedTypes.includes('self-employed')) {
      setCurrentStep('taxstatus');
    } else if (selectedTypes.includes('retired')) {
      setCurrentStep('retired');
    } else {
      // Complete the flow
      onComplete({
        incomeTypes: selectedTypes,
        apiIntegrations: { ...apiData, truv: data }
      });
    }
  };

  const handleTaxStatusComplete = (data: any) => {
    setApiData(prev => ({ ...prev, taxstatus: data }));
    
    // If also retired, go to retired flow
    if (selectedTypes.includes('retired')) {
      setCurrentStep('retired');
    } else {
      // Complete the flow
      onComplete({
        incomeTypes: selectedTypes,
        apiIntegrations: { ...apiData, taxstatus: data }
      });
    }
  };

  const handleTruvSkip = () => {
    // If also self-employed, go to TaxStatus next
    if (selectedTypes.includes('self-employed')) {
      setCurrentStep('taxstatus');
    } else if (selectedTypes.includes('retired')) {
      setCurrentStep('retired');
    } else {
      // Complete the flow
      onComplete({
        incomeTypes: selectedTypes,
        apiIntegrations: apiData,
        skipTruv: true
      });
    }
  };

  const handleTaxStatusSkip = () => {
    // If also retired, go to retired flow
    if (selectedTypes.includes('retired')) {
      setCurrentStep('retired');
    } else {
      // Complete the flow
      onComplete({
        incomeTypes: selectedTypes,
        apiIntegrations: apiData,
        skipTaxStatus: true
      });
    }
  };

  const handleRetiredComplete = () => {
    // Complete the flow with all collected data
    onComplete({
      incomeTypes: selectedTypes,
      apiIntegrations: apiData,
      continueToRetiredFlow: true
    });
  };

  if (currentStep === 'truv') {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setCurrentStep('selection')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Income Selection
        </Button>
        <TruvIntegration onComplete={handleTruvComplete} onSkip={handleTruvSkip} />
      </div>
    );
  }

  if (currentStep === 'taxstatus') {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => {
            // Go back to appropriate step
            if (selectedTypes.includes('salary-hourly') && !apiData.truv) {
              setCurrentStep('truv');
            } else {
              setCurrentStep('selection');
            }
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <TaxStatusIntegration onComplete={handleTaxStatusComplete} onSkip={handleTaxStatusSkip} />
      </div>
    );
  }

  if (currentStep === 'retired') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Retirement Income</CardTitle>
          <CardDescription>
            You'll continue with the standard questionnaire for retirement income details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              The next step will ask for details about your retirement income sources including 
              Social Security, pensions, 401(k) distributions, and other retirement benefits.
            </p>
          </div>
          
          <div className="flex space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => {
                // Go back to appropriate step
                if (selectedTypes.includes('self-employed') && !apiData.taxstatus) {
                  setCurrentStep('taxstatus');
                } else if (selectedTypes.includes('salary-hourly') && !apiData.truv) {
                  setCurrentStep('truv');
                } else {
                  setCurrentStep('selection');
                }
              }}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleRetiredComplete} className="flex-1">
              Continue to Retirement Details
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Income Information</CardTitle>
        <CardDescription>
          What type of income do you receive? You may select multiple options.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {incomeTypes.map((type) => (
            <div key={type.id} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id={type.id}
                checked={selectedTypes.includes(type.id)}
                onCheckedChange={(checked) => handleTypeChange(type.id, checked as boolean)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <label 
                  htmlFor={type.id} 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {type.label}
                </label>
                <p className="text-sm text-gray-600 mt-1">{type.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex space-x-4">
          <Button variant="ghost" onClick={onBack} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={handleContinue} 
            disabled={selectedTypes.length === 0}
            className="flex-1"
          >
            Continue ({selectedTypes.length} selected)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}