import { z } from "zod";
import { insuranceFormSchema } from "@shared/schema";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import QuestionnaireForm from "./questionnaire-form";

interface InsuranceFormProps {
  onSubmit: (data: z.infer<typeof insuranceFormSchema>) => void;
  onBack: () => void;
}

export default function InsuranceForm({ onSubmit, onBack }: InsuranceFormProps) {
  const defaultValues = {
    type: "property" as const,
    currentProvider: "",
    coverageAmount: "",
    additionalInfo: "",
  };

  return (
    <QuestionnaireForm
      schema={insuranceFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <h3 className="text-xl font-semibold mb-6">Insurance Information</h3>
      
      <div className="space-y-6">
        <FormField
          name="type"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Insurance type:</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-2"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="auto" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Auto Insurance</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="property" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Property Insurance</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="other" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Other Insurance</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="currentProvider"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current insurance provider (if any):</FormLabel>
              <FormControl>
                <Input placeholder="Provider name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="coverageAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Desired coverage amount:</FormLabel>
              <FormControl>
                <Input placeholder="$" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="additionalInfo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional information:</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Please provide any additional details about your insurance needs"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </QuestionnaireForm>
  );
}
