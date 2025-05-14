import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import QuestionnaireForm from "./questionnaire-form";
import { Card, CardContent } from "@/components/ui/card";

// Define a schema for the sell type question
const sellTypeSchema = z.object({
  sellType: z.enum(["primary", "1031exchange"])
});

interface SellTypeFormProps {
  onSubmit: (data: z.infer<typeof sellTypeSchema>) => void;
  onBack: () => void;
}

export default function SellTypeForm({ onSubmit, onBack }: SellTypeFormProps) {
  const defaultValues = {
    sellType: "primary" as const,
  };

  return (
    <QuestionnaireForm
      schema={sellTypeSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <div className="text-center mb-8">
        <h3 className="text-2xl font-semibold mb-4 text-primary">Selling Type</h3>
        <p className="text-muted-foreground">What type of property are you selling?</p>
      </div>
      
      <div className="grid gap-6">
        <FormField
          name="sellType"
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
                              Selling your main home or residence
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
                          checked={field.value === '1031exchange'} 
                          onChange={() => field.onChange('1031exchange')}
                        />
                        <Card 
                          className={`cursor-pointer transition-all ${field.value === '1031exchange' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-primary/50'}`}
                          onClick={() => {
                            field.onChange('1031exchange');
                            // Submit form after a short delay to show selection
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              if (form) form.requestSubmit();
                            }, 300);
                          }}
                        >
                          <CardContent className="p-6 text-center">
                            <div className="flex items-center justify-center mb-4">
                              <RadioGroupItem value="1031exchange" className="sr-only" />
                              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <circle cx="8" cy="21" r="1"></circle>
                                  <circle cx="19" cy="21" r="1"></circle>
                                  <path d="M8 21V7a2 2 0 0 1 2-2h12"></path>
                                  <path d="m19 21-4-4"></path>
                                  <path d="m4 5 4-4"></path>
                                  <path d="M4 5v12"></path>
                                  <path d="m8 17-4 4"></path>
                                </svg>
                              </div>
                            </div>
                            <div className="font-semibold text-lg block mb-2">1031 Exchange</div>
                            <p className="text-muted-foreground text-sm">
                              Selling an investment property as part of a 1031 tax-deferred exchange
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