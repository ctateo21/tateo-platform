import { useState } from "react";
import { z } from "zod";
import { insuranceFormSchema } from "@shared/schema";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { ArrowLeft, ChevronRight } from "lucide-react";

interface InsuranceFormProps {
  onSubmit: (data: z.infer<typeof insuranceFormSchema>) => void;
  onBack: () => void;
}

export default function InsuranceForm({ onSubmit, onBack }: InsuranceFormProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [insuranceCategory, setInsuranceCategory] = useState<"residential" | "commercial" | null>(null);
  const [quoteType, setQuoteType] = useState<"new" | "current" | null>(null);
  const [propertyType, setPropertyType] = useState<string>("");

  const form = useForm<z.infer<typeof insuranceFormSchema>>({
    resolver: zodResolver(insuranceFormSchema),
    defaultValues: {
      insuranceCategory: undefined,
      residentialTypes: [],
      commercialTypes: [],
      quoteType: undefined,
      firstName: "",
      lastName: "",
      email: "",
      dateOfBirth: "",
      currentAddress: "",
      newAddress: "",
      hasMortgage: false,
      propertyType: "primary",
      rentalTerm: undefined,
    },
  });

  const handleCategorySelect = (category: "residential" | "commercial") => {
    setInsuranceCategory(category);
    form.setValue("insuranceCategory", category);
    // Reset the other category's selections
    if (category === "residential") {
      form.setValue("commercialTypes", []);
    } else {
      form.setValue("residentialTypes", []);
    }
    setCurrentStep(2);
  };

  const handleTypeSelection = (type: string, checked: boolean) => {
    if (insuranceCategory === "residential") {
      const currentTypes = form.getValues("residentialTypes") || [];
      if (checked) {
        form.setValue("residentialTypes", [...currentTypes, type as "auto" | "home" | "flood" | "general-liability"], { shouldValidate: true });
      } else {
        form.setValue("residentialTypes", currentTypes.filter(t => t !== type), { shouldValidate: true });
      }
    } else if (insuranceCategory === "commercial") {
      const currentTypes = form.getValues("commercialTypes") || [];
      if (checked) {
        form.setValue("commercialTypes", [...currentTypes, type as "property" | "business-owners-policy" | "flood" | "other"], { shouldValidate: true });
      } else {
        form.setValue("commercialTypes", currentTypes.filter(t => t !== type), { shouldValidate: true });
      }
    }
  };

  const handleNextFromStep2 = () => {
    const residentialTypes = form.getValues("residentialTypes") || [];
    const commercialTypes = form.getValues("commercialTypes") || [];
    
    if (insuranceCategory === "residential" && residentialTypes.length === 0) {
      form.setError("residentialTypes", { message: "Please select at least one residential insurance type" });
      return;
    }
    
    if (insuranceCategory === "commercial" && commercialTypes.length === 0) {
      form.setError("commercialTypes", { message: "Please select at least one commercial insurance type" });
      return;
    }
    
    setCurrentStep(3);
  };

  const handleQuoteTypeChange = (value: "new" | "current") => {
    setQuoteType(value);
    form.setValue("quoteType", value);
  };

  const handleCanopyConnect = async () => {
    // Handle Canopy Connect integration for existing insurance
    const canopyData = {
      insuranceCategory: insuranceCategory || undefined,
      residentialTypes: form.getValues("residentialTypes"),
      commercialTypes: form.getValues("commercialTypes"),
      quoteType: "current" as const,
    };
    onSubmit(canopyData);
  };

  const handleSubmit = (data: z.infer<typeof insuranceFormSchema>) => {
    onSubmit(data);
  };

  const handleBack = () => {
    if (currentStep === 1) {
      onBack();
    } else if (currentStep === 2) {
      setCurrentStep(1);
      setInsuranceCategory(null);
    } else if (currentStep === 3) {
      setCurrentStep(2);
      setQuoteType(null);
    }
  };

  // Step 1: Insurance Category Selection
  if (currentStep === 1) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Button
            onClick={handleBack}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <div className="mb-6">
            <div className="text-sm text-gray-500 mb-2">Step 1 of 3</div>
            <h3 className="text-xl font-semibold mb-2">Insurance Information</h3>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '33%' }}></div>
            </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">
              What type of insurance are you looking for?
            </p>
            
            <div className="grid gap-4">
              <Button
                onClick={() => handleCategorySelect("residential")}
                variant="outline"
                className="p-6 text-left justify-between h-auto"
                data-testid="button-residential-insurance"
              >
                <div>
                  <div className="font-semibold">Residential</div>
                  <div className="text-sm text-gray-600">Personal and home insurance needs</div>
                </div>
                <ChevronRight className="h-5 w-5" />
              </Button>
              
              <Button
                onClick={() => handleCategorySelect("commercial")}
                variant="outline"
                className="p-6 text-left justify-between h-auto"
                data-testid="button-commercial-insurance"
              >
                <div>
                  <div className="font-semibold">Commercial/Business</div>
                  <div className="text-sm text-gray-600">Business and commercial insurance needs</div>
                </div>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Insurance Type Selection
  if (currentStep === 2) {
    const residentialTypes = form.getValues("residentialTypes") || [];
    const commercialTypes = form.getValues("commercialTypes") || [];
    
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Button
            onClick={handleBack}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <div className="mb-6">
            <div className="text-sm text-gray-500 mb-2">Step 2 of 3</div>
            <h3 className="text-xl font-semibold mb-2">
              {insuranceCategory === "residential" ? "Residential Insurance Types" : "Commercial Insurance Types"}
            </h3>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '66%' }}></div>
            </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">
              What type of {insuranceCategory} insurance do you need? (Choose as many as you'd like)
            </p>
            
            {insuranceCategory === "residential" && (
              <div className="space-y-4">
                {[
                  { value: "auto", label: "Auto", description: "Car, truck, or motorcycle insurance" },
                  { value: "home", label: "Home", description: "Homeowners or renters insurance" },
                  { value: "flood", label: "Flood", description: "Flood damage protection" },
                  { value: "general-liability", label: "General Liability", description: "Personal liability protection" }
                ].map((option) => (
                  <div key={option.value} className="flex items-center space-x-3 p-4 border rounded-lg">
                    <Checkbox
                      id={option.value}
                      checked={residentialTypes.includes(option.value as any)}
                      onCheckedChange={(checked) => handleTypeSelection(option.value, !!checked)}
                      data-testid={`checkbox-residential-${option.value}`}
                    />
                    <div className="flex-1">
                      <label htmlFor={option.value} className="font-medium cursor-pointer">
                        {option.label}
                      </label>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                  </div>
                ))}
                {form.formState.errors.residentialTypes && (
                  <p className="text-sm text-red-600">{form.formState.errors.residentialTypes.message}</p>
                )}
              </div>
            )}
            
            {insuranceCategory === "commercial" && (
              <div className="space-y-4">
                {[
                  { value: "property", label: "Property", description: "Commercial property insurance" },
                  { value: "business-owners-policy", label: "Business Owners Policy", description: "Comprehensive business coverage" },
                  { value: "flood", label: "Flood", description: "Commercial flood insurance" },
                  { value: "other", label: "Other", description: "Other commercial insurance needs" }
                ].map((option) => (
                  <div key={option.value} className="flex items-center space-x-3 p-4 border rounded-lg">
                    <Checkbox
                      id={option.value}
                      checked={commercialTypes.includes(option.value as any)}
                      onCheckedChange={(checked) => handleTypeSelection(option.value, !!checked)}
                      data-testid={`checkbox-commercial-${option.value}`}
                    />
                    <div className="flex-1">
                      <label htmlFor={option.value} className="font-medium cursor-pointer">
                        {option.label}
                      </label>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                  </div>
                ))}
                {form.formState.errors.commercialTypes && (
                  <p className="text-sm text-red-600">{form.formState.errors.commercialTypes.message}</p>
                )}
              </div>
            )}
            
            <Button
              onClick={handleNextFromStep2}
              className="w-full mt-6"
              data-testid="button-continue-to-step3"
            >
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Quote Type Selection
  if (currentStep === 3 && !quoteType) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Button
            onClick={handleBack}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <div className="mb-6">
            <div className="text-sm text-gray-500 mb-2">Step 3 of 3</div>
            <h3 className="text-xl font-semibold mb-2">Quote Type</h3>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">
              Are you looking for new insurance or do you want a quote for your current insurance?
            </p>
            
            <div className="grid gap-4">
              <Button
                onClick={() => handleQuoteTypeChange("new")}
                variant="outline"
                className="p-6 text-left justify-start h-auto"
                data-testid="button-new-insurance"
              >
                <div>
                  <div className="font-semibold">New Insurance</div>
                  <div className="text-sm text-gray-600">I'm looking for new insurance coverage</div>
                </div>
              </Button>
              
              <Button
                onClick={() => handleQuoteTypeChange("current")}
                variant="outline"
                className="p-6 text-left justify-start h-auto"
                data-testid="button-current-insurance"
              >
                <div>
                  <div className="font-semibold">Quote for Current Insurance</div>
                  <div className="text-sm text-gray-600">I want to compare my existing insurance</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Current insurance flow
  if (quoteType === "current") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Button
            onClick={() => setQuoteType(null)}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <h3 className="text-xl font-semibold mb-6">Current Insurance Analysis</h3>
          
          <div className="space-y-6">
            <p className="text-gray-600">
              We'll connect with your current insurance provider to get you a competitive quote comparison.
            </p>
            
            <div className="bg-blue-50 p-6 rounded-lg">
              <h4 className="font-semibold mb-2">Selected Insurance Types</h4>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <strong>{insuranceCategory === "residential" ? "Residential" : "Commercial"} Insurance:</strong>
                </p>
                <ul className="text-sm text-gray-600 ml-4 list-disc">
                  {insuranceCategory === "residential" 
                    ? form.getValues("residentialTypes")?.map(type => (
                        <li key={type}>{type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>
                      ))
                    : form.getValues("commercialTypes")?.map(type => (
                        <li key={type}>{type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>
                      ))
                  }
                </ul>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                We'll securely connect with your current insurance provider to analyze your coverage and provide personalized recommendations.
              </p>
              
              <Button
                onClick={handleCanopyConnect}
                className="w-full"
                data-testid="button-continue-current"
              >
                Continue with Current Insurance Analysis
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // New insurance form
  return (
    <div className="max-w-2xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="mb-8">
            <Button
              type="button"
              onClick={() => setQuoteType(null)}
              variant="outline"
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            <h3 className="text-xl font-semibold mb-6">New Insurance Application</h3>
            
            <div className="space-y-6">
              {/* Personal Information */}
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="First name" 
                          {...field} 
                          data-testid="input-first-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Last name" 
                          {...field}
                          data-testid="input-last-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="your@email.com" 
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        data-testid="input-date-of-birth"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Property Information */}
              <FormField
                control={form.control}
                name="currentAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="123 Main St, City, State 12345" 
                        {...field}
                        data-testid="input-current-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="newAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Address (if different)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="456 New St, City, State 12345" 
                        {...field}
                        data-testid="input-new-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="hasMortgage"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Do you have a mortgage?</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => field.onChange(value === "yes")}
                        value={field.value ? "yes" : "no"}
                        className="flex flex-col space-y-2"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="yes" data-testid="radio-mortgage-yes" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Yes</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="no" data-testid="radio-mortgage-no" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">No</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="propertyType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Property Type *</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => {
                          field.onChange(value);
                          setPropertyType(value);
                        }}
                        value={field.value}
                        className="flex flex-col space-y-2"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="primary" data-testid="radio-property-primary" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Primary</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="secondary" data-testid="radio-property-secondary" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Secondary</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="investment" data-testid="radio-property-investment" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Investment</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Rental term for investment properties */}
              {(propertyType === "investment" || form.watch("propertyType") === "investment") && (
                <FormField
                  control={form.control}
                  name="rentalTerm"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Minimum Rental Term *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col space-y-2"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="1-2-nights" data-testid="radio-rental-1-2-nights" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">1-2 nights</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="3-7-nights" data-testid="radio-rental-3-7-nights" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">3-7 nights</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="7-30-nights" data-testid="radio-rental-7-30-nights" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">7-30 nights</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="30-plus-days" data-testid="radio-rental-30-plus-days" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">30+ days</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="90-plus-days" data-testid="radio-rental-90-plus-days" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">90+ days</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="annual" data-testid="radio-rental-annual" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">Annual</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </div>
          
          <div className="flex gap-4">
            <Button type="submit" className="flex-1" data-testid="button-submit-insurance">
              Get Insurance Quote
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
