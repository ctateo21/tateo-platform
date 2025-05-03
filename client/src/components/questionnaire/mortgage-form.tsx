import { z } from "zod";
import { mortgageFormSchema } from "@shared/schema";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuestionnaireForm from "./questionnaire-form";

interface MortgageFormProps {
  onSubmit: (data: z.infer<typeof mortgageFormSchema>) => void;
  onBack: () => void;
}

export default function MortgageForm({ onSubmit, onBack }: MortgageFormProps) {
  const defaultValues = {
    type: "refinance" as const,
    propertyValue: "",
    mortgageBalance: "",
    creditScore: "good" as const,
  };

  return (
    <QuestionnaireForm
      schema={mortgageFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <h3 className="text-xl font-semibold mb-6">Mortgage Information</h3>
      
      <div className="space-y-6">
        <FormField
          name="type"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>I am interested in:</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-2"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="refinance" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Refinancing my current mortgage</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="cashout" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Cash-out refinance</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="propertyValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current property value (estimate):</FormLabel>
              <FormControl>
                <Input placeholder="$" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="mortgageBalance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current mortgage balance:</FormLabel>
              <FormControl>
                <Input placeholder="$" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="creditScore"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Credit score range:</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="excellent">Excellent (720+)</SelectItem>
                  <SelectItem value="good">Good (680-719)</SelectItem>
                  <SelectItem value="fair">Fair (620-679)</SelectItem>
                  <SelectItem value="poor">Poor (Below 620)</SelectItem>
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
