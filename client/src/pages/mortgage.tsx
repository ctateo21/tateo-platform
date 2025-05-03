import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight, DollarSign, Percent, Calculator, Home } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Mortgage() {  
  // State for calculator
  const [yearlyIncome, setYearlyIncome] = useState<string>('');
  const [monthlyDebts, setMonthlyDebts] = useState<string>('');
  const [creditScore, setCreditScore] = useState<string>('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState({
    loanAmount: 0,
    monthlyPayment: 0,
    dtiRatio: 0
  });

  // Calculate mortgage qualification
  const handleCalculate = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const income = parseFloat(yearlyIncome) || 0;
    const debts = parseFloat(monthlyDebts) || 0;
    
    // Calculate monthly income
    const monthlyIncome = income / 12;
    
    // Determine max DTI based on credit score
    let maxDti = 0.43; // Default DTI ratio
    
    // Adjust DTI based on credit score
    if (creditScore === 'excellent') maxDti = 0.45;
    else if (creditScore === 'good') maxDti = 0.43;
    else if (creditScore === 'fair') maxDti = 0.41;
    else if (creditScore === 'poor') maxDti = 0.38;
    else if (creditScore === 'bad') maxDti = 0.35;
    
    // Calculate max monthly payment
    const maxMonthlyPayment = (monthlyIncome * maxDti) - debts;
    
    // Estimate loan amount (simplified - would normally include interest rate, term, etc.)
    // Assuming 30-year fixed at 6.5% interest rate
    const interestRate = 0.065 / 12; // Monthly interest rate
    const term = 30 * 12; // Term in months
    const loanAmount = maxMonthlyPayment * (1 - Math.pow(1 + interestRate, -term)) / interestRate;
    
    // Update results
    setResults({
      loanAmount: Math.round(loanAmount),
      monthlyPayment: Math.round(maxMonthlyPayment),
      dtiRatio: Math.round(maxDti * 100)
    });
    
    setShowResults(true);
  };
  
  const resources = [
    {
      title: "Refinance Guide",
      description: "Learn all about the refinancing process, when to refinance, and how to secure the best terms.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Refinance Guide",
      link: "#"
    },
    {
      title: "Cash Out Guide",
      description: "Understand how cash-out refinancing works and how to leverage your home equity responsibly.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Cash Out Guide",
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
            <p className="text-gray-600 max-w-2xl mx-auto">
              Use our calculator below to get a quick estimate of your mortgage qualification amount based on your financial information.
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <form className="space-y-6" id="qualification-form">
              <div className="grid md:grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label htmlFor="yearlyIncome" className="block text-sm font-medium text-gray-700">Yearly Income ($)</label>
                  <input 
                    type="number" 
                    id="yearlyIncome" 
                    name="yearlyIncome" 
                    placeholder="Enter your annual income" 
                    min="0"
                    className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={yearlyIncome}
                    onChange={(e) => setYearlyIncome(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="monthlyDebts" className="block text-sm font-medium text-gray-700">Monthly Debts ($)</label>
                  <input 
                    type="number" 
                    id="monthlyDebts" 
                    name="monthlyDebts" 
                    placeholder="Enter your total monthly debt payments" 
                    min="0"
                    className="px-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={monthlyDebts}
                    onChange={(e) => setMonthlyDebts(e.target.value)}
                  />
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
                    <option value="excellent">Excellent (750+)</option>
                    <option value="good">Good (700-749)</option>
                    <option value="fair">Fair (650-699)</option>
                    <option value="poor">Poor (600-649)</option>
                    <option value="bad">Bad (below 600)</option>
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
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Monthly Payment Estimate:</span>
                    <span>${results.monthlyPayment.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-medium">Debt-to-Income Ratio:</span>
                    <span>{results.dtiRatio}%</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    This is just an estimate. For a more accurate assessment, please contact our mortgage specialists.
                  </p>
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