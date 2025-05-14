import { z } from "zod";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import QuestionnaireForm from "./questionnaire-form";
import AddressInput from "./address-input";
import CurrencyInput from "./currency-input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Define a schema for the cash purchase form
const cashPurchaseSchema = z.object({
  purchasePrice: z.string().min(1, "Purchase price is required"),
  propertyAddress: z.string().min(3, "Please enter a valid address")
});

interface CashPurchaseFormProps {
  onSubmit: (data: z.infer<typeof cashPurchaseSchema>) => void;
  onBack: () => void;
}

export default function CashPurchaseForm({ onSubmit, onBack }: CashPurchaseFormProps) {
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  
  const defaultValues = {
    purchasePrice: "",
    propertyAddress: ""
  };

  // Handle when a place is selected from Google Places API
  const handlePlaceSelected = (place: any) => {
    setSelectedPlace(place);
  };

  return (
    <QuestionnaireForm
      schema={cashPurchaseSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <div className="text-center mb-8">
        <h3 className="text-2xl font-semibold mb-4 text-primary">Cash Purchase Details</h3>
        <p className="text-muted-foreground">Enter the details of your cash purchase</p>
      </div>
      
      <div className="space-y-6">
        <FormField
          name="purchasePrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Purchase Price:</FormLabel>
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
          name="propertyAddress"
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
            Next, we'll connect to NetCalcSheet to calculate your costs and provide a detailed breakdown.
          </p>
        </div>
      </div>
    </QuestionnaireForm>
  );
}