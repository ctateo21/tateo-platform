import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, TrendingDown, DollarSign } from "lucide-react";
import { ReviewsSection } from "./reviews-section";

interface RefinanceTypeStepProps {
  onSubmit: (data: { refinanceType: 'cash-out' | 'rate-term' }) => void;
  onBack: () => void;
}

export function RefinanceTypeStep({ onSubmit, onBack }: RefinanceTypeStepProps) {
  const [selectedRefinanceType, setSelectedRefinanceType] = useState<'cash-out' | 'rate-term' | null>(null);

  const refinanceTypes = [
    {
      id: 'cash-out' as const,
      title: 'Cash-Out Refinance',
      description: 'Access your home equity with cash',
      icon: <DollarSign className="h-8 w-8 text-primary" />,
      details: [
        'Get cash from your home equity',
        'Higher loan amount than current balance',
        'Use funds for improvements, debt consolidation, etc.',
        'May have slightly higher rates'
      ]
    },
    {
      id: 'rate-term' as const,  
      title: 'Rate & Term Refinance',
      description: 'Lower your rate and monthly payment',
      icon: <TrendingDown className="h-8 w-8 text-primary" />,
      details: [
        'Reduce your interest rate',
        'Lower monthly payments',
        'Change loan term (15, 20, 30 years)',
        'No cash out - just better terms'
      ]
    }
  ];

  const handleSubmit = () => {
    if (!selectedRefinanceType) return;
    
    onSubmit({ refinanceType: selectedRefinanceType });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">
          Refinance Type
        </h2>
        <p className="text-gray-600">
          What type of refinance are you looking for?
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {refinanceTypes.map((refinanceType) => (
          <Card 
            key={refinanceType.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedRefinanceType === refinanceType.id 
                ? 'ring-2 ring-secondary shadow-lg border-secondary' 
                : 'hover:border-primary/50'
            }`}
            onClick={() => setSelectedRefinanceType(refinanceType.id)}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-full ${
                  selectedRefinanceType === refinanceType.id 
                    ? 'bg-secondary/20' 
                    : 'bg-primary/10'
                }`}>
                  {refinanceType.icon}
                </div>
              </div>
              <CardTitle className="text-xl text-primary">{refinanceType.title}</CardTitle>
              <CardDescription className="text-gray-600">{refinanceType.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {refinanceType.details.map((detail, i) => (
                  <li key={i} className="flex items-start text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 bg-secondary rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    {detail}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between mt-8">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        
        <Button 
          onClick={handleSubmit}
          disabled={!selectedRefinanceType}
          className="bg-secondary hover:bg-secondary/90 text-white"
        >
          Continue
        </Button>
      </div>

      {/* Reviews Section */}
      <ReviewsSection />
    </div>
  );
}