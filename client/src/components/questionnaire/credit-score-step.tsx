import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, CreditCard, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReviewsSection } from "./reviews-section";

const creditScoreRanges = [
  { value: "780+", label: "780+", description: "Excellent credit" },
  { value: "760-779", label: "760-779", description: "Very good credit" },
  { value: "740-759", label: "740-759", description: "Good credit" },
  { value: "720-739", label: "720-739", description: "Good credit" },
  { value: "700-719", label: "700-719", description: "Good credit" },
  { value: "680-699", label: "680-699", description: "Fair credit" },
  { value: "660-679", label: "660-679", description: "Fair credit" },
  { value: "640-659", label: "640-659", description: "Fair credit" },
  { value: "620-639", label: "620-639", description: "Poor credit" },
  { value: "600-619", label: "600-619", description: "Poor credit" },
  { value: "below-600", label: "Below 600", description: "Poor credit" }
];

interface CreditScoreStepProps {
  onSubmit: (data: { creditScore: string }) => void;
  onBack: () => void;
  defaultValues?: { creditScore?: string };
}

export function CreditScoreStep({ onSubmit, onBack, defaultValues }: CreditScoreStepProps) {
  const [selected, setSelected] = useState<string | null>(defaultValues?.creditScore || null);

  const handleSubmit = () => {
    if (selected) {
      onSubmit({ creditScore: selected });
    }
  };

  const getScoreValue = (range: string) => {
    if (range === "below-600") return 580;
    if (range === "780+") return 780;
    const match = range.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  const selectedScoreValue = selected ? getScoreValue(selected) : 0;

  const renderCreditRepairMessage = () => {
    if (selectedScoreValue < 580) {
      return (
        <Alert className="mt-6 border-red-200 bg-red-50">
          <Info className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <div className="space-y-2">
              <p className="font-semibold">Credit Improvement Required</p>
              <p>
                We recommend credit repair services to help improve your credit score. 
                Please pull your own credit report at{" "}
                <a 
                  href="https://www.annualcreditreport.com/index.action" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline font-semibold hover:text-red-900"
                >
                  annualcreditreport.com
                </a>{" "}
                and return once your credit score is at least above 600.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  const renderLoanProductGuide = () => {
    if (selectedScoreValue >= 580) {
      return (
        <Alert className="mt-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="space-y-2">
              <p className="font-semibold">Loan Product Recommendations</p>
              <p>If deciding between FHA, USDA or Conventional loans:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li><strong>≥ 700 credit:</strong> Lower monthly PMI on Conventional loans</li>
                <li><strong>≤ 700 credit:</strong> Lower monthly PMI on FHA loans</li>
                <li><strong>USDA:</strong> Requires over 640 credit score</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <CreditCard className="h-8 w-8 text-blue-600" />
        </div>
        <CardTitle className="text-2xl">Estimated Credit Score</CardTitle>
        <CardDescription>
          This helps us determine the best loan programs and rates for your situation
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-6">
            What is your estimated credit score?
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {creditScoreRanges.map((range) => (
            <Card 
              key={range.value}
              className={`cursor-pointer transition-all border-2 ${
                selected === range.value 
                  ? "ring-2 ring-blue-500 border-blue-500 bg-blue-50" 
                  : "border-gray-200 hover:border-blue-300"
              }`}
              onClick={() => setSelected(range.value)}
            >
              <CardHeader className="text-center py-4">
                <CardTitle className="text-lg">{range.label}</CardTitle>
                <CardDescription className="text-sm">
                  {range.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {renderLoanProductGuide()}
        {renderCreditRepairMessage()}

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