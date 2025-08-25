import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { Progress } from "@/components/ui/progress";
import { useServices } from "@/context/services-context";
import { useToast } from "@/hooks/use-toast";
import { useQuestionnaireStorage } from "@/hooks/use-questionnaire-storage";
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
import MortgageTypeForm from "@/components/questionnaire/mortgage-type-form";
import PropertyLocationForm from "@/components/questionnaire/property-location-form";
import PropertyOwnershipForm from "@/components/questionnaire/property-ownership-form";
import MortgageTypeStep from "@/components/questionnaire/mortgage-type-step";
import { HomeOwnershipHistoryStep } from "@/components/questionnaire/home-ownership-history-step";
import { CreditScoreStep } from "@/components/questionnaire/credit-score-step";
import PropertyLocationStep from "@/components/questionnaire/property-location-step";
import { LoanTypeStep } from "@/components/questionnaire/loan-type-step";
import { NonQMStep } from "@/components/questionnaire/non-qm-step";
import { RefinanceLienTypeStep } from "@/components/questionnaire/refinance-lien-type-step";
import { LoanBalanceStep } from "@/components/questionnaire/loan-balance-step";
import { RefinanceTypeStep } from "@/components/questionnaire/refinance-type-step";
import { EscrowStep } from "@/components/questionnaire/escrow-step";
import PropertyOwnershipStep from "@/components/questionnaire/property-ownership-step";
import MortgageForm from "@/components/questionnaire/mortgage-form";
import MortgagePropertyTypeForm from "@/components/questionnaire/mortgage-property-type-form";
import { MortgageFinancingForm } from "@/components/questionnaire/mortgage-financing-form";
import { MortgageIncomeForm } from "@/components/questionnaire/mortgage-income-form";

