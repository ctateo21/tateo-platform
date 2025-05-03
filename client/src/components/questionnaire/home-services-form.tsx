import { z } from "zod";
import { homeServicesFormSchema } from "@shared/schema";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import QuestionnaireForm from "./questionnaire-form";

interface HomeServicesFormProps {
  onSubmit: (data: z.infer<typeof homeServicesFormSchema>) => void;
  onBack: () => void;
}

export default function HomeServicesForm({ onSubmit, onBack }: HomeServicesFormProps) {
  const defaultValues = {
    serviceType: "",
    urgency: "soon" as const,
    description: "",
  };

  return (
    <QuestionnaireForm
      schema={homeServicesFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <h3 className="text-xl font-semibold mb-6">Home Services Information</h3>
      
      <div className="space-y-6">
        <FormField
          name="serviceType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What service do you need?</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Plumbing, Electrical, Landscaping" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="urgency"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>How urgent is this service?</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-2"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="emergency" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Emergency (needs immediate attention)</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="soon" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Soon (within the next few days)</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="planning" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Planning ahead (future project)</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service description:</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Please describe the service you need"
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
