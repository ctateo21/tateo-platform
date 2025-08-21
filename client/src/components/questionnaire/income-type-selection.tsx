import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

interface IncomeTypeSelectionProps {
  onComplete: (data: any) => void;
  onBack: () => void;
  defaultValues?: any;
}

export function IncomeTypeSelection({ onComplete, onBack, defaultValues }: IncomeTypeSelectionProps) {
  const [selectedEmploymentStatus, setSelectedEmploymentStatus] = useState<string>(defaultValues?.employmentStatus || "");

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
    }
  ];

  const handleContinue = () => {
    if (!selectedEmploymentStatus) return;

    onComplete({
      employmentStatus: selectedEmploymentStatus,
      incomeTypes: selectedEmploymentStatus === 'both' 
        ? ['salary-hourly', 'self-employed'] 
        : selectedEmploymentStatus === 'self-employed' 
          ? ['self-employed'] 
          : ['salary-hourly']
    });
  };

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
                "You'll provide details for both W-2 employment and self-employment income."
              }
              {selectedEmploymentStatus === 'self-employed' && 
                "You'll provide details about your self-employment or 1099 income."
              }
              {selectedEmploymentStatus === 'not-self-employed' && 
                "You'll provide details about your W-2 employment income."
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