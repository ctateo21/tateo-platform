import { useState, useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Home, DollarSign, Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuestionnaireForm from "./questionnaire-form";
import CurrencyInput from "./currency-input";

// Schema for payment form
const paymentFormSchema = z.object({
  loanAmount: z.string(),
  interestRate: z.string(),
  loanTerm: z.string(),
  downPayment: z.string(),
  monthlyPayment: z.number().optional(),
  propertyTax: z.number().optional(),
  insurance: z.number().optional(),
  pmiAmount: z.number().optional(),
  totalMonthlyPayment: z.number().optional(),
});

interface MortgagePaymentFormProps {
  onSubmit: (data: z.infer<typeof paymentFormSchema>) => void;
  onBack: () => void;
  defaultValues?: any;
  propertyInfo?: {
    address?: string;
    zipCode?: string;
    purchasePrice?: string;
    estimatedValue?: string;
    propertyValue?: string;
  };
  monthlyIncome?: number;
  monthlyDebts?: number;
  ownershipType?: 'primary' | 'secondary' | 'investment';
  mortgageData?: any;
}

export function MortgagePaymentForm({ 
  onSubmit, 
  onBack, 
  defaultValues,
  propertyInfo = {},
  monthlyIncome = 0,
  monthlyDebts = 0,
  ownershipType = 'primary',
  mortgageData = {}
}: MortgagePaymentFormProps) {
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("7.25"); // Current market rate
  const [loanTerm, setLoanTerm] = useState("30");
  const [downPayment, setDownPayment] = useState(() => {
    // Set default down payment based on ownership type
    if (ownershipType === 'primary') return "3.5";
    if (ownershipType === 'secondary') return "10";
    if (ownershipType === 'investment') return "20";
    return "20";
  });

  // Get down payment options based on ownership type
  const getDownPaymentOptions = () => {
    if (ownershipType === 'primary') {
      return [
        { value: "0-va", label: "0% (VA or USDA)" },
        { value: "0-fha", label: "0% (FHA Down Payment Assistance)" },
        { value: "0-conv", label: "0% (Conventional Down Payment Assistance)" },
        { value: "3", label: "3% (Conventional First Time Home Buyer)" },
        { value: "3.5", label: "3.5% (FHA)" },
        { value: "5", label: "5% (Conventional not First Time Home Buyer)" },
        { value: "10", label: "10%" },
        { value: "15", label: "15%" },
        { value: "20", label: "20% (No PMI)" },
        { value: "25", label: "25%" },
      ];
    } else if (ownershipType === 'secondary') {
      return [
        { value: "10", label: "10% (Minimum)" },
        { value: "15", label: "15%" },
        { value: "20", label: "20%" },
        { value: "25", label: "25%" },
        { value: "30", label: "30%" },
      ];
    } else if (ownershipType === 'investment') {
      return [
        { value: "20", label: "20% (Minimum)" },
        { value: "25", label: "25%" },
        { value: "30", label: "30%" },
        { value: "35", label: "35%" },
        { value: "40", label: "40%" },
      ];
    }
    return [{ value: "20", label: "20%" }];
  };

  // Extract numeric value from down payment for calculations
  const getDownPaymentPercent = () => {
    const value = downPayment.replace(/[^0-9.]/g, '');
    return parseFloat(value) || 0;
  };
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [propertyTax, setPropertyTax] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [pmiAmount, setPmiAmount] = useState(0);
  const [totalMonthlyPayment, setTotalMonthlyPayment] = useState(0);

  // Determine property value from available data
  const getPropertyValue = () => {
    console.log('Getting property value from:', propertyInfo); // Debug log
    if (propertyInfo.purchasePrice) {
      return parseFloat(propertyInfo.purchasePrice.replace(/[$,]/g, '')) || 0;
    }
    if (propertyInfo.estimatedValue) {
      return parseFloat(propertyInfo.estimatedValue.replace(/[$,]/g, '')) || 0;
    }
    if (propertyInfo.propertyValue) {
      return parseFloat(propertyInfo.propertyValue.replace(/[$,]/g, '')) || 0;
    }
    return 400000; // Default estimate
  };

  const propertyValue = getPropertyValue();

  // Initialize loan amount based on down payment
  useEffect(() => {
    const downPaymentPercent = getDownPaymentPercent();
    const calculatedLoanAmount = propertyValue * (1 - downPaymentPercent / 100);
    setLoanAmount(calculatedLoanAmount.toString());
  }, [propertyValue, downPayment]);

  // Calculate monthly payment and other costs
  useEffect(() => {
    const principal = parseFloat(loanAmount.replace(/[$,]/g, '')) || 0;
    const rate = parseFloat(interestRate) / 100 / 12;
    const payments = parseFloat(loanTerm) * 12;

    if (principal > 0 && rate > 0 && payments > 0) {
      // Calculate monthly P&I payment
      const monthlyPI = principal * (rate * Math.pow(1 + rate, payments)) / (Math.pow(1 + rate, payments) - 1);
      setMonthlyPayment(monthlyPI);

      // Estimate property tax (1.2% annually for Florida average)
      const annualPropertyTax = propertyValue * 0.012;
      setPropertyTax(annualPropertyTax / 12);

      // Estimate homeowners insurance ($1,200 annually average)
      setInsurance(1200 / 12);

      // Calculate PMI based on loan type and credit score
      const downPaymentPercent = parseFloat(downPayment) || 20;
      if (downPaymentPercent < 20) {
        let annualPMIRate = 0;
        
        if (mortgageData.loanType === 'FHA') {
          // FHA loans: 0.55% for any credit score
          annualPMIRate = 0.0055;
        } else if (mortgageData.loanType === 'Conventional') {
          // Conventional loans: PMI based on credit score
          const creditScore = mortgageData.creditScore;
          if (creditScore === '780+' || creditScore === '760-779') {
            annualPMIRate = 0.0022; // 760+ = 0.22%
          } else if (creditScore === '740-759') {
            annualPMIRate = 0.003; // 740-759 = 0.30%
          } else if (creditScore === '720-739') {
            annualPMIRate = 0.0035; // 720-739 = 0.35%
          } else if (creditScore === '700-719') {
            annualPMIRate = 0.0045; // 700-719 = 0.45%
          } else if (creditScore === '680-699') {
            annualPMIRate = 0.007; // 680-699 = 0.70%
          } else if (creditScore === '660-679') {
            annualPMIRate = 0.009; // 660-679 = 0.90%
          } else {
            annualPMIRate = 0.016; // 660 and below = 1.60%
          }
        }
        
        setPmiAmount((principal * annualPMIRate) / 12);
      } else {
        setPmiAmount(0);
      }

      // Calculate total monthly payment using the correct PMI amount
      const currentPMI = (downPaymentPercent < 20) ? (principal * (mortgageData.loanType === 'FHA' ? 0.0055 : (mortgageData.creditScore === '780+' ? 0.0031 : 0.006))) / 12 : 0;
      const total = monthlyPI + (annualPropertyTax / 12) + (1200 / 12) + currentPMI;
      setTotalMonthlyPayment(total);
    }
  }, [loanAmount, interestRate, loanTerm, downPayment, propertyValue, mortgageData]);

  // Form default values
  const formDefaults = {
    loanAmount,
    interestRate,
    loanTerm,
    downPayment,
    monthlyPayment,
    propertyTax,
    insurance,
    pmiAmount,
    totalMonthlyPayment,
    ...defaultValues,
  };

  const handleSubmit = (data: any) => {
    const submissionData = {
      ...data,
      loanAmount,
      interestRate,
      loanTerm,
      downPayment,
      monthlyPayment,
      propertyTax,
      insurance,
      pmiAmount,
      totalMonthlyPayment,
    };
    onSubmit(submissionData);
  };

  // Calculate total debt-to-income with housing
  const totalMonthlyObligations = monthlyDebts + totalMonthlyPayment;
  const totalDTI = monthlyIncome > 0 ? (totalMonthlyObligations / monthlyIncome) * 100 : 0;

  return (
    <QuestionnaireForm
      schema={paymentFormSchema}
      defaultValues={formDefaults}
      onSubmit={handleSubmit}
      onBack={onBack}
      submitText="View Loan Analysis"
    >
      <h3 className="text-2xl font-semibold mb-2 text-primary">Monthly Payment Calculation</h3>
      <p className="text-muted-foreground mb-6">Let's calculate your estimated monthly mortgage payment</p>
      
      <div className="space-y-6">
        {/* Property Information */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-900">
              <Home className="h-5 w-5 mr-2" />
              Property Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Show address from previous steps - check all possible sources */}
              {(propertyInfo.address && propertyInfo.address.trim()) ? (
                <div className="flex justify-between">
                  <span className="text-blue-800">Address:</span>
                  <span className="font-medium text-blue-900">{propertyInfo.address}</span>
                </div>
              ) : (propertyInfo.zipCode && propertyInfo.zipCode.trim()) ? (
                <div className="flex justify-between">
                  <span className="text-blue-800">Zip Code:</span>
                  <span className="font-medium text-blue-900">{propertyInfo.zipCode}</span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-blue-800">Location:</span>
                  <span className="font-medium text-blue-900 text-red-600">Address not captured from previous step</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-blue-800">Property Value:</span>
                <span className="font-bold text-blue-900">${propertyValue.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loan Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Down Payment (%) - {ownershipType.charAt(0).toUpperCase() + ownershipType.slice(1)} Residence
            </label>
            <Select value={downPayment} onValueChange={setDownPayment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getDownPaymentOptions().map((option, index) => (
                  <SelectItem key={`${option.value}-${index}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Loan Amount</label>
            <CurrencyInput
              value={loanAmount}
              onChange={setLoanAmount}
              placeholder="$0"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Interest Rate (%)</label>
            <div className="relative">
              <Input
                type="number"
                step="0.125"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="7.25"
              />
              <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Loan Term</label>
            <Select value={loanTerm} onValueChange={setLoanTerm}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 years</SelectItem>
                <SelectItem value="20">20 years</SelectItem>
                <SelectItem value="25">25 years</SelectItem>
                <SelectItem value="30">30 years</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Payment Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calculator className="h-5 w-5 mr-2" />
              Monthly Payment Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Principal & Interest</span>
              <span className="font-medium">${monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Property Tax (estimated)</span>
              <span className="font-medium">${propertyTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Homeowners Insurance (estimated)</span>
              <span className="font-medium">${insurance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            {pmiAmount > 0 && (
              <div className="flex justify-between">
                <span>PMI (Private Mortgage Insurance)</span>
                <span className="font-medium">${pmiAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            <hr />
            <div className="flex justify-between text-lg font-bold">
              <span>Total Monthly Payment</span>
              <span>${totalMonthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Debt-to-Income Analysis */}
        {monthlyIncome > 0 && (
          <div className="space-y-4">
            <h4 className="text-lg font-medium">Complete Financial Picture</h4>
            
            {/* Monthly Income */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-green-800 font-medium">Monthly Income</span>
                <span className="text-green-900 font-bold text-xl">
                  ${monthlyIncome.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Monthly Debts */}
            {monthlyDebts > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-red-800 font-medium">Monthly Debts (existing)</span>
                  <span className="text-red-900 font-bold text-xl">
                    ${monthlyDebts.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Housing Payment */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-orange-800 font-medium">Housing Payment (new)</span>
                <span className="text-orange-900 font-bold text-xl">
                  ${totalMonthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Total DTI */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-blue-800 font-medium">
                  Total Debt-to-Income Ratio
                </span>
                <span className="text-blue-900 font-bold text-xl">
                  {totalDTI.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 text-sm text-blue-700">
                {totalDTI <= 28 ? (
                  <span className="text-green-700">✓ Excellent - Well within preferred limits</span>
                ) : totalDTI <= 36 ? (
                  <span className="text-green-600">✓ Good - Most lenders will approve</span>
                ) : totalDTI <= 43 ? (
                  <span className="text-yellow-700">⚠ Acceptable - Some loan programs available</span>
                ) : (
                  <span className="text-red-700">⚠ High - May need to consider lower price range</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <p>* Property tax and insurance are estimates based on Florida averages</p>
          <p>* Actual rates may vary based on lender, credit score, and market conditions</p>
          <p>* PMI is required for down payments less than 20%</p>
        </div>
      </div>
    </QuestionnaireForm>
  );
}