import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Shield, Wallet, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EscrowStepProps {
  onSubmit: (data: { escrow: 'yes' | 'no' }) => void;
  onBack: () => void;
}

export function EscrowStep({ onSubmit, onBack }: EscrowStepProps) {
  const [selectedEscrow, setSelectedEscrow] = useState<'yes' | 'no' | null>(null);

  const escrowOptions = [
    {
      id: 'yes' as const,
      title: 'Yes, I have escrow',
      description: 'Taxes and insurance are included in my monthly payment',
      icon: <Shield className="h-8 w-8 text-primary" />,
      details: [
        'Your lender collects taxes and insurance monthly',
        'They pay these bills on your behalf',
        'Convenient - one monthly payment',
        'Common for most mortgages'
      ]
    },
    {
      id: 'no' as const,  
      title: 'No, I pay separately',
      description: 'I pay taxes and insurance directly',
      icon: <Wallet className="h-8 w-8 text-primary" />,
      details: [
        'You pay property taxes directly to county',
        'You pay insurance directly to company',
        'Lower monthly mortgage payment',
        'You manage the payments yourself'
      ]
    }
  ];

  const handleSubmit = () => {
    if (!selectedEscrow) return;
    
    onSubmit({ escrow: selectedEscrow });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">
          Escrow Account
        </h2>
        <p className="text-gray-600">
          Do you currently escrow your taxes and insurance?
        </p>
      </div>

      <Alert className="mb-6 border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Escrow</strong> means your lender collects money for property taxes and insurance as part of your monthly mortgage payment, then pays these bills for you when they're due.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {escrowOptions.map((option) => (
          <Card 
            key={option.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedEscrow === option.id 
                ? 'ring-2 ring-secondary shadow-lg border-secondary' 
                : 'hover:border-primary/50'
            }`}
            onClick={() => setSelectedEscrow(option.id)}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-full ${
                  selectedEscrow === option.id 
                    ? 'bg-secondary/20' 
                    : 'bg-primary/10'
                }`}>
                  {option.icon}
                </div>
              </div>
              <CardTitle className="text-xl text-primary">{option.title}</CardTitle>
              <CardDescription className="text-gray-600">{option.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {option.details.map((detail, i) => (
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
          disabled={!selectedEscrow}
          className="bg-secondary hover:bg-secondary/90 text-white"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}