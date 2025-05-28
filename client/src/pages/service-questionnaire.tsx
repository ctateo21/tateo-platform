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
import MortgagePropertyTypeForm from "@/components/questionnaire/mortgage-property-type-form";
import { MortgageFinancingForm } from "@/components/questionnaire/mortgage-financing-form";
import { MortgageIncomeForm } from "@/components/questionnaire/mortgage-income-form";
import { MortgageLiabilitiesForm } from "@/components/questionnaire/mortgage-liabilities-form";
import { MortgagePaymentForm } from "@/components/questionnaire/mortgage-payment-form";
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
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    // Load saved data from localStorage on initial render
    const saved = localStorage.getItem('questionnaire-form-data');
    return saved ? JSON.parse(saved) : {};
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('questionnaire-form-data', JSON.stringify(formData));
  }, [formData]);

  // Get current service
  const currentService = selectedServices[currentServiceIndex];
  
  useEffect(() => {
    // Scroll to top when component mounts (when starting questionnaire)
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
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
    
    // Scroll to top of page smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
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
    // Scroll to top of page smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
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
        case 'mortgage':
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
    } 
    // If we're in the mortgage flow, handle back navigation within the flow
    else if (currentService?.id === 'mortgage') {
      switch (mortgageFlowState.step) {
        case 'initial':
          // If at the initial step, go back to previous service or home
          if (currentServiceIndex > 0) {
            setCurrentServiceIndex(currentServiceIndex - 1);
            // IMPORTANT: Don't clear the mortgage form data when going back
          } else {
            navigate("/");
          }
          break;
          
        case 'property-type':
          // Go back to initial mortgage form - don't lose the saved data
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'initial'
          }));
          // The formData should persist automatically
          break;
          
        case 'financing':
          // Go back to property type form
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'property-type'
          }));
          break;
          
        case 'income':
          // Go back to financing form
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'financing'
          }));
          break;
          
        default:
          // Default to initial
          setMortgageFlowState({
            step: 'initial',
            type: 'purchase',
            ownershipType: 'primary'
          });
      }
    } else if (currentServiceIndex > 0) {
      // If we're not in a multi-step flow, go back to previous service
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
      
      // If the previous service is mortgage, reset its flow state but keep the data
      if (selectedServices[currentServiceIndex - 1]?.id === 'mortgage') {
        setMortgageFlowState({
          step: 'initial',
          type: 'purchase',
          ownershipType: 'primary' 
        });
        // Don't clear the formData here - keep the saved answers
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
      localStorage.removeItem('questionnaire-form-data'); // Clear saved data after successful submission
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
  
  // Track real estate flow
  const [realEstateFlowState, setRealEstateFlowState] = useState({
    step: 'initial', // initial, purchase-method, buy-type, sell-type, cash-purchase, sell-property, mortgage
    intent: '',      // buy, sell, both
    purchaseMethod: '', // cash, mortgage
    sellType: '',    // primary, 1031exchange
    buyType: ''      // primary, other
  });
  
  // Track mortgage flow with proper typing
  const [mortgageFlowState, setMortgageFlowState] = useState<{
    step: 'initial' | 'property-type' | 'financing' | 'income' | 'liabilities' | 'payment';
    type: 'purchase' | 'refinance';
    ownershipType: 'primary' | 'secondary' | 'investment';
    propertyType?: string;
    creditScore?: string;
    loanType?: string;
    nonQMType?: string;
    incomeType?: string;
  }>({
    step: 'initial',
    type: 'purchase',
    ownershipType: 'primary',
  });

  // Calculate progress - accounting for multi-step flows
  const calculateTotalSteps = () => {
    let total = 0;
    selectedServices.forEach(service => {
      if (service.id === 'mortgage') {
        total += 6; // initial, property-type, financing, income, liabilities, payment
      } else if (service.id === 'real-estate') {
        total += 3;
      } else {
        total += 1;
      }
    });
    total += 1; // +1 for contact form
    return total;
  };

  const calculateCurrentStep = () => {
    let step = 0;
    
    // Count completed services
    for (let i = 0; i < currentServiceIndex; i++) {
      const service = selectedServices[i];
      if (service.id === 'mortgage') {
        step += 6;
      } else if (service.id === 'real-estate') {
        step += 3;
      } else {
        step += 1;
      }
    }
    
    // Add current service progress
    if (currentService) {
      if (currentService.id === 'mortgage') {
        const mortgageSteps = { 
          'initial': 1, 
          'property-type': 2, 
          'financing': 3, 
          'income': 4,
          'liabilities': 5,
          'payment': 6
        };
        step += mortgageSteps[mortgageFlowState.step] || 1;
      } else {
        step += 1;
      }
    }
    
    return step;
  };

  const totalSteps = calculateTotalSteps();
  const currentStep = calculateCurrentStep();
  const progressPercentage = (currentStep / totalSteps) * 100;
  
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
    
    // If mortgage, go to mortgage form, otherwise collect cash purchase details
    setRealEstateFlowState(prev => ({
      ...prev,
      step: purchaseMethod === 'cash' ? 'cash-purchase' : 'mortgage',
      purchaseMethod
    }));
  }
  
  // Handle mortgage form submission from within real estate flow
  const handleMortgageSubmit = (data: any) => {
    // Save the mortgage details
    setFormData(prev => ({
      ...prev,
      realEstate: {
        ...prev.realEstate,
        mortgageDetails: data
      },
      // Also save to mortgage service if selected
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // Complete the real estate service and move to next service
    handleFormData('realEstate', {
      ...formData.realEstate,
      mortgageDetails: data
    });
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
  
  // Handle initial mortgage form submission
  const handleMortgageInitialSubmit = (data: any) => {
    const { type, ownershipType } = data;
    
    console.log('Saving mortgage data:', data); // Debug log
    
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Save the form data
    setFormData(prev => {
      const newData = {
        ...prev,
        mortgage: {
          ...prev.mortgage,
          ...data
        }
      };
      console.log('Updated formData:', newData); // Debug log
      return newData;
    });
    
    // Update mortgage flow state to go to property type form
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'property-type',
      type,
      ownershipType: ownershipType || 'primary'
    }));
  };
  
  // Handle mortgage property type form submission
  const handleMortgagePropertyTypeSubmit = (data: any) => {
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Save the form data
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // Update mortgage flow state to go to financing form
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'financing',
      propertyType: data.propertyType
    }));
  };
  
  // Handle mortgage financing form submission
  const handleMortgageFinancingSubmit = (data: any) => {
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Save the form data
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // Update mortgage flow state to go to income form
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'income',
      creditScore: data.creditScore,
      loanType: data.loanType,
      nonQMType: data.nonQMType
    }));
  };
  
  // Handle mortgage income form submission
  const handleMortgageIncomeSubmit = (data: any) => {
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Save the form data
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // Update mortgage flow state to go to liabilities form
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'liabilities',
      incomeType: data.incomeType
    }));
  };

  // Handle mortgage liabilities form submission
  const handleMortgageLiabilitiesSubmit = (data: any) => {
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Save the form data
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // Update mortgage flow state to go to payment calculation
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'payment'
    }));
  };

  // Handle mortgage payment form submission
  const handleMortgagePaymentSubmit = (data: any) => {
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Save the full data
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // Complete the mortgage service and move to next service
    handleFormData('mortgage', {
      ...formData.mortgage,
      ...data
    });
    
    // Reset mortgage flow for next time
    setMortgageFlowState({
      step: 'initial',
      type: 'purchase',
      ownershipType: 'primary'
    });
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
            
          case 'mortgage':
            return <MortgageForm
              onSubmit={handleMortgageSubmit}
              onBack={handleBack}
            />;
            
          case 'mortgage-redirect':
            // For backward compatibility
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
        // Handle mortgage flow based on the current step
        switch (mortgageFlowState.step) {
          case 'initial':
            console.log('All formData:', formData); // Debug log
            console.log('Mortgage form data:', formData.mortgage); // Debug log
            return <MortgageForm 
              defaultValues={formData.mortgage || {}}
              onSubmit={handleMortgageInitialSubmit} 
              onBack={handleBack} 
            />;
            
          case 'property-type':
            return <MortgagePropertyTypeForm
              initialData={{
                type: mortgageFlowState.type,
                ownershipType: mortgageFlowState.ownershipType
              }}
              onSubmit={handleMortgagePropertyTypeSubmit}
              onBack={handleBack}
            />;
            
          case 'financing':
            return <MortgageFinancingForm
              initialData={{
                type: mortgageFlowState.type,
                ownershipType: mortgageFlowState.ownershipType,
                propertyType: mortgageFlowState.propertyType
              }}
              onSubmit={handleMortgageFinancingSubmit}
              onBack={handleBack}
            />;
            
          case 'income':
            return <MortgageIncomeForm
              initialData={{
                type: mortgageFlowState.type,
                ownershipType: mortgageFlowState.ownershipType,
                loanType: mortgageFlowState.loanType
              }}
              formData={formData.mortgage}
              onSubmit={handleMortgageIncomeSubmit}
              onBack={handleBack}
            />;
            
          case 'liabilities':
            // Calculate monthly income from saved data
            const savedMortgageData = formData.mortgage || {};
            let calculatedMonthlyIncome = 0;
            
            if (savedMortgageData.incomeType === 'salary-w2') {
              const baseSalary = parseFloat(savedMortgageData.baseSalary?.replace(/[$,]/g, '') || '0');
              const commission = parseFloat(savedMortgageData.commissionAverage?.replace(/[$,]/g, '') || '0');
              const bonus = parseFloat(savedMortgageData.bonusAverage?.replace(/[$,]/g, '') || '0');
              const overtime = parseFloat(savedMortgageData.overtimeAverage?.replace(/[$,]/g, '') || '0');
              calculatedMonthlyIncome = (baseSalary + commission + bonus + overtime) / 12;
            } else if (savedMortgageData.incomeType === 'hourly-w2') {
              const hourlyWage = parseFloat(savedMortgageData.hourlyWage?.replace(/[$,]/g, '') || '0');
              const hoursPerWeek = parseFloat(savedMortgageData.hoursPerWeek || '0');
              calculatedMonthlyIncome = (hourlyWage * hoursPerWeek * 52) / 12;
            } else if (savedMortgageData.incomeType === 'self-employed') {
              const businessIncome = parseFloat(savedMortgageData.businessIncome?.replace(/[$,]/g, '') || '0');
              const ownershipPercentage = parseFloat(savedMortgageData.ownershipPercentage || '100') / 100;
              calculatedMonthlyIncome = (businessIncome * ownershipPercentage) / 12;
            }
            
            return <MortgageLiabilitiesForm
              onSubmit={handleMortgageLiabilitiesSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'income' }))}
              defaultValues={formData.mortgage}
              monthlyIncome={calculatedMonthlyIncome}
            />;

          case 'payment':
            // Calculate values for payment form
            const mortgageData = formData.mortgage || {};
            console.log('Payment step - mortgage data:', mortgageData); // Debug log
            let monthlyIncome = 0;
            let monthlyDebts = 0;
            
            // Calculate monthly income
            if (mortgageData.incomeType === 'salary-w2') {
              const baseSalary = parseFloat(mortgageData.baseSalary?.replace(/[$,]/g, '') || '0');
              const commission = parseFloat(mortgageData.commissionAverage?.replace(/[$,]/g, '') || '0');
              const bonus = parseFloat(mortgageData.bonusAverage?.replace(/[$,]/g, '') || '0');
              const overtime = parseFloat(mortgageData.overtimeAverage?.replace(/[$,]/g, '') || '0');
              monthlyIncome = (baseSalary + commission + bonus + overtime) / 12;
            } else if (mortgageData.incomeType === 'hourly-w2') {
              const hourlyWage = parseFloat(mortgageData.hourlyWage?.replace(/[$,]/g, '') || '0');
              const hoursPerWeek = parseFloat(mortgageData.hoursPerWeek || '0');
              monthlyIncome = (hourlyWage * hoursPerWeek * 52) / 12;
            } else if (mortgageData.incomeType === 'self-employed') {
              const businessIncome = parseFloat(mortgageData.businessIncome?.replace(/[$,]/g, '') || '0');
              const ownershipPercentage = parseFloat(mortgageData.ownershipPercentage || '100') / 100;
              monthlyIncome = (businessIncome * ownershipPercentage) / 12;
            }

            // Calculate monthly debts
            if (mortgageData.inputMethod === 'manual' && mortgageData.manualDebts) {
              monthlyDebts = mortgageData.manualDebts.reduce((sum: number, debt: any) => {
                const payment = parseFloat(debt.monthlyPayment?.replace(/[$,]/g, '') || '0');
                return sum + payment;
              }, 0);
            } else if (mortgageData.plaidConnected) {
              monthlyDebts = 810; // Simulated Plaid data
            }
            
            return <MortgagePaymentForm
              onSubmit={handleMortgagePaymentSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'liabilities' }))}
              defaultValues={formData.mortgage}
              propertyInfo={{
                address: mortgageData.propertyAddress,
                zipCode: mortgageData.zipCode,
                purchasePrice: mortgageData.purchasePrice,
                estimatedValue: mortgageData.estimatedValue,
                propertyValue: mortgageData.propertyValue
              }}
              monthlyIncome={monthlyIncome}
              monthlyDebts={monthlyDebts}
              ownershipType={mortgageFlowState.ownershipType}
            />;
            
          default:
            return <div>Unknown mortgage step</div>;
        }
        
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