import { z } from "zod";
import { realEstateFormSchema } from "@shared/schema";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuestionnaireForm from "./questionnaire-form";
import AddressInput from "./address-input";
import CurrencyInput from "./currency-input";
import { useState } from "react";

interface RealEstateFormProps {
  onSubmit: (data: z.infer<typeof realEstateFormSchema>) => void;
  onBack: () => void;
}

export default function RealEstateForm({ onSubmit, onBack }: RealEstateFormProps) {
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  
  const defaultValues = {
    intent: "buy" as const,
    propertyType: "residential" as const,
    location: "",
    priceRangeMin: "",
    priceRangeMax: "",
  };

  // Handle when a place is selected from Google Places API
  const handlePlaceSelected = (place: any) => {
    setSelectedPlace(place);
  };

  return (
    <QuestionnaireForm
      schema={realEstateFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <h3 className="text-xl font-semibold mb-6">Real Estate Information</h3>
      
      <div className="space-y-6">
        <FormField
          name="intent"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>I am looking to:</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex flex-col space-y-2"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="buy" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Buy a property</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="sell" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Sell a property</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="both" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Both buy and sell</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="propertyType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Property type:</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="land">Land</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address or ZIP code:</FormLabel>
              <FormControl>
                <AddressInput 
                  value={field.value}
                  onChange={field.onChange}
                  onPlaceSelected={handlePlaceSelected}
                  placeholder="Enter address or ZIP code"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            name="priceRangeMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum price range:</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="$"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            name="priceRangeMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum price range:</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="$"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </QuestionnaireForm>
  );
}
