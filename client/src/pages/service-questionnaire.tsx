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
import RealEstateInitialForm from "@/components/questionnaire/real-estate-initial-form";
import PurchaseMethodForm from "@/components/questionnaire/purchase-method-form";
import BuyTypeForm from "@/components/questionnaire/buy-type-form";
import SellTypeForm from "@/components/questionnaire/sell-type-form";
import CashPurchaseForm from "@/components/questionnaire/cash-purchase-form";
import SellPropertyForm from "@/components/questionnaire/sell-property-form";
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
  
  // Go back to previous step or previous service
  const handleBack = () => {
    // If we're in the real estate flow, handle back navigation within the flow
    if (currentService?.id === 'real-estate') {
      switch (realEstateFlowState.step) {
        case 'initial':
          // If at the initial step, go back to home
          navigate("/");
          break;
          
        case 'purchase-method':
          // If we got here from a 'buy' intent, go back to initial
          // If we got here from 'both' -> sell-type -> buy-type, go back to buy-type
          // If we got here from 'both' -> sell-type (1031exchange), go back to sell-type
          if (realEstateFlowState.intent === 'buy') {
            setRealEstateFlowState(prev => ({
              ...prev,
              step: 'initial'
            }));
          } else if (realEstateFlowState.buyType) {
            setRealEstateFlowState(prev => ({
              ...prev,
              step: 'buy-type'
            }));
          } else if (realEstateFlowState.sellType) {
            setRealEstateFlowState(prev => ({
              ...prev,
              step: 'sell-type'
            }));
          }
          break;
          
        case 'buy-type':
          // If we're at buy-type, we got here from sell-type
          setRealEstateFlowState(prev => ({
            ...prev,
            step: 'sell-type'
          }));
          break;
          
        case 'sell-type':
          // If we're at sell-type, we got here from initial
          setRealEstateFlowState(prev => ({
            ...prev,
            step: 'initial'
          }));
          break;
          
        case 'cash-purchase':
          // Go back to purchase method
          setRealEstateFlowState(prev => ({
            ...prev,
            step: 'purchase-method'
          }));
          break;
          
        case 'sell-property':
          // If from initial sell, go back to initial
          if (realEstateFlowState.intent === 'sell') {
            setRealEstateFlowState(prev => ({
              ...prev,
              step: 'initial'
            }));
          } else {
            // Otherwise from complex flow, determine the step
            setRealEstateFlowState(prev => ({
              ...prev,
              step: prev.buyType ? 'buy-type' : 
                    prev.sellType ? 'sell-type' : 
                    'initial'
            }));
          }
          break;
          
        case 'mortgage-redirect':
          // Go back to purchase method
          setRealEstateFlowState(prev => ({
            ...prev,
            step: 'purchase-method'
          }));
          break;
          
        default:
          // Default to initial
          setRealEstateFlowState(prev => ({
            ...prev,
            step: 'initial'
          }));
      }
    } else if (currentServiceIndex > 0) {
      // If we're not in the real estate flow, go back to previous service
      setCurrentServiceIndex(currentServiceIndex - 1);
      
      // If the previous service is real-estate, reset its flow state
      if (selectedServices[currentServiceIndex - 1]?.id === 'real-estate') {
        setRealEstateFlowState({
          step: 'initial',
          intent: '',
          purchaseMethod: '',
          sellType: '',
          buyType: ''
        });
      }
    } else {
      // If at the first service, go back to home
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

  // Track real estate flow
  const [realEstateFlowState, setRealEstateFlowState] = useState({
    step: 'initial', // initial, purchase-method, buy-type, sell-type, cash-purchase, sell-property, mortgage
    intent: '',      // buy, sell, both
    purchaseMethod: '', // cash, mortgage
    sellType: '',    // primary, 1031exchange
    buyType: ''      // primary, other
  });
  
  // Handle initial form data for real estate
  const handleRealEstateInitialSubmit = (data: any) => {
    // Save the initial intent data and set next step
    const { intent } = data;
    setFormData(prev => ({
      ...prev,
      realEstate: {
        ...prev.realEstate,
        intent
      }
    }));
    
    setRealEstateFlowState(prev => ({
      ...prev,
      step: intent === 'buy' ? 'purchase-method' : 
            intent === 'sell' ? 'sell-property' : 
            'sell-type', // for 'both'
      intent
    }));
  };
  
  // Handle purchase method selection
  const handlePurchaseMethodSubmit = (data: any) => {
    const { purchaseMethod } = data;
    setFormData(prev => ({
      ...prev,
      realEstate: {
        ...prev.realEstate,
        purchaseMethod
      }
    }));
    
    // If mortgage, go to mortgage service, otherwise collect cash purchase details
    setRealEstateFlowState(prev => ({
      ...prev,
      step: purchaseMethod === 'cash' ? 'cash-purchase' : 'mortgage-redirect',
      purchaseMethod
    }));
  };
  
  // Handle sell type selection for both buy & sell
  const handleSellTypeSubmit = (data: any) => {
    const { sellType } = data;
    setFormData(prev => ({
      ...prev,
      realEstate: {
        ...prev.realEstate,
        sellType
      }
    }));
    
    // After selecting sell type, we need to know what they're buying
    setRealEstateFlowState(prev => ({
      ...prev,
      step: sellType === 'primary' ? 'buy-type' : 'purchase-method', // 1031 exchange goes directly to purchase method
      sellType
    }));
  };
  
  // Handle buy type selection
  const handleBuyTypeSubmit = (data: any) => {
    const { buyType } = data;
    setFormData(prev => ({
      ...prev,
      realEstate: {
        ...prev.realEstate,
        buyType
      }
    }));
    
    // After selecting buy type, go to purchase method
    setRealEstateFlowState(prev => ({
      ...prev,
      step: 'purchase-method',
      buyType
    }));
  };
  
  // Handle cash purchase form
  const handleCashPurchaseSubmit = (data: any) => {
    // Save the cash purchase details
    setFormData(prev => ({
      ...prev,
      realEstate: {
        ...prev.realEstate,
        ...data
      }
    }));
    
    // Complete the real estate service and move to next service
    handleFormData('realEstate', {
      ...formData.realEstate,
      ...data
    });
  };
  
  // Handle sell property form
  const handleSellPropertySubmit = (data: any) => {
    // Save the selling details
    setFormData(prev => ({
      ...prev,
      realEstate: {
        ...prev.realEstate,
        ...data
      }
    }));
    
    // Complete the real estate service and move to next service
    handleFormData('realEstate', {
      ...formData.realEstate,
      ...data
    });
  };
  
  // Redirect to mortgage service
  const handleMortgageRedirect = () => {
    // Find mortgage service index if it exists in selected services
    const mortgageIndex = selectedServices.findIndex(s => s.id === 'mortgage');
    
    if (mortgageIndex !== -1) {
      // If mortgage is already in selected services, move to that index
      setCurrentServiceIndex(mortgageIndex);
    } else {
      // Otherwise, complete real estate service
      handleFormData('realEstate', formData.realEstate);
    }
  };
  
  // Render the appropriate form for the current service
  const renderServiceForm = (service: ServiceCategory) => {
    switch (service.id) {
      case 'real-estate':
        // Handle real estate flow based on the current step
        switch (realEstateFlowState.step) {
          case 'initial':
            return <RealEstateInitialForm 
              onSubmit={handleRealEstateInitialSubmit} 
              onBack={handleBack} 
            />;
            
          case 'purchase-method':
            return <PurchaseMethodForm
              onSubmit={handlePurchaseMethodSubmit}
              onBack={handleBack}
            />;
            
          case 'buy-type':
            return <BuyTypeForm
              onSubmit={handleBuyTypeSubmit}
              onBack={handleBack}
            />;
            
          case 'sell-type':
            return <SellTypeForm
              onSubmit={handleSellTypeSubmit}
              onBack={handleBack}
            />;
            
          case 'cash-purchase':
            return <CashPurchaseForm
              onSubmit={handleCashPurchaseSubmit}
              onBack={handleBack}
            />;
            
          case 'sell-property':
            return <SellPropertyForm
              onSubmit={handleSellPropertySubmit}
              onBack={handleBack}
            />;
            
          case 'mortgage-redirect':
            // Immediately redirect to mortgage service
            setTimeout(() => {
              handleMortgageRedirect();
            }, 0);
            return <div className="text-center py-8">
              <p>Redirecting to mortgage questionnaire...</p>
            </div>;
            
          default:
            return <div>Unknown real estate step</div>;
        }
        
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