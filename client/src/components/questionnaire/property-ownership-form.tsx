import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Building, TrendingUp } from "lucide-react";
import QuestionnaireForm from "./questionnaire-form";

const propertyOwnershipSchema = z.object({
  ownershipType: z.enum(["primary", "secondary", "investment"]),
});

interface PropertyOwnershipFormProps {
  onSubmit: (data: z.infer<typeof propertyOwnershipSchema>) => void;
  onBack: () => void;
  defaultValues?: any;
}

export default function PropertyOwnershipForm({ onSubmit, onBack, defaultValues }: PropertyOwnershipFormProps) {
  const defaults = {
    ownershipType: "primary",
    ...defaultValues,
  };

  return (
    <QuestionnaireForm
      schema={propertyOwnershipSchema}
      onSubmit={onSubmit}
      onBack={onBack}
      defaultValues={defaults}
      title="Property Ownership"
      description="What type of property ownership is this?"
    >
      {(form: any) => (
        <div className="space-y-6">
          <FormField
            control={form.control}
            name="ownershipType"
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
                        field.value === "primary" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                      }`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value="primary" id="primary" />
                            <Home className="h-5 w-5 text-primary" />
                            <div>
                              <CardTitle className="text-base">Primary Residence</CardTitle>
                              <CardDescription>
                                This will be your main home where you live
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Card className={`cursor-pointer border-2 transition-colors flex-1 ${
                        field.value === "secondary" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                      }`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value="secondary" id="secondary" />
                            <Building className="h-5 w-5 text-primary" />
                            <div>
                              <CardTitle className="text-base">Secondary Residence</CardTitle>
                              <CardDescription>
                                Vacation home or second property for personal use
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Card className={`cursor-pointer border-2 transition-colors flex-1 ${
                        field.value === "investment" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                      }`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value="investment" id="investment" />
                            <TrendingUp className="h-5 w-5 text-primary" />
                            <div>
                              <CardTitle className="text-base">Investment Property</CardTitle>
                              <CardDescription>
                                Rental property or investment for income generation
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