import { z } from "zod";
import { propertyManagementFormSchema } from "@shared/schema";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuestionnaireForm from "./questionnaire-form";

interface PropertyManagementFormProps {
  onSubmit: (data: z.infer<typeof propertyManagementFormSchema>) => void;
  onBack: () => void;
}

export default function PropertyManagementForm({ onSubmit, onBack }: PropertyManagementFormProps) {
  const defaultValues = {
    type: "manage" as const,
    propertyCount: "",
    propertyType: "residential" as const,
    location: "",
  };

  return (
    <QuestionnaireForm
      schema={propertyManagementFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <h3 className="text-xl font-semibold mb-6">Property Management Information</h3>
      
      <div className="space-y-6">
        <FormField
          name="type"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>I need:</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-2"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="manage" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Property management services</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="rentals" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Rental property search</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="propertyCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number of properties:</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 1, 2-5, 10+" {...field} />
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="mixed">Mixed Use</SelectItem>
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
              <FormLabel>Property location:</FormLabel>
              <FormControl>
                <Input placeholder="City, State, or ZIP" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </QuestionnaireForm>
  );
}
