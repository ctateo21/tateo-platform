import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Home, User } from "lucide-react";
import { ReviewsSection } from "./reviews-section";

interface HomeOwnershipHistoryStepProps {
  onSubmit: (data: { homeOwnershipHistory: 'yes' | 'no' }) => void;
  onBack: () => void;
  defaultValues?: { homeOwnershipHistory?: 'yes' | 'no' };
}

export function HomeOwnershipHistoryStep({ onSubmit, onBack, defaultValues }: HomeOwnershipHistoryStepProps) {
  const [selected, setSelected] = useState<'yes' | 'no' | null>(defaultValues?.homeOwnershipHistory || null);

  const handleSubmit = () => {
    if (selected) {
      onSubmit({ homeOwnershipHistory: selected });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Home Ownership History</CardTitle>
        <CardDescription>
          This helps us determine the best loan programs for your situation
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-6">
            Have you had ownership of any home in the last 3 years?
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Yes Option */}
          <Card 
            className={`cursor-pointer transition-all border-2 ${
              selected === 'yes' 
                ? "ring-2 ring-blue-500 border-blue-500 bg-blue-50" 
                : "border-gray-200 hover:border-blue-300"
            }`}
            onClick={() => setSelected('yes')}
          >
            <CardHeader className="text-center py-6">
              <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Home className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-lg">Yes</CardTitle>
              <CardDescription>
                I have owned a home within the last 3 years
              </CardDescription>
            </CardHeader>
          </Card>

          {/* No Option */}
          <Card 
            className={`cursor-pointer transition-all border-2 ${
              selected === 'no' 
                ? "ring-2 ring-green-500 border-green-500 bg-green-50" 
                : "border-gray-200 hover:border-green-300"
            }`}
            onClick={() => setSelected('no')}
          >
            <CardHeader className="text-center py-6">
              <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-lg">No</CardTitle>
              <CardDescription>
                I have not owned a home in the last 3 years
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
          <p className="font-medium mb-2">Why we ask this:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>First-time homebuyer programs may be available if you answer "No"</li>
            <li>Different loan programs have varying requirements based on ownership history</li>
            <li>This helps us recommend the most beneficial loan options</li>
          </ul>
        </div>

        <div className="flex space-x-4">
          <Button variant="ghost" onClick={onBack} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selected}
            className="flex-1"
          >
            Continue
          </Button>
        </div>

        <ReviewsSection />
      </CardContent>
    </Card>
  );
}