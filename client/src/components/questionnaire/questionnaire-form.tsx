import { ReactNode, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ReviewsSection } from "./reviews-section";

interface QuestionnaireFormProps<T extends z.ZodType> {
  schema: T;
  defaultValues: z.infer<T>;
  onSubmit: (data: z.infer<T>) => void;
  onBack: () => void;
  children: ReactNode | ((form: any) => ReactNode);
  submitText?: string;
  isSubmitting?: boolean;
  title?: string;
  description?: string;
}

export default function QuestionnaireForm<T extends z.ZodType>({
  schema,
  defaultValues,
  onSubmit,
  onBack,
  children,
  submitText = "Continue",
  isSubmitting = false,
  title,
  description,
}: QuestionnaireFormProps<T>) {
  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Update form values when defaultValues change (for back button functionality)
  useEffect(() => {
    if (defaultValues && Object.keys(defaultValues).length > 0) {
      // Use setTimeout to ensure the form is ready
      setTimeout(() => {
        form.reset(defaultValues);
      }, 0);
    }
  }, [defaultValues, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="bg-white p-6 rounded-lg shadow-sm">
        {title && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
            {description && (
              <p className="text-gray-600">{description}</p>
            )}
          </div>
        )}
        {typeof children === 'function' ? children(form) : children}
        
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

        <ReviewsSection />
      </form>
    </Form>
  );
}
