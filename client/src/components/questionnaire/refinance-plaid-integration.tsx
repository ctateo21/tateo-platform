import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, CreditCard, Landmark, Shield, CheckCircle, DollarSign } from 'lucide-react';
import { ReviewsSection } from './reviews-section';

interface RefinancePlaidIntegrationProps {
  onComplete: (data: any) => void;
  onBack: () => void;
  defaultValues?: any;
  refinanceType?: string;
}

export function RefinancePlaidIntegration({ 
  onComplete, 
  onBack, 
  defaultValues = {},
  refinanceType = 'rate-term'
}: RefinancePlaidIntegrationProps) {
  const [connected, setConnected] = useState(false);
  const [selectedDebts, setSelectedDebts] = useState<string[]>(defaultValues.selectedDebts || []);

  // Simulated debt data from Plaid
  const debtAccounts = [
    { id: 'cc1', name: 'Chase Sapphire', balance: 8500, payment: 255, type: 'Credit Card' },
    { id: 'cc2', name: 'Capital One', balance: 3200, payment: 95, type: 'Credit Card' },
    { id: 'auto', name: 'Toyota Camry Loan', balance: 18500, payment: 425, type: 'Auto Loan' },
    { id: 'student', name: 'Federal Student Loan', balance: 12000, payment: 150, type: 'Student Loan' },
    { id: 'personal', name: 'Personal Loan', balance: 5500, payment: 180, type: 'Personal Loan' }
  ];

  const isCashOut = refinanceType === 'cash-out';
  const totalSelectedBalance = selectedDebts.reduce((sum, debtId) => {
    const debt = debtAccounts.find(d => d.id === debtId);
    return sum + (debt?.balance || 0);
  }, 0);

  const totalSelectedPayments = selectedDebts.reduce((sum, debtId) => {
    const debt = debtAccounts.find(d => d.id === debtId);
    return sum + (debt?.payment || 0);
  }, 0);

  const handleConnect = () => {
    setConnected(true);
  };

  const handleDebtToggle = (debtId: string) => {
    setSelectedDebts(prev => 
      prev.includes(debtId) 
        ? prev.filter(id => id !== debtId)
        : [...prev, debtId]
    );
  };

  const handleContinue = () => {
    // Calculate new loan amount based on original loan balance + selected debts + closing costs
    const originalLoanBalance = parseFloat(defaultValues.currentLoanBalance?.replace(/[$,]/g, '') || '250000');
    const closingCosts = 8000; // Estimated closing costs
    const newLoanAmount = originalLoanBalance + totalSelectedBalance + closingCosts;
    
    const data = {
      plaidConnected: connected,
      bankVerified: true,
      assetDocumentation: 'verified',
      selectedDebts: isCashOut ? selectedDebts : [],
      totalDebtPayoff: isCashOut ? totalSelectedBalance : 0,
      monthlyDebtReduction: isCashOut ? totalSelectedPayments : 0,
      // Add calculated loan amounts
      originalLoanBalance,
      closingCosts,
      newLoanAmount,
      cashOutAmount: newLoanAmount - originalLoanBalance // Total cash-out including debt payoff + closing costs
    };
    
    onComplete(data);
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Bank Account Verification</h1>
                <p className="text-gray-600">Securely connect your accounts for instant verification</p>
                <div className="mt-4 text-sm text-blue-600 bg-blue-50 rounded-lg p-3">
                  Step 10 of 12 - Refinance Application
                </div>
              </div>
            </div>

            <Card className="mb-6">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Shield className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">Connect with Plaid</CardTitle>
                <CardDescription className="text-gray-600">
                  Instantly verify your assets and streamline your refinance application
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <Landmark className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-green-800">Bank Accounts</h3>
                      <p className="text-sm text-green-700">Checking & Savings</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <CreditCard className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-blue-800">Credit Accounts</h3>
                      <p className="text-sm text-blue-700">Cards & Loans</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <DollarSign className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-purple-800">Investments</h3>
                      <p className="text-sm text-purple-700">401(k) & Brokerage</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Why connect your accounts?</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>• Instant asset verification - no need to upload statements</li>
                      <li>• Accurate debt-to-income calculations</li>
                      {isCashOut && <li>• Select debts to pay off with your cash-out refinance</li>}
                      <li>• Faster loan processing and approval</li>
                      <li>• Bank-level security with 256-bit encryption</li>
                    </ul>
                  </div>

                  <div className="text-center">
                    <Button
                      onClick={handleConnect}
                      size="lg"
                      className="px-8 py-4 text-lg bg-blue-600 hover:bg-blue-700"
                    >
                      <Shield className="mr-2 h-5 w-5" />
                      Connect Securely with Plaid
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">
                      Your credentials are never stored. Plaid uses bank-level security.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reviews Section */}
            <ReviewsSection />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Assets & Debts Verified</h1>
              <p className="text-gray-600">Your accounts have been successfully connected</p>
              <div className="mt-4 text-sm text-blue-600 bg-blue-50 rounded-lg p-3 inline-block">
                Step 10 of 12 - Refinance Application
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Assets Summary */}
            <Card>
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  Verified Assets
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Checking Accounts</span>
                    <span className="font-semibold">$45,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Savings Accounts</span>
                    <span className="font-semibold">$28,500</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Investment Accounts</span>
                    <span className="font-semibold">$25,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>401(k) Balance</span>
                    <span className="font-semibold">$120,000</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Verified Assets</span>
                    <span className="text-green-600">$218,500</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Debts Summary */}
            <Card>
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <CreditCard className="h-5 w-5" />
                  Current Debts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {debtAccounts.map(debt => (
                    <div key={debt.id} className="flex justify-between text-sm">
                      <div>
                        <div className="font-medium">{debt.name}</div>
                        <div className="text-gray-500">{debt.type}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${debt.balance.toLocaleString()}</div>
                        <div className="text-gray-500">${debt.payment}/mo</div>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total Monthly Payments</span>
                    <span>${debtAccounts.reduce((sum, debt) => sum + debt.payment, 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cash-Out Debt Selection */}
          {isCashOut && (
            <Card className="mb-6">
              <CardHeader className="bg-orange-50">
                <CardTitle className="text-orange-800">Select Debts to Pay Off</CardTitle>
                <CardDescription>
                  Choose which debts you'd like to pay off with your cash-out refinance.
                  Selected debts will be removed from your DTI calculation.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {debtAccounts.map(debt => (
                    <div key={debt.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                      <Checkbox
                        id={debt.id}
                        checked={selectedDebts.includes(debt.id)}
                        onCheckedChange={() => handleDebtToggle(debt.id)}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <div>
                            <label htmlFor={debt.id} className="font-medium cursor-pointer">
                              {debt.name}
                            </label>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {debt.type}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">${debt.balance.toLocaleString()}</div>
                            <div className="text-sm text-gray-500">${debt.payment}/mo payment</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedDebts.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-800 mb-2">Loan Amount Update</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blue-700">Original Loan Balance:</span>
                          <span className="font-bold text-blue-900">
                            ${parseFloat(defaultValues.currentLoanBalance?.replace(/[$,]/g, '') || '250000').toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Debts to Pay Off:</span>
                          <span className="font-bold text-blue-900">+${totalSelectedBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Estimated Closing Costs:</span>
                          <span className="font-bold text-blue-900">+$8,000</span>
                        </div>
                        <div className="border-t border-blue-200 pt-2">
                          <div className="flex justify-between">
                            <span className="font-semibold text-blue-800">New Loan Amount:</span>
                            <span className="font-bold text-lg text-blue-900">
                              ${(parseFloat(defaultValues.currentLoanBalance?.replace(/[$,]/g, '') || '250000') + totalSelectedBalance + 8000).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="text-blue-700">Monthly Payment Reduction:</span>
                          <div className="font-bold text-green-600">${totalSelectedPayments}/month saved</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={onBack}
              size="lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <Button
              onClick={handleContinue}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              Continue to Property Details
            </Button>
          </div>

          {/* Reviews Section */}
          <ReviewsSection />
        </div>
      </div>
    </div>
  );
}