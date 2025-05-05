import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, CheckCircle, ChevronRight, Download } from "lucide-react";

interface InsuranceQuote {
  quoteId: string;
  insuranceType: string;
  estimatedPremium: {
    monthly: string;
    annual: string;
  };
  coverageOptions: Array<{
    name: string;
    description: string;
    premium: string;
  }>;
  carriers: string[];
  discounts: string[];
  nextSteps: string[];
  timestamp: string;
}

interface InsuranceResultsProps {
  quote: InsuranceQuote | null;
  isLoading: boolean;
  error: string | null;
}

export default function InsuranceResults({ quote, isLoading, error }: InsuranceResultsProps) {
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card className="w-full bg-white shadow-md border-0">
        <CardContent className="p-6 flex flex-col items-center justify-center py-12">
          <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
          <p className="text-gray-600">Analyzing your property and finding the best insurance options...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-white shadow-md border-0">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="bg-red-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Unable to Get Insurance Options</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button 
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quote) {
    return null;
  }

  return (
    <Card className="w-full bg-white shadow-md border-0">
      <CardContent className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-bold text-primary">Your Insurance Options</h3>
            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 font-medium">
              Quote ID: {quote.quoteId.substring(0, 8)}
            </Badge>
          </div>
          <p className="text-gray-600">
            Based on your property details, we've found the following insurance options:
          </p>
        </div>

        <div className="mb-8">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Coverage Plans</h4>
          <div className="grid gap-4">
            {quote.coverageOptions.map((option, index) => (
              <div 
                key={index}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedPlan === index 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-200 hover:border-primary/50'
                }`}
                onClick={() => setSelectedPlan(index)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center">
                      <h5 className="text-lg font-semibold text-gray-900">{option.name}</h5>
                      {selectedPlan === index && (
                        <CheckCircle className="ml-2 h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <p className="text-gray-600 mt-1">{option.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary">{option.premium}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Recommended Carriers</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <ul className="space-y-2">
                {quote.carriers.map((carrier, index) => (
                  <li key={index} className="flex items-center">
                    <ChevronRight className="h-4 w-4 text-primary mr-2" />
                    <span>{carrier}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Available Discounts</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <ul className="space-y-2">
                {quote.discounts.map((discount, index) => (
                  <li key={index} className="flex items-center">
                    <ChevronRight className="h-4 w-4 text-primary mr-2" />
                    <span>{discount}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h4 className="text-lg font-semibold text-gray-900 mb-3">Next Steps</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <ol className="space-y-2 list-decimal pl-5">
              {quote.nextSteps.map((step, index) => (
                <li key={index} className="pl-1">{step}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <Button asChild className="group border-primary text-primary hover:bg-primary hover:text-white">
            <a href="https://tateoco.com/florida-homeowners-insurance-guide/?utm_source=Insurance&utm_medium=form&utm_campaign=HOI_guide" target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              Florida Homeowners Insurance Guide
            </a>
          </Button>

          <Button className="bg-primary hover:bg-primary/90 text-white">
            Speak With An Agent
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
