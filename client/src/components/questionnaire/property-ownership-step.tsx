import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home } from "lucide-react";
import QuestionnaireForm from "./questionnaire-form";

const propertyOwnershipSchema = z.object({
  ownershipType: z.enum(["primary", "secondary", "investment"], {
    required_error: "Please select the property ownership type"
  })
});

interface PropertyOwnershipStepProps {
  onSubmit: (data: z.infer<typeof propertyOwnershipSchema>) => void;
  onBack: () => void;
  defaultValues?: any;
  mortgageType: 'purchase' | 'refinance';
}

export default function PropertyOwnershipStep({ onSubmit, onBack, defaultValues, mortgageType }: PropertyOwnershipStepProps) {
  const formDefaults = {
    ownershipType: defaultValues?.ownershipType || ""
  };

  return (
    <QuestionnaireForm
      title="Property Ownership"
      description="Tell us how you'll use this property"
      schema={propertyOwnershipSchema}
      defaultValues={formDefaults}
      onSubmit={onSubmit}
      onBack={onBack}
      submitText="Continue"
    >
      {(form) => (
        <Card>
          <CardHeader className="text-center">
            <Home className="h-12 w-12 mx-auto text-blue-600" />
            <CardTitle>
              {mortgageType === 'purchase' 
                ? 'How will you use this property?' 
                : 'How do you currently use this property?'
              }
            </CardTitle>
            <CardDescription>
              The ownership type affects loan terms and interest rates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="ownershipType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-1 gap-4"
                    >
                      <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                        <RadioGroupItem value="primary" id="primary" />
                        <FormLabel htmlFor="primary" className="flex-1 cursor-pointer">
                          <div>
                            <div className="font-medium">Primary Residence</div>
                            <div className="text-sm text-gray-500">
                              This will be my main home where I live most of the time
                            </div>
                          </div>
                        </FormLabel>
                      </div>
                      <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                        <RadioGroupItem value="secondary" id="secondary" />
                        <FormLabel htmlFor="secondary" className="flex-1 cursor-pointer">
                          <div>
                            <div className="font-medium">Second Home</div>
                            <div className="text-sm text-gray-500">
                              A vacation home, weekend getaway, or seasonal residence
                            </div>
                          </div>
                        </FormLabel>
                      </div>
                      <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                        <RadioGroupItem value="investment" id="investment" />
                        <FormLabel htmlFor="investment" className="flex-1 cursor-pointer">
                          <div>
                            <div className="font-medium">Investment Property</div>
                            <div className="text-sm text-gray-500">
                              I plan to rent it out or use it as an investment
                            </div>
                          </div>
                        </FormLabel>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      )}
    </QuestionnaireForm>
  );
}