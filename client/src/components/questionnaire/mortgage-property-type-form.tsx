import { useState, useEffect } from "react";
import { z } from "zod";
import { mortgagePropertyTypeSchema } from "@shared/schema";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuestionnaireForm from "./questionnaire-form";

interface MortgagePropertyTypeFormProps {
  initialData: {
    type: "purchase" | "refinance";
    ownershipType: "primary" | "secondary" | "investment";
  };
  onSubmit: (data: z.infer<typeof mortgagePropertyTypeSchema>) => void;
  onBack: () => void;
}

export default function MortgagePropertyTypeForm({ initialData, onSubmit, onBack }: MortgagePropertyTypeFormProps) {
  // Default values from previous form
  const defaultValues = {
    type: initialData.type,
    ownershipType: initialData.ownershipType,
    propertyType: "",
  };

  // Get property type options based on ownership type
  const getPropertyTypeOptions = (ownershipType: string) => {
    // Common options for all property types
    const commonOptions = [
      { value: "single-family", label: "Single Family Home (SFH)" },
      { value: "planned-unit-development", label: "Planned Unit Development (SFH with HOA)" },
      { value: "townhome", label: "Townhome" },
      { value: "condominium", label: "Condominium" },
      { value: "manufactured", label: "Manufactured" },
      { value: "land-new-construction", label: "Land with New Construction" },
      { value: "new-construction-owned-land", label: "New Construction on top of already owned land" },
      { value: "cooperative", label: "Cooperative" },
      { value: "condotel", label: "Condotel" },
    ];

    // Extra options just for investment properties
    const investmentOptions = [
      { value: "commercial", label: "Commercial" },
      { value: "rehab", label: "Rehab" },
      { value: "mixed-use", label: "Mixed Use" },
      { value: "land", label: "Land" },
    ];

    return ownershipType === "investment" 
      ? [...commonOptions, ...investmentOptions]
      : commonOptions;
  };

  // Get title based on ownership and type
  const getTitle = () => {
    const ownership = initialData.ownershipType.charAt(0).toUpperCase() + initialData.ownershipType.slice(1);
    const transaction = initialData.type === "purchase" ? "Purchase" : "Refinance";
    return `${ownership} ${transaction}`;
  };

  return (
    <QuestionnaireForm
      schema={mortgagePropertyTypeSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <div className="text-center mb-8">
        <h3 className="text-2xl font-semibold mb-2 text-primary">{getTitle()}</h3>
        <p className="text-muted-foreground">Please provide more details about your property</p>
      </div>
      
      <div className="space-y-6">
        {/* Property Type */}
        <FormField
          name="propertyType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What type of property?</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {getPropertyTypeOptions(initialData.ownershipType).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </QuestionnaireForm>
  );
}