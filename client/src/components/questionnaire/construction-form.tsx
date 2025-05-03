import { z } from "zod";
import { constructionFormSchema } from "@shared/schema";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import QuestionnaireForm from "./questionnaire-form";

interface ConstructionFormProps {
  onSubmit: (data: z.infer<typeof constructionFormSchema>) => void;
  onBack: () => void;
}

export default function ConstructionForm({ onSubmit, onBack }: ConstructionFormProps) {
  const defaultValues = {
    type: "build" as const,
    projectType: "",
    budget: "",
    timeline: "",
  };

  return (
    <QuestionnaireForm
      schema={constructionFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onBack={onBack}
    >
      <h3 className="text-xl font-semibold mb-6">Construction Information</h3>
      
      <div className="space-y-6">
        <FormField
          name="type"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Construction type:</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-2"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="build" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">New Construction</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="rehab" />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Renovation/Rehabilitation</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="projectType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project type:</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Single-family home, Kitchen remodel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="budget"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estimated budget:</FormLabel>
              <FormControl>
                <Input placeholder="$" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          name="timeline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expected timeline:</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 6 months, 1 year" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </QuestionnaireForm>
  );
}
