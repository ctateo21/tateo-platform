import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { TruvIntegration } from "./truv-integration";
import { TaxStatusIntegration } from "./taxstatus-integration";

interface IncomeTypeSelectionProps {
  onComplete: (data: any) => void;
  onBack: () => void;
  defaultValues?: any;
}

export function IncomeTypeSelection({ onComplete, onBack, defaultValues }: IncomeTypeSelectionProps) {
  const [selectedEmploymentStatus, setSelectedEmploymentStatus] = useState<string>(defaultValues?.employmentStatus || "");
  const [currentStep, setCurrentStep] = useState<'selection' | 'taxstatus' | 'truv' | 'disability-type' | 'ssa' | 'va'>('selection');
  const [apiData, setApiData] = useState<any>({});

  const employmentOptions = [
    {
      id: 'not-self-employed',
      label: 'NOT Self Employed',
      description: 'W-2 employee with traditional employment income'
    },
    {
      id: 'self-employed',
      label: 'Self Employed',
      description: '1099 contractor, business owner, or self-employment income'
    },
    {
      id: 'both',
      label: 'BOTH',
      description: 'Both W-2 employment and self-employment income'
    },
    {
      id: 'retired',
      label: 'Retired',
      description: 'Social Security, pension, retirement accounts, or other retirement income'
    },
    {
      id: 'disability',
      label: 'Disability',
      description: 'VA disability or Social Security disability income'
    }
  ];

  const handleContinue = () => {
    if (!selectedEmploymentStatus) return;

    // Route based on employment status for API connections
    if (selectedEmploymentStatus === 'self-employed') {
      // Self Employed -> TaxStatus API
      setCurrentStep('taxstatus');
    } else if (selectedEmploymentStatus === 'not-self-employed') {
      // NOT Self Employed -> Truv API
      setCurrentStep('truv');
    } else if (selectedEmploymentStatus === 'both') {
      // BOTH -> TaxStatus first, then Truv
      setCurrentStep('taxstatus');
    } else if (selectedEmploymentStatus === 'retired') {
      // Retired -> Social Security Administration API
      setCurrentStep('ssa');
    } else if (selectedEmploymentStatus === 'disability') {
      // Disability -> Ask VA or Social Security disability
      setCurrentStep('disability-type');
    }
  };

  const handleTaxStatusComplete = (data: any) => {
    setApiData(prev => ({ ...prev, taxstatus: data }));
    
    // If BOTH, go to Truv next; otherwise complete
    if (selectedEmploymentStatus === 'both') {
      setCurrentStep('truv');
    } else {
      // Complete for self-employed only
      onComplete({
        employmentStatus: selectedEmploymentStatus,
        incomeTypes: ['self-employed'],
        apiIntegrations: { ...apiData, taxstatus: data }
      });
    }
  };

  const handleTaxStatusSkip = () => {
    // If BOTH, go to Truv next; otherwise complete
    if (selectedEmploymentStatus === 'both') {
      setCurrentStep('truv');
    } else {
      // Complete for self-employed only
      onComplete({
        employmentStatus: selectedEmploymentStatus,
        incomeTypes: ['self-employed'],
        apiIntegrations: apiData,
        skipTaxStatus: true
      });
    }
  };

  const handleTruvComplete = (data: any) => {
    const finalApiData = { ...apiData, truv: data };
    
    // Complete the flow with all collected data
    onComplete({
      employmentStatus: selectedEmploymentStatus,
      incomeTypes: selectedEmploymentStatus === 'both' 
        ? ['salary-hourly', 'self-employed'] 
        : ['salary-hourly'],
      apiIntegrations: finalApiData
    });
  };

  const handleTruvSkip = () => {
    // Complete the flow
    onComplete({
      employmentStatus: selectedEmploymentStatus,
      incomeTypes: selectedEmploymentStatus === 'both' 
        ? ['salary-hourly', 'self-employed'] 
        : ['salary-hourly'],
      apiIntegrations: apiData,
      skipTruv: true
    });
  };

  const handleDisabilityTypeSelection = (disabilityType: 'va' | 'social-security') => {
    if (disabilityType === 'va') {
      setCurrentStep('va');
    } else {
      setCurrentStep('ssa');
    }
  };

  const handleSSAComplete = (data: any) => {
    onComplete({
      employmentStatus: selectedEmploymentStatus,
      incomeTypes: ['retired'],
      apiIntegrations: { ...apiData, ssa: data }
    });
  };

  const handleSSASkip = () => {
    onComplete({
      employmentStatus: selectedEmploymentStatus,
      incomeTypes: ['retired'],
      apiIntegrations: apiData,
      skipSSA: true
    });
  };

  const handleVAComplete = (data: any) => {
    onComplete({
      employmentStatus: 'disability',
      incomeTypes: ['disability'],
      disabilityType: 'va',
      apiIntegrations: { ...apiData, va: data }
    });
  };

  const handleVASkip = () => {
    onComplete({
      employmentStatus: 'disability',
      incomeTypes: ['disability'],
      disabilityType: 'va',
      apiIntegrations: apiData,
      skipVA: true
    });
  };

  // Handle API integration steps
  if (currentStep === 'taxstatus') {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setCurrentStep('selection')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Employment Selection
        </Button>
        <TaxStatusIntegration onComplete={handleTaxStatusComplete} onSkip={handleTaxStatusSkip} />
      </div>
    );
  }

  if (currentStep === 'truv') {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => {
            // Go back to appropriate step
            if (selectedEmploymentStatus === 'both' && !apiData.taxstatus) {
              setCurrentStep('taxstatus');
            } else {
              setCurrentStep('selection');
            }
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <TruvIntegration onComplete={handleTruvComplete} onSkip={handleTruvSkip} />
      </div>
    );
  }

  if (currentStep === 'disability-type') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Disability Type</CardTitle>
          <CardDescription>
            What type of disability income do you receive?
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => handleDisabilityTypeSelection('va')}
              className="w-full p-6 h-auto justify-start text-left"
            >
              <div>
                <div className="font-semibold">VA Disability</div>
                <div className="text-sm text-gray-600">Veterans Affairs disability compensation</div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleDisabilityTypeSelection('social-security')}
              className="w-full p-6 h-auto justify-start text-left"
            >
              <div>
                <div className="font-semibold">Social Security Disability</div>
                <div className="text-sm text-gray-600">Social Security Disability Insurance (SSDI) or Supplemental Security Income (SSI)</div>
              </div>
            </Button>
          </div>
        </CardContent>
        
        <CardFooter>
          <Button
            variant="ghost"
            onClick={() => setCurrentStep('selection')}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Employment Selection
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (currentStep === 'ssa') {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => {
            if (selectedEmploymentStatus === 'disability') {
              setCurrentStep('disability-type');
            } else {
              setCurrentStep('selection');
            }
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Social Security Administration</CardTitle>
            <CardDescription>
              Connect to verify your Social Security income
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                We'll securely connect to the Social Security Administration to verify your {selectedEmploymentStatus === 'retired' ? 'retirement' : 'disability'} benefits.
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-gray-600 mb-4">Social Security verification integration would be implemented here.</p>
              <div className="space-x-4">
                <Button onClick={handleSSAComplete}>
                  Connect to SSA
                </Button>
                <Button variant="outline" onClick={handleSSASkip}>
                  Skip for Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === 'va') {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => setCurrentStep('disability-type')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Disability Type
        </Button>
        
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">VA Portal</CardTitle>
            <CardDescription>
              Connect to verify your VA disability compensation
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                We'll securely connect to the Veterans Affairs portal to verify your disability compensation.
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-gray-600 mb-4">VA portal integration would be implemented here.</p>
              <div className="space-x-4">
                <Button onClick={handleVAComplete}>
                  Connect to VA Portal
                </Button>
                <Button variant="outline" onClick={handleVASkip}>
                  Skip for Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Employment Status</CardTitle>
        <CardDescription>
          Please select your employment status to help us determine your income sources.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <RadioGroup value={selectedEmploymentStatus} onValueChange={setSelectedEmploymentStatus}>
          {employmentOptions.map((option) => (
            <div key={option.id} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50">
              <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
              <div className="flex-1">
                <Label 
                  htmlFor={option.id} 
                  className="text-base font-medium cursor-pointer"
                >
                  {option.label}
                </Label>
                <p className="text-sm text-gray-600 mt-1">{option.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
        
        {selectedEmploymentStatus && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              {selectedEmploymentStatus === 'both' && 
                "Next, we'll connect to TaxStatus to verify your tax returns, then to Truv to verify your W-2 employment income."
              }
              {selectedEmploymentStatus === 'self-employed' && 
                "Next, we'll connect to TaxStatus to securely verify your tax returns and self-employment income."
              }
              {selectedEmploymentStatus === 'not-self-employed' && 
                "Next, we'll connect to Truv to securely verify your W-2 employment income."
              }
              {selectedEmploymentStatus === 'retired' && 
                "Next, we'll connect to the Social Security Administration to verify your retirement income."
              }
              {selectedEmploymentStatus === 'disability' && 
                "Next, we'll ask about your disability type and connect to the appropriate verification system."
              }
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col sm:flex-row gap-3 sm:justify-between">
        <Button
          variant="outline"
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        
        <Button 
          type="button"
          onClick={handleContinue}
          disabled={!selectedEmploymentStatus}
          className="w-full sm:w-auto"
        >
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}