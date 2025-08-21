import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, DollarSign, Home, Calculator, FileText } from "lucide-react";

interface LoanAnalysisProps {
  defaultValues: any;
  onComplete: (data: any) => void;
  onBack: () => void;
}

export function LoanAnalysis({ defaultValues, onComplete, onBack }: LoanAnalysisProps) {
  // Example data for $400K home with 5% down conventional loan
  const purchasePrice = 400000;
  const downPaymentPercent = 5;
  const downPayment = purchasePrice * (downPaymentPercent / 100);
  const loanAmount = purchasePrice - downPayment;
  const interestRate = 6.75;
  const apr = 6.89;
  
  // Monthly payment components
  const principalAndInterest = 2534;
  const propertyTaxes = 417; // $5,000/year
  const homeownersInsurance = 167; // $2,000/year
  const floodInsurance = defaultValues.floodRequired ? 50 : 0;
  const hoaFees = defaultValues.hoaFees || 0;
  const totalMonthlyPayment = principalAndInterest + propertyTaxes + homeownersInsurance + floodInsurance + hoaFees;
  
  // Cash to close
  const estimatedClosingCosts = 8500; // Typical 2-3% of loan amount
  const cashToClose = downPayment + estimatedClosingCosts;

  const handleComplete = () => {
    const analysisData = {
      purchasePrice,
      downPayment,
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
      estimatedClosingCosts
    };

    onComplete(analysisData);
  };

  return (
    <div className="space-y-6">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500 mb-1">Purchase Price</p>
                <p className="text-2xl font-bold text-gray-900">${purchasePrice.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500 mb-1">Down Payment ({downPaymentPercent}%)</p>
                <p className="text-2xl font-bold text-green-600">${downPayment.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500 mb-1">Loan Amount</p>
                <p className="text-2xl font-bold text-blue-600">${loanAmount.toLocaleString()}</p>
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
                <span className="font-semibold text-gray-900">${downPayment.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">Estimated Closing Costs</span>
                <span className="font-semibold text-gray-900">${estimatedClosingCosts.toLocaleString()}</span>
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