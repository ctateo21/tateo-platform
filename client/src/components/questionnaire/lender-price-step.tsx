import { useEffect, useState } from "react";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, DollarSign } from "lucide-react";
import QuestionnaireForm from "./questionnaire-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ReviewsSection } from "./reviews-section";

const lenderPriceSchema = z.object({
  selectedRate: z.string().optional(),
  lenderPriceData: z.any().optional(),
  widgetCompleted: z.boolean().default(false)
});

interface LenderPriceStepProps {
  defaultValues?: any;
  onSubmit: (data: z.infer<typeof lenderPriceSchema>) => void;
  onBack: () => void;
  mortgageData?: any;
}

export default function LenderPriceStep({ 
  defaultValues, 
  onSubmit, 
  onBack,
  mortgageData 
}: LenderPriceStepProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [widgetData, setWidgetData] = useState<any>(null);

  const formDefaults = {
    selectedRate: defaultValues?.selectedRate || "",
    lenderPriceData: defaultValues?.lenderPriceData || null,
    widgetCompleted: defaultValues?.widgetCompleted || false,
  };

  // Initialize LenderPrice widget
  useEffect(() => {
    const initializeLenderPriceWidget = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Simulate API call to LenderPrice - replace with actual API integration
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock widget data - replace with actual LenderPrice widget integration
        const mockWidgetData = {
          rates: [
            { lender: "First National Bank", rate: "6.25%", apr: "6.45%", points: 0, monthlyPayment: "$2,847" },
            { lender: "Community Credit Union", rate: "6.18%", apr: "6.38%", points: 0.5, monthlyPayment: "$2,832" },
            { lender: "Metro Mortgage", rate: "6.32%", apr: "6.52%", points: 0, monthlyPayment: "$2,863" },
            { lender: "Premier Lending", rate: "6.15%", apr: "6.35%", points: 1, monthlyPayment: "$2,823" }
          ],
          widgetUrl: "https://lenderprice.com/widget/pricing-portal",
          isConnected: true
        };

        setWidgetData(mockWidgetData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error initializing LenderPrice widget:", err);
        setError("Failed to load pricing information. Please try again.");
        setIsLoading(false);
      }
    };

    initializeLenderPriceWidget();
  }, []);

  const handleSubmit = (data: z.infer<typeof lenderPriceSchema>) => {
    // Add widget data to submission
    const submissionData = {
      ...data,
      lenderPriceData: widgetData,
      widgetCompleted: true
    };
    
    onSubmit(submissionData);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <h3 className="text-xl font-semibold">Connecting to LenderPrice</h3>
        <p className="text-muted-foreground text-center max-w-md">
          We're fetching the latest rates and pricing information for your loan...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-red-600">Connection Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="w-full"
          >
            Try Again
          </Button>
          <Button 
            onClick={onBack} 
            variant="ghost"
            className="w-full"
          >
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <QuestionnaireForm
      title="Mortgage Pricing Portal"
      description="Compare rates and get pricing from multiple lenders"
      schema={lenderPriceSchema}
      defaultValues={formDefaults}
      onSubmit={handleSubmit}
      onBack={onBack}
      submitText="Continue with Selected Rate"
    >
      {(form) => (
        <div className="space-y-6">
          {/* Reviews Section */}
          <ReviewsSection />
          
          <Card>
            <CardHeader className="text-center">
              <DollarSign className="h-12 w-12 mx-auto text-green-600" />
              <CardTitle>LenderPrice Pricing Portal</CardTitle>
              <CardDescription>
                Live rates and pricing from our lending partners
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* LenderPrice Widget Integration Area */}
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 bg-gray-50">
                <div className="text-center mb-4">
                  <h4 className="font-semibold text-lg mb-2">Live Rate Comparison</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Rates based on your loan profile: {mortgageData?.purchasePrice || mortgageData?.estimatedValue || 'Property Value'} property
                  </p>
                </div>

                {/* Mock Rate Display - Replace with actual LenderPrice widget */}
                <div className="space-y-3">
                  {widgetData?.rates?.map((rate: any, index: number) => (
                    <div 
                      key={index}
                      className="flex justify-between items-center p-3 border rounded-lg bg-white hover:bg-blue-50 cursor-pointer"
                      onClick={() => form.setValue('selectedRate', `${rate.lender}-${rate.rate}`)}
                    >
                      <div>
                        <div className="font-medium">{rate.lender}</div>
                        <div className="text-sm text-muted-foreground">
                          {rate.points > 0 ? `${rate.points} points` : 'No points'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-lg">{rate.rate}</div>
                        <div className="text-sm text-muted-foreground">APR: {rate.apr}</div>
                        <div className="text-sm font-medium">{rate.monthlyPayment}/mo</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Integration Note */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <ExternalLink className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">
                      LenderPrice Widget Integration
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    This area will host the actual LenderPrice widget plugin for real-time pricing
                  </p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="selectedRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selected Rate (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Rate selection will be captured from widget"
                        readOnly
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </QuestionnaireForm>
  );
}