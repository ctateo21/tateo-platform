import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Home, DollarSign, Calculator } from 'lucide-react';

interface RefinanceLoanAnalysisProps {
  defaultValues: any;
  onComplete: (data: any) => void;
  onBack: () => void;
}

export function RefinanceLoanAnalysis({ defaultValues, onComplete, onBack }: RefinanceLoanAnalysisProps) {
  const [additionalCashOut, setAdditionalCashOut] = useState('');
  
  // Refinance loan details using data from previous steps
  const currentLoanBalance = defaultValues.originalLoanBalance || 250000;
  const debtsToBePaidOff = defaultValues.totalDebtPayoff || 0;
  const additionalCashOutAmount = parseFloat(additionalCashOut.replace(/[$,]/g, '') || '0');
  const estimatedClosingCosts = defaultValues.closingCosts || 8000;
  
  // Calculate new loan amount
  const newLoanAmount = currentLoanBalance + debtsToBePaidOff + additionalCashOutAmount + estimatedClosingCosts;
  
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
  
  // Format currency input
  const handleCashOutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    const formattedValue = value ? `$${parseInt(value).toLocaleString()}` : '';
    setAdditionalCashOut(formattedValue);
  };

  const handleComplete = () => {
    const analysisData = {
      currentLoanBalance,
      newLoanAmount,
      debtsToBePaidOff,
      additionalCashOutAmount,
      estimatedClosingCosts,
      interestRate,
      apr,
      monthlyPayment: {
        principalAndInterest,
        propertyTaxes,
        homeownersInsurance,
        floodInsurance,
        total: totalMonthlyPayment
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
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-600">Interest Rate</div>
                      <Badge variant="outline" className="text-lg font-semibold">{interestRate}%</Badge>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600">APR</div>
                      <Badge variant="outline" className="text-lg font-semibold">{apr}%</Badge>
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
          </div>
        </div>
      </div>
    </div>
  );
}