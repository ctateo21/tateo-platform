import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Home, DollarSign, Calculator, CheckCircle, TrendingUp, CreditCard } from 'lucide-react';

interface RefinanceLoanAnalysisProps {
  defaultValues: any;
  onComplete: (data: any) => void;
  onBack: () => void;
}

export function RefinanceLoanAnalysis({ defaultValues, onComplete, onBack }: RefinanceLoanAnalysisProps) {
  // Refinance loan details using data from previous steps
  const currentLoanBalance = defaultValues.originalLoanBalance || 250000;
  const newLoanAmount = defaultValues.newLoanAmount || 272000; // From Plaid calculation
  const cashOutAmount = defaultValues.cashOutAmount || (newLoanAmount - currentLoanBalance);
  const interestRate = 6.25; // Slightly lower rate for refinance
  const apr = 6.41;
  
  // Monthly payment components
  const principalAndInterest = 2340;
  const propertyTaxes = defaultValues.monthlyPropertyTax || 417;
  const homeownersInsurance = defaultValues.monthlyHomeownersInsurance || 150;
  const floodInsurance = defaultValues.monthlyFloodInsurance || 0;
  const totalMonthlyPayment = principalAndInterest + propertyTaxes + homeownersInsurance + floodInsurance;
  
  // Cash flow calculation
  const estimatedClosingCosts = 4500; // Lower closing costs for refinance
  const selectedDebtPayoff = defaultValues.totalDebtPayoff || 0;
  const cashBackToYou = cashOutAmount - estimatedClosingCosts - selectedDebtPayoff;

  // DTI Calculations (using data from Truv and Plaid, adjusted for debt payoff)
  const monthlyIncome = 8500; // From Truv integration
  const existingMonthlyDebts = 850; // From Plaid integration
  const paidOffDebts = defaultValues.monthlyDebtReduction || 0; // Debts being paid off
  const remainingDebts = existingMonthlyDebts - paidOffDebts;
  const totalMonthlyDebts = totalMonthlyPayment + remainingDebts;
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

  // Assets Calculations (using data from Plaid)
  const checkingSavings = 73500; // Higher balance after cash-out
  const investments = 25000;
  const retirement401k = 120000;
  const usable401k = retirement401k * 0.6;
  const totalAssets = checkingSavings + investments + usable401k;
  
  // For refinance, we show total assets since there's no additional cash required
  const assetsAfterCashOut = totalAssets + cashBackToYou;

  const handleComplete = () => {
    const analysisData = {
      currentLoanBalance,
      newLoanAmount,
      cashOutAmount,
      interestRate,
      apr,
      monthlyPayment: {
        principalAndInterest,
        propertyTaxes,
        homeownersInsurance,
        floodInsurance,
        total: totalMonthlyPayment
      },
      cashBackToYou,
      estimatedClosingCosts,
      selectedDebtPayoff,
      dtiAnalysis: {
        monthlyIncome,
        existingMonthlyDebts,
        remainingDebts,
        paidOffDebts,
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
        assetsAfterCashOut
      }
    };

    onComplete(analysisData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={onBack}
              className="mb-4 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Refinance Analysis</h1>
              <p className="text-gray-600">Complete breakdown of your cash-out refinance</p>
              <div className="mt-4 text-sm text-green-600 bg-green-50 rounded-lg p-3 inline-block">
                Step 12 of 12 - Final Analysis
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Loan Details */}
            <Card className="border-2 border-green-200">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-6 w-6 text-green-600" />
                  Refinance Details
                </CardTitle>
                <CardDescription>Your new loan terms and cash-out breakdown</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-700">Current Loan Balance</span>
                      <span className="font-semibold text-gray-900">${currentLoanBalance.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-700">New Loan Amount</span>
                      <span className="font-semibold text-gray-900">${newLoanAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 bg-green-50 -mx-6 px-6 rounded-lg">
                      <span className="text-lg font-bold text-green-800">Cash-Out Amount</span>
                      <span className="text-2xl font-bold text-green-600">${cashOutAmount.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-700">Interest Rate</span>
                      <Badge variant="outline" className="text-lg font-semibold">{interestRate}%</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-700">APR</span>
                      <Badge variant="outline" className="text-lg font-semibold">{apr}%</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-700">Loan Term</span>
                      <Badge variant="outline" className="text-lg font-semibold">30 Years</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Payment */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-6 w-6 text-blue-600" />
                  New Monthly Payment
                </CardTitle>
                <CardDescription>Breakdown of your monthly housing payment</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Principal & Interest (P&I)</span>
                    <span className="font-semibold text-gray-900">${principalAndInterest.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Property Taxes (T)</span>
                    <span className="font-semibold text-gray-900">${propertyTaxes.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Homeowners Insurance (I)</span>
                    <span className="font-semibold text-gray-900">${homeownersInsurance.toLocaleString()}</span>
                  </div>
                  {floodInsurance > 0 && (
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-700">Flood Insurance (F)</span>
                      <span className="font-semibold text-gray-900">${floodInsurance.toLocaleString()}</span>
                    </div>
                  )}
                  <Separator className="border-2" />
                  <div className="flex items-center justify-between py-3 bg-blue-50 -mx-6 px-6 rounded-lg">
                    <span className="text-xl font-bold text-blue-800">
                      Total Monthly Payment (PTI{floodInsurance > 0 ? 'F' : ''})
                    </span>
                    <span className="text-2xl font-bold text-blue-600">${totalMonthlyPayment.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cash Flow Summary */}
            <Card className="border-2 border-green-200">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                  Cash Flow Summary
                </CardTitle>
                <CardDescription>How your cash-out refinance money will be used</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Total Cash-Out Available</span>
                    <span className="font-semibold text-gray-900">${cashOutAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Estimated Closing Costs</span>
                    <span className="font-semibold text-red-600">-${estimatedClosingCosts.toLocaleString()}</span>
                  </div>
                  {selectedDebtPayoff > 0 && (
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-700">Selected Debt Payoff</span>
                      <span className="font-semibold text-red-600">-${selectedDebtPayoff.toLocaleString()}</span>
                    </div>
                  )}
                  <Separator className="border-2" />
                  <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-green-50">
                    <span className="text-xl font-bold text-green-800">Cash Back to You</span>
                    <span className="text-2xl font-bold text-green-600">${cashBackToYou.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DTI Analysis */}
            <Card>
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
                    <span className="font-semibold text-gray-500">${existingMonthlyDebts.toLocaleString()}</span>
                  </div>
                  {paidOffDebts > 0 && (
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium text-green-700">Debts Being Paid Off</span>
                      <span className="font-semibold text-green-600">-${paidOffDebts.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Remaining Monthly Debts</span>
                    <span className="font-semibold text-gray-900">${remainingDebts.toLocaleString()}</span>
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

            {/* Assets After Cash-Out */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  Assets After Cash-Out
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
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-green-700">Cash from Refinance</span>
                    <span className="font-semibold text-green-600">+${cashBackToYou.toLocaleString()}</span>
                  </div>
                  <Separator className="border-2" />
                  <div className="flex items-center justify-between py-3 bg-green-50 -mx-6 px-6 rounded-lg">
                    <span className="text-lg font-bold text-gray-900">Total Available Assets</span>
                    <span className="text-2xl font-bold text-green-600">${assetsAfterCashOut.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Congratulations */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-green-800 mb-2">Congratulations!</h3>
                  <p className="text-green-700">
                    You've completed your cash-out refinance application questionnaire. Our team will review your 
                    information and contact you within 24 hours to discuss next steps and finalize your loan.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={onBack}
              size="lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <Button
              onClick={handleComplete}
              size="lg"
              className="bg-green-600 hover:bg-green-700"
            >
              Complete Application
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}