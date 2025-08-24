import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, FileText, Shield, Upload, CheckCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { ReviewsSection } from './reviews-section';

interface RefinancePropertyTaxesInsuranceProps {
  onComplete: (data: any) => void;
  onBack: () => void;
  defaultValues?: any;
  propertyAddress?: string;
  propertyZipCode?: string;
  salePrice?: number;
  isVADisabled?: boolean;
}

export function RefinancePropertyTaxesInsurance({ 
  onComplete, 
  onBack, 
  defaultValues = {},
  propertyAddress,
  propertyZipCode,
  salePrice = 400000,
  isVADisabled = false
}: RefinancePropertyTaxesInsuranceProps) {
  const [currentTaxAmount, setCurrentTaxAmount] = useState(defaultValues.currentTaxAmount || '');
  const [taxBillConnected, setTaxBillConnected] = useState(defaultValues.taxBillConnected || false);
  const [canopyConnected, setCanopyConnected] = useState(defaultValues.canopyConnected || false);
  const [currentInsuranceAmount, setCurrentInsuranceAmount] = useState(defaultValues.currentInsuranceAmount || '');
  const [floodAmount, setFloodAmount] = useState(defaultValues.floodAmount || '');
  const [isVADisabledExempt, setIsVADisabledExempt] = useState(isVADisabled || false);

  const handleTaxBillConnect = () => {
    // Simulate connecting to tax assessment website
    setTaxBillConnected(true);
    setCurrentTaxAmount('5000'); // Simulated current tax amount
  };

  const handleCanopyConnect = () => {
    // Simulate connecting to CanopyConnect for insurance
    setCanopyConnected(true);
    setCurrentInsuranceAmount('1800'); // Simulated current insurance amount
  };



  const handleContinue = () => {
    const annualTax = parseFloat(currentTaxAmount.replace(/[$,]/g, '') || '5000'); // Default placeholder
    const annualInsurance = parseFloat(currentInsuranceAmount.replace(/[$,]/g, '') || '1800'); // Default placeholder
    const annualFlood = parseFloat(floodAmount.replace(/[$,]/g, '') || '0');
    
    // Calculate monthly amounts
    const monthlyTax = isVADisabledExempt ? 0 : annualTax / 12;
    const monthlyInsurance = annualInsurance / 12;
    const monthlyFlood = annualFlood / 12;
    
    const data = {
      // Property taxes
      currentTaxAmount: currentTaxAmount || '5000',
      taxBillConnected: taxBillConnected || true, // Allow placeholder
      annualPropertyTax: annualTax,
      monthlyPropertyTax: monthlyTax,
      isVADisabledExempt,
      
      // Insurance
      canopyConnected: canopyConnected || true, // Allow placeholder
      currentInsuranceAmount: currentInsuranceAmount || '1800',
      annualHomeownersInsurance: annualInsurance,
      monthlyHomeownersInsurance: monthlyInsurance,
      
      // Flood insurance
      floodAmount: floodAmount || '0',
      annualFloodInsurance: annualFlood,
      monthlyFloodInsurance: monthlyFlood,
      
      // Totals
      totalMonthlyTaxesInsurance: monthlyTax + monthlyInsurance + monthlyFlood
    };
    
    onComplete(data);
  };

  // Calculate monthly amounts for display (with placeholders)
  const monthlyTax = isVADisabledExempt ? 0 : (parseFloat(currentTaxAmount.replace(/[$,]/g, '') || '5000') / 12);
  const monthlyInsurance = parseFloat(currentInsuranceAmount.replace(/[$,]/g, '') || '1800') / 12;
  const monthlyFlood = parseFloat(floodAmount.replace(/[$,]/g, '') || '0') / 12;
  const totalMonthly = monthlyTax + monthlyInsurance + monthlyFlood;

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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Property Taxes & Insurance</h1>
              <p className="text-gray-600">Connect to your current tax bill and insurance policy</p>
              <div className="mt-4 text-sm text-blue-600 bg-blue-50 rounded-lg p-3 inline-block">
                Step 11 of 12 - Refinance Application
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Property Address Display */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Property Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="font-medium text-gray-900">{propertyAddress}</div>
                  {propertyZipCode && <div className="text-gray-600">ZIP: {propertyZipCode}</div>}
                </div>
              </CardContent>
            </Card>

            {/* Property Taxes */}
            <Card>
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  Property Taxes
                </CardTitle>
                <CardDescription>
                  Connect to your current tax assessment for accurate calculations
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {!taxBillConnected ? (
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Connect to Tax Assessment
                      </h3>
                      <p className="text-gray-600 mb-4">
                        We'll retrieve your current property tax information directly from the county assessor
                      </p>
                    </div>
                    
                    <Button
                      onClick={handleTaxBillConnect}
                      size="lg"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect to Tax Assessment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Successfully connected to county tax assessor records
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="currentTaxAmount">Current Annual Tax Amount</Label>
                        <Input
                          id="currentTaxAmount"
                          value={currentTaxAmount}
                          onChange={(e) => setCurrentTaxAmount(e.target.value)}
                          placeholder="$5,000"
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-6">
                        <Switch
                          id="va-disabled"
                          checked={isVADisabledExempt}
                          onCheckedChange={setIsVADisabledExempt}
                        />
                        <Label htmlFor="va-disabled">VA Disability Tax Exemption</Label>
                      </div>
                    </div>
                    
                    {isVADisabledExempt && (
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertDescription className="text-blue-800">
                          Property tax exemption applied for VA disabled veteran. No monthly property tax payment required.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {currentTaxAmount && (
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Monthly Property Tax:</span>
                          <span className="text-xl font-bold text-green-600">
                            ${monthlyTax.toFixed(0)}/month
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Homeowners & Flood Insurance */}
            <Card>
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Homeowners & Flood Insurance
                </CardTitle>
                <CardDescription>
                  Connect to CanopyConnect for current insurance information
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {!canopyConnected ? (
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <Shield className="h-12 w-12 text-blue-400 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Connect to CanopyConnect
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Access your current insurance policy details and explore refinance insurance options
                      </p>
                    </div>
                    
                    <Button
                      onClick={handleCanopyConnect}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect to CanopyConnect
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Successfully connected to CanopyConnect insurance platform
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="currentInsuranceAmount">Homeowners Insurance Annual Premium</Label>
                        <Input
                          id="currentInsuranceAmount"
                          value={currentInsuranceAmount}
                          onChange={(e) => setCurrentInsuranceAmount(e.target.value)}
                          placeholder="$1,800"
                        />
                      </div>
                      <div>
                        <Label htmlFor="floodAmount">Flood Insurance Annual Premium</Label>
                        <Input
                          id="floodAmount"
                          value={floodAmount}
                          onChange={(e) => setFloodAmount(e.target.value)}
                          placeholder="$600"
                        />
                      </div>
                    </div>
                    
                    {(currentInsuranceAmount || floodAmount) && (
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="space-y-2">
                          {currentInsuranceAmount && (
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Monthly Homeowners Insurance:</span>
                              <span className="text-lg font-bold text-blue-600">
                                ${monthlyInsurance.toFixed(0)}/month
                              </span>
                            </div>
                          )}
                          {floodAmount && (
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Monthly Flood Insurance:</span>
                              <span className="text-lg font-bold text-blue-600">
                                ${monthlyFlood.toFixed(0)}/month
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>



            {/* Total Summary */}
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-blue-800">Monthly Cost Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Property Taxes</span>
                    <span className="font-semibold">${monthlyTax.toFixed(0)}/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Homeowners Insurance</span>
                    <span className="font-semibold">${monthlyInsurance.toFixed(0)}/month</span>
                  </div>
                  {floodAmount && parseFloat(floodAmount.replace(/[$,]/g, '') || '0') > 0 && (
                    <div className="flex justify-between">
                      <span>Flood Insurance</span>
                      <span className="font-semibold">${monthlyFlood.toFixed(0)}/month</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total TI{(floodAmount && parseFloat(floodAmount.replace(/[$,]/g, '') || '0') > 0) ? 'F' : ''}:</span>
                    <span className="text-blue-600">${totalMonthly.toFixed(0)}/month</span>
                  </div>
                </div>
              </CardContent>
            </Card>
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
              onClick={handleContinue}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              View Refinance Analysis
            </Button>
          </div>

          {/* Reviews Section */}
          <ReviewsSection />
        </div>
      </div>
    </div>
  );
}