import LenderPriceStep from "@/components/questionnaire/lender-price-step";
import { PlaidIntegration } from "@/components/questionnaire/plaid-integration";
import { PropertyTaxesInsurance } from "@/components/questionnaire/property-taxes-insurance";
import { LoanAnalysis } from "@/components/questionnaire/loan-analysis";
import { RefinancePlaidIntegration } from "@/components/questionnaire/refinance-plaid-integration";
import { RefinancePropertyTaxesInsurance } from "@/components/questionnaire/refinance-property-taxes-insurance";
import { RefinanceLoanAnalysis } from "@/components/questionnaire/refinance-loan-analysis";
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
        case 'type':
          // If at the type step, go back to previous service or home
          if (currentServiceIndex > 0) {
            setCurrentServiceIndex(currentServiceIndex - 1);
            // IMPORTANT: Don't clear the mortgage form data when going back
          } else {
            navigate("/");
          }
          break;
          
        case 'refinance-lien-type':
          // Go back to type step
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'type'
          }));
          break;

        case 'home-ownership-history':
          // Go back to type step
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'type'
          }));
          break;
          
        case 'credit-score':
          // Go back based on mortgage type
          const prevStepFromCreditScore = mortgageFlowState.type === 'refinance' ? 'refinance-lien-type' : 'home-ownership-history';
          setMortgageFlowState(prev => ({
            ...prev,
            step: prevStepFromCreditScore as any
          }));
          break;

        case 'loan-balance':
          // Go back to credit score step
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'credit-score'
          }));
          break;

        case 'refinance-type':
          // Go back to loan balance step
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'loan-balance'
          }));
          break;

        case 'escrow':
          // Go back based on lien type
          const prevStepFromEscrow = mortgageFlowState.lienType === '1st-lien' ? 'refinance-type' : 'loan-balance';
          setMortgageFlowState(prev => ({
            ...prev,
            step: prevStepFromEscrow as any
          }));
          break;
          
        case 'location':
          // Go back based on mortgage type
          const prevStepFromLocation = mortgageFlowState.type === 'refinance' ? 'escrow' : 'credit-score';
          setMortgageFlowState(prev => ({
            ...prev,
            step: prevStepFromLocation as any
          }));
          break;
          
        case 'ownership':
          // Go back to location step
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'location'
          }));
          break;
          
        case 'loan-type':
          // Go back based on mortgage type
          const prevStepFromLoanType = mortgageFlowState.type === 'refinance' ? 'location' : 'ownership';
          setMortgageFlowState(prev => ({
            ...prev,
            step: prevStepFromLoanType as any
          }));
          break;


        case 'non-qm':
          // Go back to loan type step
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'loan-type'
          }));
          break;

        case 'lender-price':
          // Go back based on mortgage type and loan type
          let prevStep: string;
          if (mortgageFlowState.type === 'refinance') {
            prevStep = 'loan-type'; // For refinance, always go back to loan-type
          } else if (mortgageFlowState.loanType === 'jumbo') {
            prevStep = 'loan-type';
          } else if (mortgageFlowState.loanType === 'non-qm') {
            prevStep = 'non-qm';
          } else {
            prevStep = 'loan-type';
          }
          setMortgageFlowState(prev => ({
            ...prev,
            step: prevStep as any
          }));
          break;
          
        case 'income':
          // Go back to lender-price form
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'lender-price'
          }));
          break;

        case 'plaid':
          // Go back to income form
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'income'
          }));
          break;

        case 'taxes-insurance':
          // Go back to plaid form
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'plaid'
          }));
          break;



        case 'loan-analysis':
          // Go back to taxes-insurance form
          setMortgageFlowState(prev => ({
            ...prev,
            step: 'taxes-insurance'
          }));
          break;
          
        default:
          // Default to type step
          setMortgageFlowState({
            step: 'type',
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
          step: 'type',
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
    step: 'type' | 'home-ownership-history' | 'credit-score' | 'location' | 'ownership' | 'loan-type' | 'non-qm' | 'lender-price' | 'income' | 'plaid' | 'taxes-insurance' | 'loan-analysis' | 'refinance-lien-type' | 'loan-balance' | 'refinance-type' | 'escrow';
    type: 'purchase' | 'refinance';
    homeOwnershipHistory?: 'yes' | 'no';
    ownershipType: 'primary' | 'secondary' | 'investment';
    propertyType?: string;
    creditScore?: string;
    loanType?: string;
    assistanceType?: string;
    nonQMType?: string;
    incomeType?: string;
    lienType?: '1st-lien' | '2nd-lien';
    loanBalance?: string;
    refinanceType?: 'cash-out' | 'rate-term';
    escrow?: 'yes' | 'no';
    propertyAddress?: string;
    propertyZipCode?: string;
    purchasePrice?: string;
    isVADisabled?: boolean;
  }>({
    step: 'type',
    type: 'purchase',
    ownershipType: 'primary',
  });

  // Calculate progress - accounting for multi-step flows
  const calculateTotalSteps = () => {
    let total = 0;
    selectedServices.forEach(service => {
      if (service.id === 'mortgage') {
        total += 10; // type, home-ownership-history, location, ownership, lender-price, income, plaid, taxes-insurance, loan-analysis
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
        step += 10;
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
          'type': 1,
          'refinance-lien-type': 2, // refinance only
          'loan-balance': 3, // refinance only
          'refinance-type': 4, // refinance only (1st lien)
          'escrow': 5, // refinance only
          'home-ownership-history': 2, // purchase only
          'credit-score': 3, // both purchase and refinance
          'location': 4, // both purchase and refinance  
          'ownership': 5, // purchase only
          'loan-type': 6, // purchase only
          'non-qm': 6, // purchase only
          'lender-price': 7, // both purchase and refinance
          'income': 8,
          'plaid': 9,
          'taxes-insurance': 10,
          'loan-analysis': 11
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
            intent === 'hold-and-buy' ? 'purchase-method' :
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
  


  // Handle mortgage type step submission (step 1)
  const handleMortgageTypeSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // For refinance, go to lien-type step; for purchase, go to home-ownership-history
    const nextStep = data.type === 'refinance' ? 'refinance-lien-type' : 'home-ownership-history';
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: nextStep as any,
      type: data.type
    }));
  };

  // Handle refinance lien type step submission (refinance step 2)
  const handleRefinanceLienTypeSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'credit-score', // Step 3: Estimated Credit Score
      lienType: data.lienType
    }));
  };

  // Handle loan balance step submission (refinance step 4)
  const handleLoanBalanceSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // For 1st lien, ask about refinance type; for 2nd lien, skip to escrow
    const nextStep = mortgageFlowState.lienType === '1st-lien' ? 'refinance-type' : 'escrow';
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: nextStep as any,
      loanBalance: data.loanBalance
    }));
  };

  // Handle refinance type step submission (refinance step 5 - 1st lien only)
  const handleRefinanceTypeSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'escrow',
      refinanceType: data.refinanceType
    }));
  };

  // Handle escrow step submission (refinance step 6)
  const handleEscrowSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'location', // Step 7: Property Location
      escrow: data.escrow
    }));
  };

  // Handle home ownership history step submission (step 2)
  const handleHomeOwnershipHistorySubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'credit-score',
      homeOwnershipHistory: data.homeOwnershipHistory
    }));
  };

  // Handle credit score step submission (step 3)
  const handleCreditScoreSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // Different flow for refinance vs purchase
    const nextStep = mortgageFlowState.type === 'refinance' ? 'loan-balance' : 'location';
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: nextStep as any,
      creditScore: data.creditScore
    }));
  };

  // Handle property location step submission (step 4 purchase, step 7 refinance)
  const handlePropertyLocationSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // For purchase, go to ownership; for refinance, go to loan type (step 8)
    const nextStep = mortgageFlowState.type === 'purchase' ? 'ownership' : 'loan-type';
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: nextStep as any
    }));
  };

  // Handle property ownership step submission (step 3)
  const handlePropertyOwnershipSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'loan-type',
      ownershipType: data.ownershipType
    }));
  };

  // Handle loan type step submission (step 5/6)
  const handleLoanTypeSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // For refinance, always go directly to lender-price (step 9)
    // For purchase, follow original logic
    let nextStep = 'lender-price';
    
    if (mortgageFlowState.type === 'purchase') {
      if (data.loanType === 'non-qm') {
        nextStep = 'non-qm';
      }
    }
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: nextStep as any,
      loanType: data.loanType
    }));
  };


  // Handle Non-QM step submission (step 7b - conditional)
  const handleNonQMSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'lender-price',
      nonQMType: data.nonQMType
    }));
  };
  

  
  // Handle LenderPrice step submission (step 4)
  const handleLenderPriceSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    // Both purchase and refinance now go to income step
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'income'
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
    
    // Update mortgage flow state to go to plaid integration
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'plaid',
      incomeType: data.incomeType
    }));
  };

  // Handle Plaid integration submission
  const handlePlaidSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'taxes-insurance',
      propertyAddress: formData.mortgage?.propertyAddress,
      propertyZipCode: formData.mortgage?.zipCode,
      purchasePrice: formData.mortgage?.purchasePrice || formData.mortgage?.propertyValue,
      isVADisabled: formData.mortgage?.isVADisabled
    }));
  };

  // Handle Property Taxes & Insurance submission
  const handleTaxesInsuranceSubmit = (data: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setFormData(prev => ({
      ...prev,
      mortgage: {
        ...prev.mortgage,
        ...data
      }
    }));
    
    setMortgageFlowState(prev => ({
      ...prev,
      step: 'loan-analysis'
    }));
  };



  // Handle loan analysis completion
  const handleLoanAnalysisSubmit = (data: any) => {
    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Save the analysis data
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
      step: 'type',
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
          case 'type':
            return <MortgageTypeStep 
              defaultValues={formData.mortgage || {}}
              onSubmit={handleMortgageTypeSubmit} 
              onBack={handleBack} 
            />;
            
          case 'refinance-lien-type':
            return <RefinanceLienTypeStep
              onSubmit={handleRefinanceLienTypeSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'type' }))}
            />;

          case 'home-ownership-history':
            return <HomeOwnershipHistoryStep
              defaultValues={formData.mortgage || {}}
              onSubmit={handleHomeOwnershipHistorySubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'type' }))}
            />;
            
          case 'credit-score':
            const previousStepFromCreditScore = () => {
              if (mortgageFlowState.type === 'refinance') {
                return 'refinance-lien-type';
              } else {
                return 'home-ownership-history';
              }
            };

            return <CreditScoreStep
              defaultValues={formData.mortgage || {}}
              onSubmit={handleCreditScoreSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: previousStepFromCreditScore() as any }))}
            />;

          case 'loan-balance':
            return <LoanBalanceStep
              onSubmit={handleLoanBalanceSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'credit-score' }))}
            />;

          case 'refinance-type':
            return <RefinanceTypeStep
              onSubmit={handleRefinanceTypeSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'loan-balance' }))}
            />;

          case 'escrow':
            const previousStepFromEscrow = () => {
              if (mortgageFlowState.lienType === '1st-lien') {
                return 'refinance-type';
              } else {
                return 'loan-balance';
              }
            };

            return <EscrowStep
              onSubmit={handleEscrowSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: previousStepFromEscrow() as any }))}
            />;
            
          case 'location':
            const previousStepFromLocation = () => {
              if (mortgageFlowState.type === 'refinance') {
                return 'escrow';
              } else {
                return 'credit-score';
              }
            };

            return <PropertyLocationStep
              defaultValues={formData.mortgage || {}}
              mortgageType={mortgageFlowState.type}
              onSubmit={handlePropertyLocationSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: previousStepFromLocation() as any }))}
            />;
            
          case 'ownership':
            return <PropertyOwnershipStep
              defaultValues={formData.mortgage || {}}
              mortgageType={mortgageFlowState.type}
              onSubmit={handlePropertyOwnershipSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'location' }))}
            />;
            
          case 'loan-type':
            const previousStepFromLoanType = () => {
              if (mortgageFlowState.type === 'refinance') {
                return 'location';
              } else {
                return 'ownership';
              }
            };

            return <LoanTypeStep
              defaultValues={formData.mortgage || {}}
              onSubmit={handleLoanTypeSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: previousStepFromLoanType() as any }))}
            />;
            
            
          case 'non-qm':
            return <NonQMStep
              defaultValues={formData.mortgage || {}}
              onSubmit={handleNonQMSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'loan-type' }))}
            />;
            
          case 'lender-price':
            const getPreviousStepFromLenderPrice = () => {
              if (mortgageFlowState.loanType === 'jumbo') {
                return 'loan-type';
              } else if (mortgageFlowState.loanType === 'non-qm') {
                return 'non-qm';
              } else {
                return 'loan-type';
              }
            };

            return <LenderPriceStep
              defaultValues={formData.mortgage || {}}
              mortgageData={formData.mortgage}
              onSubmit={handleLenderPriceSubmit}
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: getPreviousStepFromLenderPrice() as any }))}
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
              onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'lender-price' }))}
            />;

          case 'plaid':
            // Use refinance-specific Plaid component for refinance flow
            if (mortgageFlowState.type === 'refinance') {
              return <RefinancePlaidIntegration
                defaultValues={formData.mortgage || {}}
                onComplete={handlePlaidSubmit}
                onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'income' }))}
                refinanceType={mortgageFlowState.refinanceType || 'rate-term'}
              />;
            } else {
              return <PlaidIntegration
                defaultValues={formData.mortgage || {}}
                onComplete={handlePlaidSubmit}
                onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'income' }))}
              />;
            }

          case 'taxes-insurance':
            // Use refinance-specific taxes & insurance component for refinance flow
            if (mortgageFlowState.type === 'refinance') {
              return <RefinancePropertyTaxesInsurance
                propertyAddress={formData.mortgage?.propertyAddress}
                propertyZipCode={formData.mortgage?.zipCode}
                salePrice={formData.mortgage?.purchasePrice ? parseFloat(formData.mortgage.purchasePrice.replace(/[$,]/g, '')) : formData.mortgage?.propertyValue ? parseFloat(formData.mortgage.propertyValue.replace(/[$,]/g, '')) : 400000}
                isVADisabled={formData.mortgage?.isVADisabled || false}
                defaultValues={formData.mortgage || {}}
                onComplete={handleTaxesInsuranceSubmit}
                onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'plaid' }))}
              />;
            } else {
              return <PropertyTaxesInsurance
                propertyAddress={formData.mortgage?.propertyAddress}
                propertyZipCode={formData.mortgage?.zipCode}
                salePrice={formData.mortgage?.purchasePrice ? parseFloat(formData.mortgage.purchasePrice.replace(/[$,]/g, '')) : 400000}
                isVADisabled={formData.mortgage?.isVADisabled || false}
                isPrimaryResidence={formData.mortgage?.ownershipType === 'primary'}
                defaultValues={formData.mortgage || {}}
                onComplete={handleTaxesInsuranceSubmit}
                onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'plaid' }))}
              />;
            }
            


          case 'loan-analysis':
            // Use refinance-specific loan analysis component for refinance flow
            if (mortgageFlowState.type === 'refinance') {
              return <RefinanceLoanAnalysis
                defaultValues={formData.mortgage || {}}
                onComplete={handleLoanAnalysisSubmit}
                onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'taxes-insurance' }))}
              />;
            } else {
              return <LoanAnalysis
                defaultValues={formData.mortgage || {}}
                onComplete={handleLoanAnalysisSubmit}
                onBack={() => setMortgageFlowState(prev => ({ ...prev, step: 'taxes-insurance' }))}
              />;
            }
            
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