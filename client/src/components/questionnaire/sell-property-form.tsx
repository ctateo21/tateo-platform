import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import QuestionnaireForm from "./questionnaire-form";
import AddressInput from "./address-input";
import CurrencyInput from "./currency-input";
import { useState } from "react";

// Define a schema for the selling property form
const sellPropertySchema = z.object({
  sellingPrice: z.string().min(1, "Expected selling price is required"),
  sellingAddress: z.string().min(3, "Please enter a valid address")
});

interface SellPropertyFormProps {
  onSubmit: (data: z.infer<typeof sellPropertySchema>) => void;
  onBack: () => void;
}

export default function SellPropertyForm({ onSubmit, onBack }: SellPropertyFormProps) {
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  
  const defaultValues = {
    sellingPrice: "",
    sellingAddress: ""
  };

  // Handle when a place is selected from Google Places API
  const handlePlaceSelected = (place: any) => {
    setSelectedPlace(place);
  };

  return (
    <QuestionnaireForm
      schema={sellPropertySchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <div className="text-center mb-8">
        <h3 className="text-2xl font-semibold mb-4 text-primary">Property Sale Details</h3>
        <p className="text-muted-foreground">Enter the details of the property you're selling</p>
      </div>
      
      <div className="space-y-6">
        <FormField
          name="sellingPrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expected Selling Price:</FormLabel>
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
          name="sellingAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Property Address:</FormLabel>
              <FormControl>
                <AddressInput 
                  value={field.value}
                  onChange={field.onChange}
                  onPlaceSelected={handlePlaceSelected}
                  placeholder="Enter full property address"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="mt-8">
          <p className="text-sm text-muted-foreground mb-4">
            Next, we'll connect to NetCalcSheet to calculate your estimated proceeds and provide a detailed breakdown.
          </p>
        </div>
      </div>
    </QuestionnaireForm>
  );
}