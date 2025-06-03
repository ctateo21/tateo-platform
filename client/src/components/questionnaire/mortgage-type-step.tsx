import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building } from "lucide-react";
import QuestionnaireForm from "./questionnaire-form";

const mortgageTypeSchema = z.object({
  type: z.enum(["purchase", "refinance"], {
    required_error: "Please select mortgage type"
  })
});

interface MortgageTypeStepProps {
  onSubmit: (data: z.infer<typeof mortgageTypeSchema>) => void;
  onBack: () => void;
  defaultValues?: any;
}

export default function MortgageTypeStep({ onSubmit, onBack, defaultValues }: MortgageTypeStepProps) {
  const formDefaults = {
    type: defaultValues?.type || ""
  };

  return (
    <QuestionnaireForm
      title="Mortgage Service"
      description="Let's start with what type of mortgage service you need"
      schema={mortgageTypeSchema}
      defaultValues={formDefaults}
      onSubmit={onSubmit}
      onBack={onBack}
      submitText="Continue"
    >
      {(form) => (
        <Card>
          <CardHeader className="text-center">
            <Building className="h-12 w-12 mx-auto text-blue-600" />
            <CardTitle>What type of mortgage are you looking for?</CardTitle>
            <CardDescription>
              Choose the option that best describes your current situation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-1 gap-4"
                    >
                      <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                        <RadioGroupItem value="purchase" id="purchase" />
                        <FormLabel htmlFor="purchase" className="flex-1 cursor-pointer">
                          <div>
                            <div className="font-medium">Purchase</div>
                            <div className="text-sm text-gray-500">
                              I'm buying a new home and need financing
                            </div>
                          </div>
                        </FormLabel>
                      </div>
                      <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                        <RadioGroupItem value="refinance" id="refinance" />
                        <FormLabel htmlFor="refinance" className="flex-1 cursor-pointer">
                          <div>
                            <div className="font-medium">Refinance</div>
                            <div className="text-sm text-gray-500">
                              I want to refinance my existing mortgage
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