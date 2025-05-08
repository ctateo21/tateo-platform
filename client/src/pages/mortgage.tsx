import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight, DollarSign, Percent, Calculator, Home, ExternalLink, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Mortgage() {  
  // State for calculator
  const [yearlyIncome, setYearlyIncome] = useState<string>('');
  const [monthlyDebts, setMonthlyDebts] = useState<string>('');
  const [formattedIncome, setFormattedIncome] = useState<string>('');
  const [formattedDebts, setFormattedDebts] = useState<string>('');
  const [creditScore, setCreditScore] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [loanType, setLoanType] = useState<string>('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState({
    loanAmount: 0,
    principalAndInterest: 0,
    propertyTax: 0,
    insurance: 0,
    totalMonthlyPayment: 0,
    dtiRatio: 0,
    interestRate: 0
  });
  
  // Current mortgage rates from MortgageNewsDaily.com (as of latest data)
  // These would ideally be fetched from an API in a production environment
  const mortgageRates = {
    conventional: 0.0690, // 6.90% - 30-Year Fixed
    fha: 0.0660, // 6.60% - 30-Year FHA
    va: 0.0668, // 6.68% - 30-Year VA
    usda: 0.0660, // 6.60% - Same as FHA
    unique: 0.0730 // 7.30% - Conventional + 0.4%
  };

  // List of US states
  const usStates = [
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' },
    { value: 'DC', label: 'District of Columbia' }
  ];

  // Calculate mortgage qualification
  const handleCalculate = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    // Validate required fields
    if (!yearlyIncome || !monthlyDebts || !creditScore || !selectedState || !loanType) {
      alert("Please fill in all fields to calculate your qualification.");
      return;
    }
    
    const income = parseFloat(yearlyIncome) || 0;
    const debts = parseFloat(monthlyDebts) || 0;
    
    // Calculate monthly income - yearly income is already provided
    const monthlyIncome = income / 12; // $120,000/12 = $10,000 per month
    
    // Determine max DTI based on credit score - highest credit scores get highest DTI
    let maxDti = 0.43; // Default DTI ratio
    
    // Credit scores 740+ get max DTI of 45%
    if (parseInt(creditScore) >= 740) {
      maxDti = 0.45;
    }
    // Credit scores 700-739 get max DTI of 43%
    else if (parseInt(creditScore) >= 700) {
      maxDti = 0.43;
    }
    // Credit scores 660-699 get max DTI of 41%
    else if (parseInt(creditScore) >= 660) {
      maxDti = 0.41;
    }
    // Credit scores 640-659 get max DTI of 38%
    else if (parseInt(creditScore) >= 640) {
      maxDti = 0.38;
    }
    // Below 640 get max DTI of 36%
    else if (parseInt(creditScore) > 0) {
      maxDti = 0.36;
    }
    
    // Get base interest rate based on loan type from current rates
    let baseInterestRate = mortgageRates[loanType as keyof typeof mortgageRates];
    
    // Apply credit score adjustments - add 0.1% for each tier below 780+
    const scoreTiers = [780, 760, 740, 720, 700, 680, 660, 640, 620, 600];
    if (creditScore) {
      const creditScoreNum = parseInt(creditScore);
      const tierIndex = scoreTiers.findIndex(score => score <= creditScoreNum);
      
      // Calculate adjustment based on tier difference
      // Example: 780+ is tier 0, 700-719 is tier 4, so add 0.4%
      if (tierIndex > 0) {
        const rateAdjustment = tierIndex * 0.001; // 0.1% per tier
        baseInterestRate += rateAdjustment;
        console.log(`Credit score adjustment: +${(rateAdjustment * 100).toFixed(1)}% (tier ${tierIndex})`);
      } else if (tierIndex === 0) {
        console.log('No credit score adjustment for top tier (780+)');
      }
    }
    
    // We're now using exact rates from MortgageNewsDaily.com without state adjustments
    // But we'll keep the code here for possible future customizations
    /*
    const highRateStates = ['CA', 'NY', 'HI', 'NJ', 'MA']; // High cost of living states
    const lowRateStates = ['TX', 'FL', 'GA', 'NC', 'TN']; // Lower cost of living states
    
    if (highRateStates.includes(selectedState)) {
      baseInterestRate += 0.005; // Add 0.5% for high-cost states
    } else if (lowRateStates.includes(selectedState)) {
      baseInterestRate -= 0.003; // Subtract 0.3% for low-cost states
    }
    */
    
    // Calculate max monthly payment available (total PITI - principal, interest, taxes, insurance)
    // Example: $10,000 × 45% - $1,250 = $4,500 - $1,250 = $3,250 max monthly payment
    const maxMonthlyPayment = (monthlyIncome * maxDti) - debts;
    
    // Calculate tax and insurance rates (monthly percentages of loan amount)
    // Default rates for most states
    let propertyTaxRate = 0.01 / 12; // 1% annual property tax / 12 months
    let insuranceRate = 0.005 / 12; // 0.5% annual insurance / 12 months
    
    // Florida-specific rates
    if (selectedState === 'FL') {
      propertyTaxRate = 0.015 / 12; // 1.5% annual property tax / 12 months
      insuranceRate = 0.0075 / 12; // 0.75% annual insurance / 12 months
    }
    
    // Calculate how much of the monthly payment is available for principal and interest
    // Using an algebraic transformation of the standard mortgage formula that accounts for taxes and insurance
    const monthlyInterestRate = baseInterestRate / 12;
    const term = 30 * 12; // 30-year mortgage in months
    
    // This factor accounts for taxes and insurance proportional to loan amount
    const taxInsuranceFactor = propertyTaxRate + insuranceRate;
    
    // Calculate loan amount using mortgage formula adjusted for insurance and taxes
    // Formula derivation: Payment = L × [r(1+r)^n/((1+r)^n-1) + tax + ins]
    // Where L = loan amount, r = monthly interest rate, n = term in months, tax = monthly tax rate, ins = monthly insurance rate
    const piRatio = monthlyInterestRate * Math.pow(1 + monthlyInterestRate, term) / (Math.pow(1 + monthlyInterestRate, term) - 1);
    const loanAmount = maxMonthlyPayment / (piRatio + taxInsuranceFactor);
    
    // Calculate the components of the payment
    const principalAndInterest = loanAmount * piRatio;
    const propertyTax = loanAmount * propertyTaxRate;
    const insurance = loanAmount * insuranceRate;
    
    // Round to nearest whole numbers for display
    const roundedLoanAmount = Math.round(loanAmount);
    const roundedPrincipalAndInterest = Math.round(principalAndInterest);
    const roundedPropertyTax = Math.round(propertyTax);
    const roundedInsurance = Math.round(insurance);
    const roundedTotalPayment = Math.round(principalAndInterest + propertyTax + insurance);
    
    // Debug output to console for verification
    console.log('==== Mortgage Qualification Calculator ====');
    console.log(`Yearly Income: $${income}`);
    console.log(`Monthly Income: $${monthlyIncome.toFixed(2)}`);
    console.log(`Monthly Debts: $${debts}`);
    console.log(`Max DTI: ${(maxDti * 100).toFixed(2)}%`);
    console.log(`Available Monthly Payment: $${maxMonthlyPayment.toFixed(2)}`);
    console.log(`Interest Rate: ${(baseInterestRate * 100).toFixed(2)}%`);
    console.log(`Monthly Interest Rate: ${(monthlyInterestRate * 100).toFixed(4)}%`);
    console.log(`P&I Ratio: ${piRatio.toFixed(6)}`);
    console.log(`Tax+Insurance Factor: ${taxInsuranceFactor.toFixed(6)}`);
    console.log(`Loan Amount: $${loanAmount.toFixed(2)}`);
    console.log(`Principal & Interest: $${principalAndInterest.toFixed(2)}`);
    console.log(`Property Tax: $${propertyTax.toFixed(2)}`);
    console.log(`Insurance: $${insurance.toFixed(2)}`);
    console.log(`Total Monthly Payment: $${(principalAndInterest + propertyTax + insurance).toFixed(2)}`);
    console.log('=======================================');
    
    // Update results
    setResults({
      loanAmount: roundedLoanAmount,
      principalAndInterest: roundedPrincipalAndInterest,
      propertyTax: roundedPropertyTax,
      insurance: roundedInsurance,
      totalMonthlyPayment: roundedTotalPayment,
      dtiRatio: Math.round(maxDti * 100),
      interestRate: baseInterestRate * 100 // Convert to percentage
    });
    
    setShowResults(true);
  };
  
  const resources = [
    {
      title: "Purchase Guide",
      description: "Learn all about the home buying process, mortgage options, and how to secure the best terms.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Purchase Guide",
      link: "#"
    },
    {
      title: "Refinance Guide",
      description: "Learn all about the refinancing process, when to refinance, and how to secure the best terms.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Refinance Guide",
      link: "#"
    }
  ];

  const mortgageTypes = [
    {
      title: "Conventional Mortgages",
      description: "Standard mortgages not backed by government agencies with competitive rates for qualified borrowers.",
      icon: <Home className="h-10 w-10 text-primary" />
    },
    {
      title: "FHA Loans",
      description: "Government-backed loans with more flexible qualification requirements and lower down payments.",
      icon: <DollarSign className="h-10 w-10 text-primary" />
    },
    {
      title: "VA Loans",
      description: "Exclusive loans for veterans and service members with excellent terms and no down payment options.",
      icon: <Home className="h-10 w-10 text-primary" />
    },
    {
      title: "Unique Loan Products",
      description: "Other loan options if you don't fit the guidelines for Conventional, FHA or VA, there are still endless options.",
      icon: <Percent className="h-10 w-10 text-primary" />
    }
  ];

  return (
    <div>
      <Helmet>
        <title>Mortgage Services | Tateo & Co</title>
      </Helmet>

      <div className="py-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Mortgage Services</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Our mortgage specialists can help you secure the right financing for your home purchase, refinance your existing mortgage, or access your home equity through cash-out options.
          </p>
        </div>
      </div>
      
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">Mortgage Options</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We offer a full range of mortgage products to meet your specific needs. Our team works with multiple lenders to find the best rates and terms for your situation.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {mortgageTypes.map((type, index) => (
              <Card key={index} className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="bg-primary/10 p-3 rounded-lg inline-block mb-4">
                    {type.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-primary mb-2">{type.title}</h3>
                  <p className="text-gray-600">{type.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">Instantly Qualify Yourself</h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
            <p className="text-gray-600 max-w-3xl mx-auto">
              Use our calculators below to get a quick estimate of your mortgage qualification. You can either enter your income details or search for a specific property address.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Income-Based Qualification */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-primary mb-4 text-center">Qualify by Income</h3>
              <p className="text-sm text-gray-600 mb-4 text-center">Calculate how much home you can afford based on your income and existing debts</p>
            <form className="space-y-6" id="qualification-form">
              <div className="grid md:grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label htmlFor="yearlyIncome" className="block text-sm font-medium text-gray-700">Yearly Income ($)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      id="yearlyIncome" 
                      name="yearlyIncome" 
                      placeholder="Enter your annual income" 
                      className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      value={formattedIncome}
                      onChange={(e) => {
                        // Extract numbers only
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setYearlyIncome(value);
                        
                        // Format as currency
                        if (value) {
                          const numValue = parseInt(value, 10);
                          setFormattedIncome(new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(numValue));
                        } else {
                          setFormattedIncome('');
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="monthlyDebts" className="block text-sm font-medium text-gray-700">Monthly Debts ($)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      id="monthlyDebts" 
                      name="monthlyDebts" 
                      placeholder="Enter your total monthly debt payments" 
                      className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      value={formattedDebts}
                      onChange={(e) => {
                        // Extract numbers only
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setMonthlyDebts(value);
                        
                        // Format as currency
                        if (value) {
                          const numValue = parseInt(value, 10);
                          setFormattedDebts(new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(numValue));
                        } else {
                          setFormattedDebts('');
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="creditScore" className="block text-sm font-medium text-gray-700">Estimated Credit Score</label>
                  <select 
                    id="creditScore" 
                    name="creditScore" 
                    className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={creditScore}
                    onChange={(e) => setCreditScore(e.target.value)}
                  >
                    <option value="">Select your credit score range</option>
                    <option value="780">780+</option>
                    <option value="760">760-779</option>
                    <option value="740">740-759</option>
                    <option value="720">720-739</option>
                    <option value="700">700-719</option>
                    <option value="680">680-699</option>
                    <option value="660">660-679</option>
                    <option value="640">640-659</option>
                    <option value="620">620-639</option>
                    <option value="600">Below 620</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="selectedState" className="block text-sm font-medium text-gray-700">State You're Buying In</label>
                  <select 
                    id="selectedState" 
                    name="selectedState" 
                    className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  >
                    <option value="">Select a state</option>
                    {usStates.map((state) => (
                      <option key={state.value} value={state.value}>{state.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="loanType" className="block text-sm font-medium text-gray-700">Loan Type</label>
                  <select 
                    id="loanType" 
                    name="loanType" 
                    className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value)}
                  >
                    <option value="">Select loan type</option>
                    <option value="conventional">Conventional</option>
                    <option value="fha">FHA</option>
                    <option value="va">VA</option>
                    <option value="usda">USDA</option>
                    <option value="unique">Unique Loan Products</option>
                  </select>
                </div>
              </div>
              
              <div className="text-center pt-4">
                <Button 
                  type="button" 
                  id="calculate-button"
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-2"
                  onClick={(e) => handleCalculate(e)}
                >
                  Calculate Qualification <Calculator className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>

            {showResults && (
              <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                <h3 className="text-xl font-semibold text-primary mb-3">Your Estimated Qualification</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Estimated Loan Amount:</span>
                    <span className="text-xl font-bold text-primary">${results.loanAmount.toLocaleString()}</span>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-md my-4">
                    <h4 className="font-semibold text-primary mb-2">Monthly Payment Breakdown:</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Principal & Interest:</span>
                        <span className="font-medium">${results.principalAndInterest.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Property Taxes:</span>
                        <span className="font-medium">${results.propertyTax.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Homeowners Insurance:</span>
                        <span className="font-medium">${results.insurance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-blue-200 pt-2 mt-2">
                        <span className="font-medium">Total Monthly Payment:</span>
                        <span className="font-bold">${results.totalMonthlyPayment.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Debt-to-Income Ratio:</span>
                    <span>{results.dtiRatio}%</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Estimated Interest Rate:</span>
                    <div className="flex items-center">
                      <span>{results.interestRate.toFixed(2)}%</span>
                      <a href="https://www.mortgagenewsdaily.com/mortgage-rates" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 ml-2 text-xs underline flex items-center">
                        <ExternalLink className="h-3 w-3 mr-1" /> View current rates
                      </a>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Loan Type:</span>
                    <span className="capitalize">{loanType} Loan</span>
                  </div>
                  
                  {selectedState === 'FL' && (
                    <div className="mt-4 bg-orange-50 p-3 rounded-md text-sm">
                      <p className="font-medium text-orange-700 mb-1">Florida Property Information:</p>
                      <p className="text-gray-700">Florida has property tax rates of approximately 1.5% annually and homeowners insurance of around 0.75% annually of the home's value.</p>
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-500 mt-4">
                    This is just an estimate. For a more accurate assessment, please contact our mortgage specialists.
                  </p>
                  <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
                    <p>Interest rates updated from MortgageNewsDaily.com</p>
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* Address-Based Qualification */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-primary mb-4 text-center">Qualify by Property</h3>
              <p className="text-sm text-gray-600 mb-4 text-center">Find out if you qualify for a specific property by entering its address</p>
              
              <form className="space-y-6" id="address-qualification-form">
                <div className="grid md:grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="propertyAddress" className="block text-sm font-medium text-gray-700">Property Address</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        id="propertyAddress" 
                        name="propertyAddress" 
                        placeholder="Enter the full property address" 
                        className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div id="propertyResult" className="hidden mt-4 p-4 bg-gray-50 rounded-md">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2">
                      <span className="font-medium">Property Price:</span>
                      <span className="text-lg font-bold text-primary">$0</span>
                    </div>
                    <p className="text-xs text-gray-500">Data from Zillow</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="downPayment" className="block text-sm font-medium text-gray-700">Down Payment (%)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        id="downPayment" 
                        name="downPayment" 
                        placeholder="20" 
                        min="3" 
                        max="50"
                        className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="addressCreditScore" className="block text-sm font-medium text-gray-700">Estimated Credit Score</label>
                    <select 
                      id="addressCreditScore" 
                      name="addressCreditScore" 
                      className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Select your credit score range</option>
                      <option value="780">780+</option>
                      <option value="760">760-779</option>
                      <option value="740">740-759</option>
                      <option value="720">720-739</option>
                      <option value="700">700-719</option>
                      <option value="680">680-699</option>
                      <option value="660">660-679</option>
                      <option value="640">640-659</option>
                      <option value="620">620-639</option>
                      <option value="600">Below 620</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="monthlyIncome" className="block text-sm font-medium text-gray-700">Monthly Income ($)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        id="monthlyIncome" 
                        name="monthlyIncome" 
                        placeholder="Enter your monthly income" 
                        className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="addressMonthlyDebts" className="block text-sm font-medium text-gray-700">Monthly Debts ($)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        id="addressMonthlyDebts" 
                        name="addressMonthlyDebts" 
                        placeholder="Enter your total monthly debt payments" 
                        className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="addressLoanType" className="block text-sm font-medium text-gray-700">Loan Type</label>
                    <select 
                      id="addressLoanType" 
                      name="addressLoanType" 
                      className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Select loan type</option>
                      <option value="conventional">Conventional</option>
                      <option value="fha">FHA</option>
                      <option value="va">VA</option>
                      <option value="usda">USDA</option>
                      <option value="unique">Unique Loan Products</option>
                    </select>
                  </div>
                </div>
                
                <div className="text-center pt-4">
                  <Button 
                    type="button" 
                    id="search-address-button"
                    className="bg-secondary hover:bg-secondary/90 text-white px-8 py-2 mb-3 w-full"
                  >
                    Find Property <Search className="ml-2 h-4 w-4" />
                  </Button>
                  
                  <Button 
                    type="button" 
                    id="calculate-address-button"
                    className="bg-primary hover:bg-primary/90 text-white px-8 py-2 w-full"
                  >
                    Calculate Qualification <Calculator className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>

              <div id="addressQualificationResults" className="hidden mt-8 p-6 bg-gray-50 rounded-lg">
                <h3 className="text-xl font-semibold text-primary mb-3">Your Estimated Qualification</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Estimated Loan Amount:</span>
                    <span className="text-xl font-bold text-primary">${results.loanAmount.toLocaleString()}</span>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-md my-4">
                    <h4 className="font-semibold text-primary mb-2">Monthly Payment Breakdown:</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Principal & Interest:</span>
                        <span className="font-medium">${results.principalAndInterest.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Property Taxes:</span>
                        <span className="font-medium">${results.propertyTax.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Homeowners Insurance:</span>
                        <span className="font-medium">${results.insurance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-blue-200 pt-2 mt-2">
                        <span className="font-medium">Total Monthly Payment:</span>
                        <span className="font-bold">${results.totalMonthlyPayment.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Debt-to-Income Ratio:</span>
                    <span>{results.dtiRatio}%</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Estimated Interest Rate:</span>
                    <div className="flex items-center">
                      <span>{results.interestRate.toFixed(2)}%</span>
                      <a href="https://www.mortgagenewsdaily.com/mortgage-rates" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 ml-2 text-xs underline flex items-center">
                        <ExternalLink className="h-3 w-3 mr-1" /> View current rates
                      </a>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Loan Type:</span>
                    <span className="capitalize">{loanType} Loan</span>
                  </div>
                  
                  {selectedState === 'FL' && (
                    <div className="mt-4 bg-orange-50 p-3 rounded-md text-sm">
                      <p className="font-medium text-orange-700 mb-1">Florida Property Information:</p>
                      <p className="text-gray-700">Florida has property tax rates of approximately 1.5% annually and homeowners insurance of around 0.75% annually of the home's value.</p>
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-500 mt-4">
                    This is just an estimate. For a more accurate assessment, please contact our mortgage specialists.
                  </p>
                  <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
                    <p>Interest rates updated from MortgageNewsDaily.com</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      


      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
              Mortgage Resources
            </h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Download our free guides to help you understand the mortgage process and make informed decisions.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-10">
            {resources.map((resource, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
                <div className="p-8">
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-3 rounded-lg mr-5">
                      {resource.icon}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-primary mb-3">{resource.title}</h3>
                      <p className="text-gray-600 mb-6 leading-relaxed">{resource.description}</p>
                      <Button asChild variant="outline" className="group border-primary text-primary hover:bg-primary hover:text-white">
                        <a href={resource.link} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                          {resource.cta}
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6 text-primary">Ready to Explore Your Mortgage Options?</h2>
            <p className="text-gray-600 mb-8">Our team of mortgage specialists is ready to help you find the right financing solution for your needs.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild className="bg-primary hover:bg-primary/90 text-white">
                <Link href="/questionnaire">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild className="bg-secondary hover:bg-secondary/90 text-white">
                <Link href="/#contact">
                  CONTACT <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}