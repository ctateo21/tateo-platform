import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Home, DollarSign, Calculator, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { ReviewsSection } from './reviews-section';

interface RefinanceLoanAnalysisProps {
  defaultValues: any;
  onComplete: (data: any) => void;
  onBack: () => void;
}

export function RefinanceLoanAnalysis({ defaultValues, onComplete, onBack }: RefinanceLoanAnalysisProps) {
  const [additionalCashOut, setAdditionalCashOut] = useState('');
  const [showLtvWarning, setShowLtvWarning] = useState(false);
  
  // Refinance loan details using data from previous steps
  const homeValue = defaultValues.homeValue || defaultValues.propertyValue || 350000; // From address lookup
  const currentLoanBalance = defaultValues.originalLoanBalance || 250000;
  const debtsToBePaidOff = defaultValues.totalDebtPayoff || 0;
  const additionalCashOutAmount = parseFloat(additionalCashOut.replace(/[$,]/g, '') || '0');
  const estimatedClosingCosts = defaultValues.closingCosts || 8000;
  
  // Calculate new loan amount and LTV
  const newLoanAmount = currentLoanBalance + debtsToBePaidOff + additionalCashOutAmount + estimatedClosingCosts;
  const ltvRatio = (newLoanAmount / homeValue) * 100;
  
  const interestRate = 6.25; // Slightly lower rate for refinance
  const apr = 6.41;
  
  // Calculate monthly payment based on new loan amount
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = 30 * 12; // 30 years
  const principalAndInterest = newLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const propertyTaxes = defaultValues.monthlyPropertyTax || 417;
  const homeownersInsurance = defaultValues.monthlyHomeownersInsurance || 150;
  const floodInsurance = defaultValues.monthlyFloodInsurance || 0;
  const totalMonthlyPayment = principalAndInterest + propertyTaxes + homeownersInsurance + floodInsurance;
  
  // DTI Calculations (using data from previous steps, adjusted for debt payoff)
  const monthlyIncome = 8500; // From income verification
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
      case 'va': return null; // No strict limit for VA
      default: return 50;
    }
  };

  const dtiLimit = getDTILimit(loanType);
  const dtiStatus = dtiLimit ? (dtiRatio <= dtiLimit ? 'good' : 'high') : 'no-limit';
  
  // Calculate maximum cash-out to maintain 80% LTV
  const maxLoanAmountFor80LTV = homeValue * 0.8;
  const maxCashOut = maxLoanAmountFor80LTV - currentLoanBalance - debtsToBePaidOff - estimatedClosingCosts;
  
  // Format currency input with LTV validation
  const handleCashOutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    const numericValue = parseInt(value) || 0;
    
    // Check if this would exceed 80% LTV
    const proposedLoanAmount = currentLoanBalance + debtsToBePaidOff + numericValue + estimatedClosingCosts;
    const proposedLTV = (proposedLoanAmount / homeValue) * 100;
    
    if (proposedLTV > 80) {
      setShowLtvWarning(true);
      // Set to maximum allowed amount
      const maxAllowed = Math.max(0, maxCashOut);
      const formattedValue = maxAllowed > 0 ? `$${maxAllowed.toLocaleString()}` : '';
      setAdditionalCashOut(formattedValue);
    } else {
      setShowLtvWarning(false);
      const formattedValue = value ? `$${numericValue.toLocaleString()}` : '';
      setAdditionalCashOut(formattedValue);
    }
  };
  
  // Hide warning after 5 seconds
  useEffect(() => {
    if (showLtvWarning) {
      const timer = setTimeout(() => setShowLtvWarning(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showLtvWarning]);

  const handleComplete = () => {
    const analysisData = {
      homeValue,
      currentLoanBalance,
      newLoanAmount,
      debtsToBePaidOff,
      additionalCashOutAmount,
      estimatedClosingCosts,
      interestRate,
      apr,
      ltvRatio,
      monthlyPayment: {
        principalAndInterest,
        propertyTaxes,
        homeownersInsurance,
        floodInsurance,
        total: totalMonthlyPayment
      },
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
      additionalCashOut
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
                Step 14 of 14 - Final Analysis
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* LTV Warning */}
            {showLtvWarning && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Maximum LTV Exceeded:</strong> Cash-out refinances have a maximum loan-to-value ratio of 80%. 
                  Your additional cash-out has been adjusted to ${maxCashOut > 0 ? maxCashOut.toLocaleString() : '0'} 
                  to stay within this limit.
                </AlertDescription>
              </Alert>
            )}

            {/* Refinance Details */}
            <Card className="border-2 border-green-200">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-6 w-6 text-green-600" />
                  Refinance Details
                </CardTitle>
                <CardDescription>Your loan calculation breakdown</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Home Value</span>
                    <span className="font-semibold text-gray-900">${homeValue.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Current Loan Balance</span>
                    <span className="font-semibold text-gray-900">${currentLoanBalance.toLocaleString()}</span>
                  </div>
                  
                  {debtsToBePaidOff > 0 && (
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-700">Debt to be Paid Off</span>
                      <span className="font-semibold text-gray-900">+${debtsToBePaidOff.toLocaleString()}</span>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <Label htmlFor="additionalCashOut">Additional Cash Out</Label>
                    <Input
                      id="additionalCashOut"
                      value={additionalCashOut}
                      onChange={handleCashOutChange}
                      placeholder="$0"
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Estimated Closing Costs</span>
                    <span className="font-semibold text-gray-900">+${estimatedClosingCosts.toLocaleString()}</span>
                  </div>
                  
                  <Separator className="border-2" />
                  
                  <div className="flex items-center justify-between py-3 bg-green-50 -mx-6 px-6 rounded-lg">
                    <span className="text-2xl font-bold text-green-800">New Loan Amount</span>
                    <span className="text-3xl font-bold text-green-600">${newLoanAmount.toLocaleString()}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-600">Interest Rate</div>
                      <Badge variant="outline" className="text-lg font-semibold">{interestRate}%</Badge>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600">APR</div>
                      <Badge variant="outline" className="text-lg font-semibold">{apr}%</Badge>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600">Loan-to-Value (LTV)</div>
                      <Badge variant="outline" className={`text-lg font-bold ${ltvRatio <= 80 ? 'text-green-600 border-green-300' : ltvRatio <= 90 ? 'text-yellow-600 border-yellow-300' : 'text-red-600 border-red-300'}`}>
                        {ltvRatio.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  
                  {ltvRatio > 78 && (
                    <div className="mt-3 text-center">
                      <div className="text-xs text-gray-500">
                        ${newLoanAmount.toLocaleString()} ÷ ${homeValue.toLocaleString()} = {ltvRatio.toFixed(1)}% LTV
                      </div>
                    </div>
                  )}
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
                    <span className="font-semibold text-gray-900">${principalAndInterest.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Property Taxes (T)</span>
                    <span className="font-semibold text-gray-900">${propertyTaxes.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="font-medium text-gray-700">Homeowners Insurance (I)</span>
                    <span className="font-semibold text-gray-900">${homeownersInsurance.toFixed(2)}</span>
                  </div>
                  {floodInsurance > 0 && (
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium text-gray-700">Flood Insurance (F)</span>
                      <span className="font-semibold text-gray-900">${floodInsurance.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator className="border-2" />
                  <div className="flex items-center justify-between py-3 bg-blue-50 -mx-6 px-6 rounded-lg">
                    <span className="text-xl font-bold text-blue-800">
                      Total Monthly Payment (PTI{floodInsurance > 0 ? 'F' : ''})
                    </span>
                    <span className="text-2xl font-bold text-blue-600">${totalMonthlyPayment.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DTI Analysis */}
            <Card className={`border-2 ${dtiStatus === 'good' ? 'border-green-200' : dtiStatus === 'high' ? 'border-red-200' : 'border-blue-200'}`}>
              <CardHeader className={`${dtiStatus === 'good' ? 'bg-gradient-to-r from-green-50 to-emerald-50' : dtiStatus === 'high' ? 'bg-gradient-to-r from-red-50 to-pink-50' : 'bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
                <CardTitle className={`flex items-center gap-2 ${dtiStatus === 'good' ? 'text-green-800' : dtiStatus === 'high' ? 'text-red-800' : 'text-blue-800'}`}>
                  {dtiStatus === 'good' ? <CheckCircle className="h-6 w-6 text-green-600" /> : 
                   dtiStatus === 'high' ? <AlertTriangle className="h-6 w-6 text-red-600" /> :
                   <CheckCircle className="h-6 w-6 text-blue-600" />}
                  Debt-to-Income Analysis
                </CardTitle>
                <CardDescription>
                  {dtiStatus === 'good' ? '✅ You qualify for this loan program' :
                   dtiStatus === 'high' ? '⚠️ DTI ratio exceeds program guidelines' :
                   '✅ No DTI restrictions for this loan program'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Monthly Income:</span>
                      <span className="font-semibold">${monthlyIncome.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">New Housing Payment:</span>
                      <span className="font-semibold">${totalMonthlyPayment.toFixed(2)}</span>
                    </div>
                    {paidOffDebts > 0 && (
                      <div className="flex justify-between text-green-700">
                        <span>Monthly Debts Paid Off:</span>
                        <span className="font-semibold">-${paidOffDebts.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-700">Remaining Monthly Debts:</span>
                      <span className="font-semibold">${remainingDebts.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className={`text-center p-4 rounded-lg ${dtiStatus === 'good' ? 'bg-green-50 border border-green-200' : dtiStatus === 'high' ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
                      <div className="text-sm text-gray-600 mb-1">Your DTI Ratio</div>
                      <div className={`text-3xl font-bold ${dtiStatus === 'good' ? 'text-green-600' : dtiStatus === 'high' ? 'text-red-600' : 'text-blue-600'}`}>
                        {dtiRatio.toFixed(1)}%
                      </div>
                      {dtiLimit && (
                        <div className="text-sm text-gray-500 mt-1">
                          Limit: {dtiLimit}% ({loanType.toUpperCase()})
                        </div>
                      )}
                      {!dtiLimit && loanType.toLowerCase() === 'va' && (
                        <div className="text-sm text-gray-500 mt-1">
                          VA loans have flexible DTI requirements
                        </div>
                      )}
                    </div>
                    
                    {dtiStatus === 'high' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="font-semibold text-red-800 mb-2">Recommendations:</h4>
                        <ul className="text-sm text-red-700 space-y-1">
                          <li>• Consider selecting more debts to pay off</li>
                          <li>• Explore income documentation options</li>
                          <li>• Consider alternative loan programs</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-6">
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
                className="bg-green-600 hover:bg-green-700 text-white px-8"
              >
                Complete Analysis
              </Button>
            </div>

            {/* Reviews Section */}
            <ReviewsSection />
          </div>
        </div>
      </div>
    </div>
  );
}