import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import QuestionnaireForm from "./questionnaire-form";
import { Card, CardContent } from "@/components/ui/card";

// Define a schema for the buy type question
const buyTypeSchema = z.object({
  buyType: z.enum(["primary", "other"])
});

interface BuyTypeFormProps {
  onSubmit: (data: z.infer<typeof buyTypeSchema>) => void;
  onBack: () => void;
}

export default function BuyTypeForm({ onSubmit, onBack }: BuyTypeFormProps) {
  const defaultValues = {
    buyType: "primary" as const,
  };

  return (
    <QuestionnaireForm
      schema={buyTypeSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <div className="text-center mb-8">
        <h3 className="text-2xl font-semibold mb-4 text-primary">Property Type</h3>
        <p className="text-muted-foreground">What type of property are you looking to buy?</p>
      </div>
      
      <div className="grid gap-6">
        <FormField
          name="buyType"
          render={({ field }) => (
            <FormItem className="space-y-4">
              <FormControl>
                <RadioGroup
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Submit the form after selection with a short delay to show the selection visually
                    setTimeout(() => {
                      const form = document.querySelector('form');
                      if (form) form.requestSubmit();
                    }, 300);
                  }}
                  value={field.value}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <FormItem className="contents">
                    <FormControl>
                      <label>
                        <input 
                          type="radio" 
                          className="hidden" 
                          checked={field.value === 'primary'} 
                          onChange={() => field.onChange('primary')}
                        />
                        <Card 
                          className={`cursor-pointer transition-all ${field.value === 'primary' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-primary/50'}`}
                          onClick={() => {
                            field.onChange('primary');
                            // Submit form after a short delay to show selection
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              if (form) form.requestSubmit();
                            }, 300);
                          }}
                        >
                          <CardContent className="p-6 text-center">
                            <div className="flex items-center justify-center mb-4">
                              <RadioGroupItem value="primary" className="sr-only" />
                              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                                </svg>
                              </div>
                            </div>
                            <div className="font-semibold text-lg block mb-2">Primary Residence</div>
                            <p className="text-muted-foreground text-sm">
                              A home you plan to live in as your main residence
                            </p>
                          </CardContent>
                        </Card>
                      </label>
                    </FormControl>
                  </FormItem>
                  
                  <FormItem className="contents">
                    <FormControl>
                      <label>
                        <input 
                          type="radio" 
                          className="hidden" 
                          checked={field.value === 'other'} 
                          onChange={() => field.onChange('other')}
                        />
                        <Card 
                          className={`cursor-pointer transition-all ${field.value === 'other' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-primary/50'}`}
                          onClick={() => {
                            field.onChange('other');
                            // Submit form after a short delay to show selection
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              if (form) form.requestSubmit();
                            }, 300);
                          }}
                        >
                          <CardContent className="p-6 text-center">
                            <div className="flex items-center justify-center mb-4">
                              <RadioGroupItem value="other" className="sr-only" />
                              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <path d="M3 21h18"></path>
                                  <path d="M19 21v-4"></path>
                                  <path d="M19 17a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"></path>
                                  <path d="M14 17v-2"></path>
                                  <path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"></path>
                                  <path d="M11 21v-4"></path>
                                  <path d="M14 7v6"></path>
                                  <path d="M10 7v6"></path>
                                  <path d="M3 7v8a2 2 0 0 0 2 2h3"></path>
                                </svg>
                              </div>
                            </div>
                            <div className="font-semibold text-lg block mb-2">Other Property</div>
                            <p className="text-muted-foreground text-sm">
                              An investment property, vacation home, or other non-primary residence
                            </p>
                          </CardContent>
                        </Card>
                      </label>
                    </FormControl>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </QuestionnaireForm>
  );
}