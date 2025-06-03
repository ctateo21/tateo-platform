import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, RefreshCw } from "lucide-react";
import QuestionnaireForm from "./questionnaire-form";

const mortgageTypeSchema = z.object({
  type: z.enum(["purchase", "refinance"]),
});

interface MortgageTypeFormProps {
  onSubmit: (data: z.infer<typeof mortgageTypeSchema>) => void;
  onBack: () => void;
  defaultValues?: any;
}

export default function MortgageTypeForm({ onSubmit, onBack, defaultValues }: MortgageTypeFormProps) {
  const defaults = {
    type: "purchase",
    ...defaultValues,
  };

  return (
    <QuestionnaireForm
      schema={mortgageTypeSchema}
      onSubmit={onSubmit}
      onBack={onBack}
      defaultValues={defaults}
      title="Mortgage Type"
      description="Are you looking to purchase a new property or refinance your current mortgage?"
    >
      {(form) => (
        <div className="space-y-6">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="grid grid-cols-1 gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <Card className={`cursor-pointer border-2 transition-colors flex-1 ${
                        field.value === "purchase" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                      }`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value="purchase" id="purchase" />
                            <Home className="h-5 w-5 text-primary" />
                            <div>
                              <CardTitle className="text-base">Purchase Refinance</CardTitle>
                              <CardDescription>
                                Buying a new home or property
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Card className={`cursor-pointer border-2 transition-colors flex-1 ${
                        field.value === "refinance" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                      }`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value="refinance" id="refinance" />
                            <RefreshCw className="h-5 w-5 text-primary" />
                            <div>
                              <CardTitle className="text-base">Refinance Cash Out</CardTitle>
                              <CardDescription>
                                Refinancing your existing mortgage
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </QuestionnaireForm>
  );
}