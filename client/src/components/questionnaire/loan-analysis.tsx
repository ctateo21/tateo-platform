import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, DollarSign, Home, Calculator, FileText } from "lucide-react";
import { ReviewsSection } from "./reviews-section";
import { useState } from "react";

interface LoanAnalysisProps {
  defaultValues: any;
  onComplete: (data: any) => void;
  onBack: () => void;
}

export function LoanAnalysis({ defaultValues, onComplete, onBack }: LoanAnalysisProps) {
  const [downPaymentAssistance, setDownPaymentAssistance] = useState(false);
  const [closingCostAssistance, setClosingCostAssistance] = useState(false);
  
  // Get loan type and home ownership history from mortgage data
  const selectedLoanType = defaultValues.loanType || 'conventional';
  const homeOwnershipHistory = defaultValues.homeOwnershipHistory || 'no'; // 'yes' means they owned home in last 3 years, 'no' means first-time buyer
  
  // Determine minimum down payment based on loan type and first-time buyer status
  const getMinDownPayment = (loanType: string, isFirstTimeBuyer: boolean) => {
    if (loanType === 'conventional') {
      return isFirstTimeBuyer ? 3 : 5; // 3% for first-time, 5% for repeat buyers
    }
    // Other loan types remain the same
    switch (loanType.toLowerCase()) {
      case 'fha': return 3.5;
      case 'va': return 0;
      case 'usda': return 0;
      case 'jumbo': return 10;
      default: return 5;
    }
  };
  
  // Determine which assistance programs to show based on loan type
  const showDownPaymentAssistance = selectedLoanType === 'conventional' || selectedLoanType === 'fha';
  const showClosingCostAssistance = true; // Always show closing cost assistance
  
  // Calculate maximum closing cost assistance based on loan type
  const getMaxClosingCostAssistance = (loanType: string, purchasePrice: number) => {
    switch (loanType.toLowerCase()) {
      case 'conventional':
      case 'jumbo':
        return purchasePrice * 0.03; // 3%
      case 'fha':
      case 'usda':
        return purchasePrice * 0.06; // 6%
      case 'va':
        return purchasePrice * 0.04; // 4%
      default:
        return purchasePrice * 0.03; // Default to 3%
    }
  };
  
  // Editable purchase price and down payment - initialize from questionnaire data
  const isFirstTimeBuyer = homeOwnershipHistory === 'no';
  const calculatedMinDownPayment = getMinDownPayment(selectedLoanType, isFirstTimeBuyer);
  
  const [purchasePrice, setPurchasePrice] = useState(defaultValues.purchasePrice || 400000);
  const [downPayment, setDownPayment] = useState((defaultValues.purchasePrice || 400000) * (calculatedMinDownPayment / 100));
  
  const downPaymentPercent = purchasePrice > 0 ? (downPayment / purchasePrice) * 100 : 0;
  const loanAmount = purchasePrice - downPayment;
  const interestRate = 6.75;
  const apr = 6.89;
  
  // Closing cost assistance calculations
  const maxClosingCostAssistance = getMaxClosingCostAssistance(selectedLoanType, purchasePrice);
  const [closingCostAssistanceAmount, setClosingCostAssistanceAmount] = useState([1]);
  
  // Monthly payment components - calculate dynamically
  const calculateMonthlyPayment = (principal: number, annualRate: number, years: number = 30) => {
    if (principal <= 0) return 0;
    const monthlyRate = annualRate / 12;
    const numberOfPayments = years * 12;
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    return Math.round(monthlyPayment);
  };
  
  const principalAndInterest = calculateMonthlyPayment(loanAmount, interestRate / 100);
  const propertyTaxes = 417; // $5,000/year
  const homeownersInsurance = 167; // $2,000/year
  const floodInsurance = defaultValues.floodRequired ? 50 : 0;
  const hoaFees = defaultValues.hoaFees || 0;
  const totalMonthlyPayment = principalAndInterest + propertyTaxes + homeownersInsurance + floodInsurance + hoaFees;
  
  // Cash to close with assistance adjustments
  const estimatedClosingCosts = loanAmount * 0.03; // 3% of loan amount
  const adjustedDownPayment = (downPaymentAssistance && showDownPaymentAssistance) ? 0 : downPayment;
  const adjustedClosingCosts = closingCostAssistance ? Math.max(0, estimatedClosingCosts - closingCostAssistanceAmount[0]) : estimatedClosingCosts;
  const cashToClose = adjustedDownPayment + adjustedClosingCosts;

  // DTI Calculations (using example data from Truv and Plaid)
  const monthlyIncome = 8500; // From Truv integration
  const existingMonthlyDebts = 850; // From Plaid integration
  const totalMonthlyDebts = totalMonthlyPayment + existingMonthlyDebts;
  const dtiRatio = (totalMonthlyDebts / monthlyIncome) * 100;

  // DTI Limits based on loan type
  const loanType = defaultValues.loanType || 'conventional';
  const getDTILimit = (type: string) => {
    switch (type.toLowerCase()) {
      case 'conventional': return 50;
      case 'fha': return 57;
      case 'usda': return 43;
      case 'va': return null; // No limit mentioned for VA
      default: return 50;
    }
  };

  const dtiLimit = getDTILimit(loanType);
  const dtiStatus = dtiLimit ? (dtiRatio <= dtiLimit ? 'good' : 'high') : 'no-limit';

  // Assets Calculations (using example data from Plaid)
  const checkingSavings = 45000; // From Plaid bank accounts
  const investments = 25000; // From Plaid investment accounts  
  const retirement401k = 120000; // From Plaid 401k accounts
  const usable401k = retirement401k * 0.6; // 60% of 401k is usable
  const totalAssets = checkingSavings + investments + usable401k;
  const assetsSufficient = totalAssets >= cashToClose;

  const handleComplete = () => {
    const analysisData = {
      purchasePrice,
      downPayment,
      downPaymentPercent,
      loanAmount,
      interestRate,
      apr,
      monthlyPayment: {
        principalAndInterest,
        propertyTaxes,
        homeownersInsurance,
        floodInsurance,
        hoaFees,
        total: totalMonthlyPayment
      },
      cashToClose,
      estimatedClosingCosts,
      dtiAnalysis: {
        monthlyIncome,
        existingMonthlyDebts,
        totalMonthlyDebts,
        dtiRatio,
        dtiLimit,
        dtiStatus,
        loanType
      },
      assets: {
        checkingSavings,
        investments,
        retirement401k,
        usable401k,
        totalAssets,
        assetsSufficient
      },
      isFirstTimeBuyer,
      calculatedMinDownPayment,
      assistancePrograms: {
        downPaymentAssistance,
        closingCostAssistance,
        closingCostAssistanceAmount: closingCostAssistance ? closingCostAssistanceAmount[0] : 0
      }
    };

    onComplete(analysisData);
  };

  return (
    <div className="space-y-6">
      {/* Reviews Section */}
      <ReviewsSection />
      
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-blue-100 p-3 rounded-full">
            <Calculator className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Step 12: Loan Analysis Summary
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Here's your complete mortgage breakdown based on your application details.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-blue-600" />
              Purchase Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Purchase Price */}
              <div className="flex justify-between items-center">
                <Label htmlFor="purchase-price-input" className="text-lg font-medium text-gray-700">
                  Purchase Price:
                </Label>
                <Input
                  id="purchase-price-input"
                  type="text"
                  value={`$${Math.round(purchasePrice).toLocaleString()}`}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[$,]/g, '');
                    const numValue = Math.round(parseInt(value) || 0);
                    // Maintain the same percentage when purchase price changes
                    const currentPercent = downPaymentPercent;
                    setPurchasePrice(numValue);
                    if (numValue > 0) {
                      const newDownPayment = numValue * (currentPercent / 100);
                      const minDownPaymentAmount = numValue * (calculatedMinDownPayment / 100);
                      setDownPayment(Math.max(newDownPayment, minDownPaymentAmount));
                    }
                  }}
                  className="w-40 text-right text-lg font-semibold border-2 focus:border-blue-500"
                />
              </div>
              
              {/* Down Payment */}
              <div className="flex justify-between items-center">
                <Label htmlFor="down-payment-input" className="text-lg font-medium text-gray-700">
                  Down Payment: ({downPaymentPercent.toFixed(2)}%)
                </Label>
                <Input
                  id="down-payment-input"
                  type="text"
                  value={`$${downPayment.toLocaleString()}`}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[$,]/g, '');
                    const numValue = parseInt(value) || 0;
                    setDownPayment(numValue);
                  }}
                  onBlur={() => {
                    // Auto-correct to minimum percentage if below threshold
                    const minDownPaymentAmount = purchasePrice * (calculatedMinDownPayment / 100);
                    if (downPayment < minDownPaymentAmount) {
                      setDownPayment(minDownPaymentAmount);
                    }
                  }}
                  className="w-40 text-right text-lg font-semibold border-2 focus:border-green-500"
                />
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-600">
                  {calculatedMinDownPayment}% is the minimum for {isFirstTimeBuyer ? 'first time home buyer' : 'repeat home buyer'}
                </p>
              </div>
              
              {/* Loan Amount */}
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium text-gray-700">Loan Amount:</span>
                <span className="text-lg font-semibold text-blue-600">${loanAmount.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Interest Rate & Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500 mb-1">Interest Rate</p>
                <p className="text-2xl font-bold text-gray-900">{interestRate}%</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500 mb-1">APR</p>
                <p className="text-2xl font-bold text-gray-700">{apr}%</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                30-Year Fixed Conventional Loan
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-purple-600" />
              Monthly Mortgage Payment Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Principal & Interest (P&I)</span>
                <span className="font-semibold text-gray-900">${principalAndInterest.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Property Taxes (T)</span>
                <span className="font-semibold text-gray-900">${propertyTaxes.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Homeowners Insurance (I)</span>
                <span className="font-semibold text-gray-900">${homeownersInsurance.toLocaleString()}</span>
              </div>
              {floodInsurance > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Flood Insurance (F)</span>
                    <span className="font-semibold text-gray-900">${floodInsurance.toLocaleString()}</span>
                  </div>
                </>
              )}
              {hoaFees > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">HOA Fees (A)</span>
                    <span className="font-semibold text-gray-900">${hoaFees.toLocaleString()}</span>
                  </div>
                </>
              )}
              <Separator className="border-2" />
              <div className="flex items-center justify-between py-3 bg-gray-50 -mx-6 px-6 rounded-lg">
                <span className="text-lg font-bold text-gray-900">Total Monthly Payment</span>
                <span className="text-2xl font-bold text-blue-600">${totalMonthlyPayment.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              Cash to Close
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Down Payment</span>
                <span className="font-semibold text-gray-900">${adjustedDownPayment.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Estimated Closing Costs</span>
                <span className="font-semibold text-gray-900">${adjustedClosingCosts.toLocaleString()}</span>
              </div>
              
              {/* Assistance Programs */}
              <div className="bg-blue-50 p-4 rounded-lg mt-4 mb-4">
                <h4 className="font-semibold text-blue-800 mb-3">Available Assistance Programs</h4>
                <div className="space-y-3">
                  {showDownPaymentAssistance && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <Checkbox 
                          id="down-payment-assistance"
                          checked={downPaymentAssistance}
                          onCheckedChange={(checked) => setDownPaymentAssistance(checked as boolean)}
                        />
                        <label htmlFor="down-payment-assistance" className="text-sm font-medium text-blue-700 cursor-pointer">
                          Down Payment Assistance Program
                          {downPaymentAssistance && <span className="text-green-600 ml-2">(-${downPayment.toLocaleString()})</span>}
                        </label>
                      </div>
                      {downPaymentAssistance && (
                        <div className="ml-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-amber-800">
                            <strong>Important:</strong> Adding down payment assistance will cause us to reprice your loan and you will not get the same interest rate. Lenders typically charge higher rates and higher fees for down payment assistance.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {showClosingCostAssistance && (
                    <div className="flex items-center space-x-3">
                      <Checkbox 
                        id="closing-cost-assistance"
                        checked={closingCostAssistance}
                        onCheckedChange={(checked) => setClosingCostAssistance(checked as boolean)}
                      />
                      <label htmlFor="closing-cost-assistance" className="text-sm font-medium text-blue-700 cursor-pointer">
                        Closing Cost Assistance Program
                        {closingCostAssistance && <span className="text-green-600 ml-2">(-${Math.round(closingCostAssistanceAmount[0]).toLocaleString()})</span>}
                      </label>
                    </div>
                  )}
                </div>
                
                {/* Closing Cost Assistance Slider */}
                {closingCostAssistance && showClosingCostAssistance && (
                  <div className="mt-4 p-3 bg-white border border-blue-200 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-blue-800">
                        Assistance Amount
                      </span>
                      <span className="text-sm font-bold text-green-600">
                        ${Math.round(closingCostAssistanceAmount[0]).toLocaleString()}
                      </span>
                    </div>
                    <Slider
                      value={closingCostAssistanceAmount}
                      onValueChange={setClosingCostAssistanceAmount}
                      max={maxClosingCostAssistance}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-blue-600 mt-1">
                      <span>$1</span>
                      <span className="text-center">
                        Max: {(maxClosingCostAssistance / purchasePrice * 100).toFixed(0)}% of purchase price
                      </span>
                      <span>${Math.round(maxClosingCostAssistance).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-blue-600 mt-2">
                  Check the programs you'd like to explore. Our team will verify eligibility and provide details.
                </p>
              </div>
              
              <Separator className="border-2" />
              <div className="flex items-center justify-between py-3 bg-gray-50 -mx-6 px-6 rounded-lg">
                <span className="text-lg font-bold text-gray-900">Total Cash to Close</span>
                <span className="text-2xl font-bold text-orange-600">${cashToClose.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Closing costs are estimated and may vary based on final loan terms, 
                title insurance, attorney fees, and other settlement costs. Your loan officer will provide 
                a detailed Loan Estimate within 3 business days.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-indigo-600" />
              Debt-to-Income Ratios
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Monthly Income (Truv Verified)</span>
                <span className="font-semibold text-gray-900">${monthlyIncome.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Existing Monthly Debts (Plaid)</span>
                <span className="font-semibold text-gray-900">${existingMonthlyDebts.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">New Housing Payment</span>
                <span className="font-semibold text-gray-900">${totalMonthlyPayment.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Total Monthly Debts</span>
                <span className="font-semibold text-gray-900">${totalMonthlyDebts.toLocaleString()}</span>
              </div>
              <Separator className="border-2" />
              <div className={`flex items-center justify-between py-3 px-4 rounded-lg ${
                dtiStatus === 'good' ? 'bg-green-50' : 
                dtiStatus === 'high' ? 'bg-red-50' : 'bg-blue-50'
              }`}>
                <span className="text-lg font-bold text-gray-900">Debt-to-Income Ratio</span>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${
                    dtiStatus === 'good' ? 'text-green-600' : 
                    dtiStatus === 'high' ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {dtiRatio.toFixed(1)}%
                  </span>
                  {dtiLimit && (
                    <div className={`text-sm ${
                      dtiStatus === 'good' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {dtiStatus === 'good' ? '✓' : '⚠'} {loanType.toUpperCase()} limit: {dtiLimit}%
                    </div>
                  )}
                  {loanType.toLowerCase() === 'va' && (
                    <div className="text-sm text-blue-700">
                      VA loans have flexible DTI requirements
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Assets & Cash to Close
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Checking & Savings (Plaid)</span>
                <span className="font-semibold text-gray-900">${checkingSavings.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Investment Accounts (Plaid)</span>
                <span className="font-semibold text-gray-900">${investments.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">401(k) Available (60%)</span>
                <span className="font-semibold text-gray-900">${usable401k.toLocaleString()}</span>
              </div>
              <Separator className="border-2" />
              <div className="flex items-center justify-between py-3 bg-gray-50 -mx-6 px-6 rounded-lg">
                <span className="text-lg font-bold text-gray-900">Total Available Assets</span>
                <span className="text-2xl font-bold text-gray-900">${totalAssets.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Required Cash to Close</span>
                <span className="font-semibold text-gray-900">${cashToClose.toLocaleString()}</span>
              </div>
              <Separator className="border-2" />
              <div className={`flex items-center justify-between py-3 px-4 rounded-lg ${
                assetsSufficient ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <span className="text-lg font-bold text-gray-900">Asset Coverage</span>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${
                    assetsSufficient ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {assetsSufficient ? '✓ Sufficient' : '⚠ Insufficient'}
                  </span>
                  <div className={`text-sm ${
                    assetsSufficient ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {assetsSufficient 
                      ? `$${(totalAssets - cashToClose).toLocaleString()} remaining after closing`
                      : `$${(cashToClose - totalAssets).toLocaleString()} shortfall`
                    }
                  </div>
                </div>
              </div>
              {!assetsSufficient && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-semibold text-red-800 mb-2">Recommended Solutions:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• Request a gift from family members or close friends</li>
                    <li>• Negotiate seller concessions to reduce cash to close</li>
                    <li>• Consider a lower down payment option if available</li>
                    <li>• Explore down payment assistance programs</li>
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
            <div>
              <h3 className="font-semibold text-green-800 mb-2">Congratulations!</h3>
              <p className="text-green-700">
                You've completed your mortgage application questionnaire. Our team will review your 
                information and contact you within 24 hours to discuss next steps and finalize your loan.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1"
          >
            Back to Previous Step
          </Button>
          <Button
            onClick={handleComplete}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            Complete Application
          </Button>
        </div>
      </div>
    </div>
  );
}