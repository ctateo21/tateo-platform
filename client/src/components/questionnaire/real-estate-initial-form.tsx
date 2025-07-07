import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import QuestionnaireForm from "./questionnaire-form";
import { Card, CardContent } from "@/components/ui/card";

// Define a simpler schema just for the initial question
const realEstateInitialSchema = z.object({
  intent: z.enum(["buy", "sell", "both", "hold-and-buy"])
});

interface RealEstateInitialFormProps {
  onSubmit: (data: z.infer<typeof realEstateInitialSchema>) => void;
  onBack: () => void;
}

export default function RealEstateInitialForm({ onSubmit, onBack }: RealEstateInitialFormProps) {
  const defaultValues = {
    intent: "buy" as const,
  };

  return (
    <QuestionnaireForm
      schema={realEstateInitialSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <div className="text-center mb-8">
        <h3 className="text-2xl font-semibold mb-4 text-primary">Real Estate Services</h3>
        <p className="text-muted-foreground">Please select what you're looking to do with real estate:</p>
      </div>
      
      <div className="grid gap-6">
        <FormField
          name="intent"
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
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  <FormItem className="contents">
                    <FormControl>
                      <label>
                        <input 
                          type="radio" 
                          className="hidden" 
                          checked={field.value === 'buy'} 
                          onChange={() => field.onChange('buy')}
                        />
                        <Card 
                          className={`cursor-pointer transition-all ${field.value === 'buy' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-primary/50'}`}
                          onClick={() => {
                            field.onChange('buy');
                            // Submit form after a short delay to show selection
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              if (form) form.requestSubmit();
                            }, 300);
                          }}
                        >
                          <CardContent className="p-6 text-center">
                            <div className="flex items-center justify-center mb-4">
                              <RadioGroupItem value="buy" className="sr-only" />
                              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                                </svg>
                              </div>
                            </div>
                            <div className="font-semibold text-lg block mb-2">Buy a Property</div>
                            <p className="text-muted-foreground text-sm">
                              Find your perfect home or investment with our expert buying services
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
                          checked={field.value === 'sell'} 
                          onChange={() => field.onChange('sell')}
                        />
                        <Card 
                          className={`cursor-pointer transition-all ${field.value === 'sell' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-primary/50'}`}
                          onClick={() => {
                            field.onChange('sell');
                            // Submit form after a short delay to show selection
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              if (form) form.requestSubmit();
                            }, 300);
                          }}
                        >
                          <CardContent className="p-6 text-center">
                            <div className="flex items-center justify-center mb-4">
                              <RadioGroupItem value="sell" className="sr-only" />
                              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <path d="M11 4h10v10H11V4Z"></path>
                                  <path d="m3 20 8-8"></path>
                                  <path d="M11 12h4"></path>
                                  <path d="M11 16h7"></path>
                                  <path d="M11 20h10"></path>
                                  <path d="m5 8-3 3 3 3"></path>
                                </svg>
                              </div>
                            </div>
                            <div className="font-semibold text-lg block mb-2">Sell a Property</div>
                            <p className="text-muted-foreground text-sm">
                              Maximize your home's value with our strategic selling approach
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
                          checked={field.value === 'both'} 
                          onChange={() => field.onChange('both')}
                        />
                        <Card 
                          className={`cursor-pointer transition-all ${field.value === 'both' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-primary/50'}`}
                          onClick={() => {
                            field.onChange('both');
                            // Submit form after a short delay to show selection
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              if (form) form.requestSubmit();
                            }, 300);
                          }}
                        >
                          <CardContent className="p-6 text-center">
                            <div className="flex items-center justify-center mb-4">
                              <RadioGroupItem value="both" className="sr-only" />
                              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <path d="m16 8-4 4-4-4"></path>
                                  <path d="M8 16h8"></path>
                                </svg>
                              </div>
                            </div>
                            <div className="font-semibold text-lg block mb-2">Sell & Buy</div>
                            <p className="text-muted-foreground text-sm">
                              Seamlessly transition from your current home to your new one
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
                          checked={field.value === 'hold-and-buy'} 
                          onChange={() => field.onChange('hold-and-buy')}
                        />
                        <Card 
                          className={`cursor-pointer transition-all ${field.value === 'hold-and-buy' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-primary/50'}`}
                          onClick={() => {
                            field.onChange('hold-and-buy');
                            // Submit form after a short delay to show selection
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              if (form) form.requestSubmit();
                            }, 300);
                          }}
                        >
                          <CardContent className="p-6 text-center">
                            <div className="flex items-center justify-center mb-4">
                              <RadioGroupItem value="hold-and-buy" className="sr-only" />
                              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                  <path d="M17 21v-8H7v8"></path>
                                  <path d="M7 3v5h8"></path>
                                  <circle cx="15" cy="9" r="2"></circle>
                                  <path d="m9 12 2 2 4-4"></path>
                                </svg>
                              </div>
                            </div>
                            <div className="font-semibold text-lg block mb-2">Hold and Buy</div>
                            <p className="text-muted-foreground text-sm">
                              Keep your current primary residence and buy a new home
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