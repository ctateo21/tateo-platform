import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import QuestionnaireForm from "./questionnaire-form";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewsSection } from "./reviews-section";

// Define a schema for the purchase method question
const purchaseMethodSchema = z.object({
  purchaseMethod: z.enum(["cash", "mortgage"])
});

interface PurchaseMethodFormProps {
  onSubmit: (data: z.infer<typeof purchaseMethodSchema>) => void;
  onBack: () => void;
}

export default function PurchaseMethodForm({ onSubmit, onBack }: PurchaseMethodFormProps) {
  const defaultValues = {
    purchaseMethod: "cash" as const,
  };

  return (
    <QuestionnaireForm
      schema={purchaseMethodSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      {/* Reviews Section */}
      <ReviewsSection />
      
      <div className="text-center mb-8">
        <h3 className="text-2xl font-semibold mb-4 text-primary">Purchase Method</h3>
        <p className="text-muted-foreground">How are you planning to pay for the property?</p>
      </div>
      
      <div className="grid gap-6">
        <FormField
          name="purchaseMethod"
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
                          checked={field.value === 'cash'} 
                          onChange={() => field.onChange('cash')}
                        />
                        <Card 
                          className={`cursor-pointer transition-all ${field.value === 'cash' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-primary/50'}`}
                          onClick={() => {
                            field.onChange('cash');
                            // Submit form after a short delay to show selection
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              if (form) form.requestSubmit();
                            }, 300);
                          }}
                        >
                          <CardContent className="p-6 text-center">
                            <div className="flex items-center justify-center mb-4">
                              <RadioGroupItem value="cash" className="sr-only" />
                              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <rect width="20" height="12" x="2" y="6" rx="2"></rect>
                                  <circle cx="12" cy="12" r="2"></circle>
                                  <path d="M6 12h.01M18 12h.01"></path>
                                </svg>
                              </div>
                            </div>
                            <div className="font-semibold text-lg block mb-2">Cash Purchase</div>
                            <p className="text-muted-foreground text-sm">
                              I'm planning to pay with cash or have my own financing
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
                          checked={field.value === 'mortgage'} 
                          onChange={() => field.onChange('mortgage')}
                        />
                        <Card 
                          className={`cursor-pointer transition-all ${field.value === 'mortgage' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-primary/50'}`}
                          onClick={() => {
                            field.onChange('mortgage');
                            // Submit form after a short delay to show selection
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              if (form) form.requestSubmit();
                            }, 300);
                          }}
                        >
                          <CardContent className="p-6 text-center">
                            <div className="flex items-center justify-center mb-4">
                              <RadioGroupItem value="mortgage" className="sr-only" />
                              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-7c-.5 0-1.5-.5-1.5-1.5"></path>
                                </svg>
                              </div>
                            </div>
                            <div className="font-semibold text-lg block mb-2">Mortgage</div>
                            <p className="text-muted-foreground text-sm">
                              I need a mortgage loan to finance this purchase
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