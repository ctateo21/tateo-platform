import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>(defaultValues?.employmentTypes || []);
  const [currentStep, setCurrentStep] = useState<'selection' | 'taxstatus' | 'truv' | 'disability-type' | 'ssa' | 'va'>('selection');
  const [apiData, setApiData] = useState<any>({});
  const [apiQueue, setApiQueue] = useState<string[]>([]);
  const [currentApiIndex, setCurrentApiIndex] = useState(0);

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

  const buildApiQueue = (employmentTypes: string[]) => {
    const queue: string[] = [];
    
    // Build queue in order: NOT Self Employed → Self Employed → Retired → Disability
    if (employmentTypes.includes('not-self-employed')) {
      queue.push('truv');
    }
    if (employmentTypes.includes('self-employed')) {
      queue.push('taxstatus');
    }
    if (employmentTypes.includes('retired')) {
      queue.push('ssa');
    }
    if (employmentTypes.includes('disability')) {
      queue.push('disability-type');
    }
    
    return queue;
  };

  const handleContinue = () => {
    if (selectedEmploymentTypes.length === 0) return;

    const queue = buildApiQueue(selectedEmploymentTypes);
    setApiQueue(queue);
    setCurrentApiIndex(0);
    
    // Start with the first API in the queue
    setCurrentStep(queue[0] as any);
  };

  const handleEmploymentTypeToggle = (employmentType: string) => {
    setSelectedEmploymentTypes(prev => {
      if (prev.includes(employmentType)) {
        return prev.filter(type => type !== employmentType);
      } else {
        return [...prev, employmentType];
      }
    });
  };

  const moveToNextApiOrComplete = (updatedApiData: any, skipKey?: string) => {
    const nextIndex = currentApiIndex + 1;
    
    if (nextIndex < apiQueue.length) {
      // Move to next API in queue
      setCurrentApiIndex(nextIndex);
      setCurrentStep(apiQueue[nextIndex] as any);
    } else {
      // Complete the flow
      onComplete({
        employmentTypes: selectedEmploymentTypes,
        incomeTypes: selectedEmploymentTypes.map(type => {
          switch (type) {
            case 'not-self-employed': return 'salary-hourly';
            case 'self-employed': return 'self-employed';
            case 'retired': return 'retired';
            case 'disability': return 'disability';
            default: return type;
          }
        }),
        apiIntegrations: updatedApiData,
        ...(skipKey && { [skipKey]: true })
      });
    }
  };

  const handleTaxStatusComplete = (data: any) => {
    const updatedApiData = { ...apiData, taxstatus: data };
    setApiData(updatedApiData);
    moveToNextApiOrComplete(updatedApiData);
  };

  const handleTaxStatusSkip = () => {
    moveToNextApiOrComplete(apiData, 'skipTaxStatus');
  };

  const handleTruvComplete = (data: any) => {
    const updatedApiData = { ...apiData, truv: data };
    setApiData(updatedApiData);
    moveToNextApiOrComplete(updatedApiData);
  };

  const handleTruvSkip = () => {
    moveToNextApiOrComplete(apiData, 'skipTruv');
  };

  const handleDisabilityTypeSelection = (disabilityType: 'va' | 'social-security') => {
    if (disabilityType === 'va') {
      setCurrentStep('va');
    } else {
      setCurrentStep('ssa');
    }
  };

  const handleSSAComplete = (data: any) => {
    const updatedApiData = { ...apiData, ssa: data };
    setApiData(updatedApiData);
    moveToNextApiOrComplete(updatedApiData);
  };

  const handleSSASkip = () => {
    moveToNextApiOrComplete(apiData, 'skipSSA');
  };

  const handleVAComplete = (data: any) => {
    const updatedApiData = { ...apiData, va: data };
    setApiData(updatedApiData);
    moveToNextApiOrComplete(updatedApiData);
  };

  const handleVASkip = () => {
    moveToNextApiOrComplete(apiData, 'skipVA');
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
            // Go back to previous step in queue or to selection
            if (currentApiIndex > 0) {
              setCurrentApiIndex(currentApiIndex - 1);
              setCurrentStep(apiQueue[currentApiIndex - 1] as any);
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
            if (selectedEmploymentTypes.includes('disability')) {
              setCurrentStep('disability-type');
            } else if (currentApiIndex > 0) {
              setCurrentApiIndex(currentApiIndex - 1);
              setCurrentStep(apiQueue[currentApiIndex - 1] as any);
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
        <CardTitle className="text-2xl">Income Sources</CardTitle>
        <CardDescription>
          Please select all that apply to help us determine your income sources.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {employmentOptions.map((option) => (
            <div key={option.id} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id={option.id}
                checked={selectedEmploymentTypes.includes(option.id)}
                onCheckedChange={() => handleEmploymentTypeToggle(option.id)}
              />
              <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                <div className="font-semibold">{option.label}</div>
                <div className="text-sm text-gray-600">{option.description}</div>
              </Label>
            </div>
          ))}
        </div>
        
        {selectedEmploymentTypes.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              Selected income sources will connect to: {selectedEmploymentTypes.map((type, index) => {
                const connections = {
                  'not-self-employed': 'Truv (W-2 verification)',
                  'self-employed': 'TaxStatus (tax return verification)', 
                  'retired': 'Social Security Administration',
                  'disability': 'VA Portal or SSA (depending on type)'
                };
                return (index > 0 ? ', ' : '') + connections[type as keyof typeof connections];
              }).join('')}
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
          disabled={selectedEmploymentTypes.length === 0}
          className="w-full sm:w-auto"
        >
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}