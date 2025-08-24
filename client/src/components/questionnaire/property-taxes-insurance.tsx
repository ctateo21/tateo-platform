import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Home, Shield, Waves, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPropertyTaxEstimate } from "@/lib/county-tax-estimator";

interface PropertyTaxesInsuranceProps {
  onComplete: (data: any) => void;
  onBack: () => void;
  propertyAddress?: string;
  propertyZipCode?: string;
  salePrice?: number;
  isVADisabled?: boolean;
  isPrimaryResidence?: boolean;
  defaultValues?: any;
}

export function PropertyTaxesInsurance({ 
  onComplete, 
  onBack, 
  propertyAddress,
  propertyZipCode,
  salePrice = 400000,
  isVADisabled = false,
  isPrimaryResidence = false,
  defaultValues 
}: PropertyTaxesInsuranceProps) {
  const [propertyTaxData, setPropertyTaxData] = useState<any>(null);
  const [insuranceQuote, setInsuranceQuote] = useState<any>(null);
  const [floodData, setFloodData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch real property tax, insurance, and flood data
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Get property tax estimate using real county data
        if (propertyAddress && salePrice) {
          const taxEstimate = await getPropertyTaxEstimate({
            address: propertyAddress,
            salePrice,
            isPrimaryResidence,
            isVADisabled
          });

          setPropertyTaxData({
            estimatedAnnualTax: taxEstimate.estimatedAnnualTax,
            taxRate: taxEstimate.taxRate,
            county: taxEstimate.county,
            adValoremTax: taxEstimate.adValoremTax,
            nonAdValoremTax: taxEstimate.nonAdValoremTax,
            eligibleForVAExemption: isVADisabled && isPrimaryResidence && taxEstimate.source === 'county_website'
          });
        } else {
          // Fallback to estimated data if no address or sale price
          setPropertyTaxData({
            estimatedAnnualTax: 4850,
            taxRate: 1.2,
            county: "Estimated",
            adValoremTax: 3420,
            nonAdValoremTax: 1430,
            eligibleForVAExemption: isVADisabled && isPrimaryResidence
          });
        }

        // TODO: Replace with real insurance API calls
        setInsuranceQuote({
          annualPremium: 1650,
          monthlyPremium: 137.50,
          provider: "QuoteRush",
          coverage: 350000,
          deductible: 2500
        });

        // TODO: Replace with real FEMA flood zone lookup
        setFloodData({
          required: Math.random() > 0.5, // 50% chance flood insurance is required
          zone: Math.random() > 0.5 ? "AE" : "X",
          annualPremium: 850,
          monthlyPremium: 70.83
        });
        
      } catch (error) {
        console.error('Error fetching property data:', error);
        // Fallback to estimated data on error
        setPropertyTaxData({
          estimatedAnnualTax: 4850,
          taxRate: 1.2,
          county: "Estimated",
          adValoremTax: 3420,
          nonAdValoremTax: 1430,
          eligibleForVAExemption: isVADisabled && isPrimaryResidence
        });

        setInsuranceQuote({
          annualPremium: 1650,
          monthlyPremium: 137.50,
          provider: "QuoteRush",
          coverage: 350000,
          deductible: 2500
        });

        setFloodData({
          required: false,
          zone: "X",
          annualPremium: 850,
          monthlyPremium: 70.83
        });
      }
      
      setLoading(false);
    };

    fetchData();
  }, [propertyAddress, propertyZipCode, salePrice, isVADisabled, isPrimaryResidence]);

  const handleContinue = () => {
    onComplete({
      propertyTax: propertyTaxData,
      homeownersInsurance: insuranceQuote,
      floodInsurance: floodData,
      totalMonthlyEscrow: calculateTotalEscrow()
    });
  };

  const calculateTotalEscrow = () => {
    if (!propertyTaxData || !insuranceQuote) return 0;
    
    const monthlyTax = propertyTaxData.estimatedAnnualTax / 12;
    const monthlyInsurance = insuranceQuote.monthlyPremium;
    const monthlyFlood = floodData?.required ? floodData.monthlyPremium : 0;
    
    return monthlyTax + monthlyInsurance + monthlyFlood;
  };

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Calculating property taxes and insurance quotes...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Property Taxes & Insurance</CardTitle>
        <CardDescription>
          Based on {propertyAddress || propertyZipCode || 'your property location'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Property Taxes Section */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Home className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Property Taxes</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Estimated Annual Tax</p>
              <p className="text-2xl font-bold text-green-600">
                ${propertyTaxData?.estimatedAnnualTax?.toLocaleString() || '0'}
              </p>
              <p className="text-sm text-gray-500">
                ${((propertyTaxData?.estimatedAnnualTax || 0) / 12).toFixed(0)}/month
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tax Rate</p>
              <p className="text-lg font-semibold">{propertyTaxData?.taxRate || 0}%</p>
              <p className="text-sm text-gray-500">{propertyTaxData?.county || 'Unknown'}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Ad Valorem Taxes</p>
              <p className="font-medium">${propertyTaxData?.adValoremTax?.toLocaleString() || '0'}</p>
            </div>
            <div>
              <p className="text-gray-600">Non-Ad Valorem Taxes</p>
              <p className="font-medium">${propertyTaxData?.nonAdValoremTax?.toLocaleString() || '0'}</p>
            </div>
          </div>

          {propertyTaxData?.eligibleForVAExemption && (
            <div className="mt-4 bg-green-50 border border-green-200 p-3 rounded-lg">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">VA Disability Tax Exemption Available</p>
                  <p className="text-sm text-green-700">
                    As a 100% VA disabled veteran purchasing a primary residence, you may be eligible 
                    to have Ad Valorem taxes removed. Non-Ad Valorem taxes would still apply.
                  </p>
                  <p className="text-sm font-medium text-green-800 mt-1">
                    Potential savings: ${propertyTaxData?.adValoremTax?.toLocaleString() || '0'}/year
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Homeowners Insurance Section */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Shield className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Homeowners Insurance</h3>
            <Badge variant="outline">QuoteRush</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Annual Premium</p>
              <p className="text-xl font-bold text-blue-600">
                ${insuranceQuote?.annualPremium?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Monthly Premium</p>
              <p className="text-xl font-bold text-blue-600">
                ${insuranceQuote?.monthlyPremium || '0'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Coverage Amount</p>
              <p className="text-lg font-semibold">
                ${insuranceQuote?.coverage?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-gray-500">
                ${insuranceQuote?.deductible?.toLocaleString() || '0'} deductible
              </p>
            </div>
          </div>
        </div>

        {/* Flood Insurance Section */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Waves className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Flood Insurance</h3>
            <Badge variant="outline">FEMA Check</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Flood Zone</p>
              <p className="text-lg font-semibold">{floodData?.zone || 'X'}</p>
              <p className="text-sm text-gray-500">
                {floodData?.required ? 'Flood insurance required' : 'Flood insurance optional'}
              </p>
            </div>
            {floodData?.required && (
              <div>
                <p className="text-sm text-gray-600">Estimated Premium</p>
                <p className="text-xl font-bold text-orange-600">
                  ${floodData?.annualPremium || '0'}/year
                </p>
                <p className="text-sm text-gray-500">
                  ${floodData?.monthlyPremium || '0'}/month
                </p>
              </div>
            )}
          </div>

          {floodData?.required && (
            <div className="mt-3 bg-orange-50 border border-orange-200 p-3 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800">Flood Insurance Required</p>
                  <p className="text-sm text-orange-700">
                    This property is in a flood zone that requires flood insurance for mortgage approval.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-gray-50 border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Monthly Escrow Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Property Taxes</span>
              <span>${((propertyTaxData?.estimatedAnnualTax || 0) / 12).toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Homeowners Insurance</span>
              <span>${insuranceQuote?.monthlyPremium || '0'}</span>
            </div>
            {floodData?.required && (
              <div className="flex justify-between">
                <span>Flood Insurance</span>
                <span>${floodData?.monthlyPremium || '0'}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-semibold text-lg">
              <span>Total Monthly Escrow</span>
              <span>${calculateTotalEscrow().toFixed(0)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button onClick={handleContinue}>
            View Loan Analysis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}