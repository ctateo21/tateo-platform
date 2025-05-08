import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { Progress } from "@/components/ui/progress";
import { useServices } from "@/context/services-context";
import { useToast } from "@/hooks/use-toast";
import { submitQuestionnaire } from "@/lib/api";
import { ServiceCategory } from "@shared/schema";

// Import all form components
import RealEstateForm from "@/components/questionnaire/real-estate-form";
import MortgageForm from "@/components/questionnaire/mortgage-form";
import InsuranceForm from "@/components/questionnaire/insurance-form";
import ConstructionForm from "@/components/questionnaire/construction-form";
import PropertyManagementForm from "@/components/questionnaire/property-management-form";
import HomeServicesForm from "@/components/questionnaire/home-services-form";
import ContactForm from "@/components/questionnaire/contact-form";

// UI Components
import { Card, CardContent } from "@/components/ui/card";
import { Check, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ServiceQuestionnaire() {
  const [location, navigate] = useLocation();
  const { selectedServices, clearSelectedServices } = useServices();
  const { toast } = useToast();
  
  // State for tracking current service being worked on
  const [currentServiceIndex, setCurrentServiceIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Get current service
  const currentService = selectedServices[currentServiceIndex];
  
  useEffect(() => {
    // Redirect if no services selected
    if (selectedServices.length === 0 && !submitting && !submitSuccess) {
      navigate("/");
      toast({
        title: "No services selected",
        description: "Please select services before proceeding to the questionnaire.",
        variant: "destructive",
      });
    }
  }, [selectedServices, navigate, toast, submitting, submitSuccess]);
  
  // Handle form data for current service
  const handleFormData = (serviceId: string, data: any) => {
    setFormData(prev => ({
      ...prev,
      [serviceId]: data
    }));
    
    // Move to next service if available
    if (currentServiceIndex < selectedServices.length - 1) {
      setCurrentServiceIndex(currentServiceIndex + 1);
    } else {
      // All services completed, show contact form
      proceedToContactForm();
    }
  };
  
  // Move to contact form after collecting all service data
  const proceedToContactForm = () => {
    // Implementation will be added later
  };
  
  // Go back to previous service or home
  const handleBack = () => {
    if (currentServiceIndex > 0) {
      setCurrentServiceIndex(currentServiceIndex - 1);
    } else {
      navigate("/");
    }
  };
  
  // Handle final submission with contact info
  const handleSubmit = async (contactData: any) => {
    try {
      setSubmitting(true);
      
      // Final submission data
      const submissionData = {
        selectedServices: selectedServices.map(service => service.id),
        ...formData,
        contact: contactData
      };
      
      // Submit data
      const response = await submitQuestionnaire(submissionData);
      
      setSubmitSuccess(true);
      clearSelectedServices(); // Clear selections after successful submission
      toast({
        title: "Submission successful",
        description: "Thank you for your submission. We'll be in touch soon.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error submitting questionnaire:", error);
      toast({
        title: "Submission failed",
        description: "There was a problem submitting your information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  // Calculate progress
  const totalSteps = selectedServices.length + 1; // +1 for contact form
  const currentStep = currentServiceIndex + 1;
  const progressPercentage = (currentStep / totalSteps) * 100;

  // Render the appropriate form for the current service
  const renderServiceForm = (service: ServiceCategory) => {
    switch (service.id) {
      case 'real-estate':
        return <RealEstateForm onSubmit={(data) => handleFormData('realEstate', data)} onBack={handleBack} />;
      case 'mortgage':
        return <MortgageForm onSubmit={(data) => handleFormData('mortgage', data)} onBack={handleBack} />;
      case 'insurance':
        return <InsuranceForm onSubmit={(data) => handleFormData('insurance', data)} onBack={handleBack} />;
      case 'construction':
        return <ConstructionForm onSubmit={(data) => handleFormData('construction', data)} onBack={handleBack} />;
      case 'property-management':
        return <PropertyManagementForm onSubmit={(data) => handleFormData('propertyManagement', data)} onBack={handleBack} />;
      case 'home-services':
        return <HomeServicesForm onSubmit={(data) => handleFormData('homeServices', data)} onBack={handleBack} />;
      default:
        return <div>Service form not found</div>;
    }
  };

  return (
    <>
      <Helmet>
        <title>Service Questionnaire | Tateo & Co</title>
      </Helmet>
      
      <section className="py-16 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            {!submitSuccess ? (
              <>
                {/* Progress Tracker */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-2xl font-bold text-primary">
                      {currentService ? currentService.displayName : "Contact Information"}
                    </h2>
                    <span className="text-sm text-foreground/70">
                      Step {currentStep} of {totalSteps}
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                  
                  {/* Service Order Display */}
                  <div className="mt-4 flex items-center space-x-2">
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <span>Services:</span>
                      {selectedServices.map((service, index) => (
                        <div key={service.id} className="flex items-center">
                          {index > 0 && <ArrowRight className="h-3 w-3 mx-1" />}
                          <span className={index === currentServiceIndex ? "font-semibold text-primary" : ""}>
                            {service.displayName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Current Form */}
                {currentService && renderServiceForm(currentService)}
              </>
            ) : (
              /* Thank You Screen */
              <Card className="bg-white p-6 rounded-lg shadow-sm text-center">
                <CardContent className="py-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-6">
                    <Check className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Thank You!</h3>
                  <p className="text-foreground/70 mb-6">
                    We've received your information and a Tateo & Co representative will contact you shortly to discuss your selected services.
                  </p>
                  <Button
                    onClick={() => navigate("/")}
                    className="bg-primary hover:bg-primary/90 text-white font-medium"
                  >
                    Back to Home
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </>
  );
}