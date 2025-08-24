import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Building, Home, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReviewsSection } from "./reviews-section";

interface RefinanceLienTypeStepProps {
  onSubmit: (data: { lienType: '1st-lien' | '2nd-lien' }) => void;
  onBack: () => void;
}

export function RefinanceLienTypeStep({ onSubmit, onBack }: RefinanceLienTypeStepProps) {
  const [selectedLienType, setSelectedLienType] = useState<'1st-lien' | '2nd-lien' | null>(null);

  const lienTypes = [
    {
      id: '1st-lien' as const,
      title: '1st Lien Refinance',
      description: 'Refinancing your current mortgage',
      icon: <Home className="h-8 w-8 text-primary" />,
      details: [
        'Replace your existing mortgage',
        'Potentially lower interest rate',
        'Change loan terms',
        'Access home equity (cash-out option)'
      ]
    },
    {
      id: '2nd-lien' as const,  
      title: '2nd Lien',
      description: 'Home equity line of credit or loan',
      icon: <Building className="h-8 w-8 text-primary" />,
      details: [
        'Keep your existing mortgage',
        'Add a second loan against your home',
        'Access home equity',
        'Typically higher interest rates'
      ]
    }
  ];

  const handleSubmit = () => {
    if (!selectedLienType) return;
    
    onSubmit({ lienType: selectedLienType });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">
          Lien Type Selection
        </h2>
        <p className="text-gray-600">
          What type of refinance are you looking for?
        </p>
      </div>

      <Alert className="mb-6 border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Note:</strong> 1st liens are for refinancing your current mortgage. 2nd liens are common for adding home equity lines of credit while keeping your existing mortgage.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {lienTypes.map((lienType) => (
          <Card 
            key={lienType.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedLienType === lienType.id 
                ? 'ring-2 ring-secondary shadow-lg border-secondary' 
                : 'hover:border-primary/50'
            }`}
            onClick={() => setSelectedLienType(lienType.id)}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-full ${
                  selectedLienType === lienType.id 
                    ? 'bg-secondary/20' 
                    : 'bg-primary/10'
                }`}>
                  {lienType.icon}
                </div>
              </div>
              <CardTitle className="text-xl text-primary">{lienType.title}</CardTitle>
              <CardDescription className="text-gray-600">{lienType.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {lienType.details.map((detail, i) => (
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
          disabled={!selectedLienType}
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