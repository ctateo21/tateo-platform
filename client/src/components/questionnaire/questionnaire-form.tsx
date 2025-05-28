import { ReactNode, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface QuestionnaireFormProps<T extends z.ZodType> {
  schema: T;
  defaultValues: z.infer<T>;
  onSubmit: (data: z.infer<T>) => void;
  onBack: () => void;
  children: ReactNode;
  submitText?: string;
  isSubmitting?: boolean;
}

export default function QuestionnaireForm<T extends z.ZodType>({
  schema,
  defaultValues,
  onSubmit,
  onBack,
  children,
  submitText = "Continue",
  isSubmitting = false,
}: QuestionnaireFormProps<T>) {
  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Update form values when defaultValues change (for back button functionality)
  useEffect(() => {
    if (defaultValues) {
      form.reset(defaultValues);
    }
  }, [defaultValues, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white p-6 rounded-lg shadow-sm">
        {children}
        
        <div className="flex justify-between mt-8">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onBack}
            disabled={isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {submitText} {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
