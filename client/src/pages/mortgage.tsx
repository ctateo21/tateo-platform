import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight, DollarSign, Percent, Calculator, Home } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Mortgage() {  
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
            <h2 className="text-3xl font-bold text-primary mb-4">Why Choose Us for Your Mortgage</h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <Calculator className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Personalized Calculations</h3>
              <p className="text-gray-600">We analyze your financial situation to find the perfect mortgage solution tailored to your needs.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <Percent className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Competitive Rates</h3>
              <p className="text-gray-600">We work with multiple lenders to ensure you get the most competitive rates available in the market.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <ArrowRight className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Streamlined Process</h3>
              <p className="text-gray-600">Our experts guide you through every step of the mortgage process, making it simple and stress-free.</p>
            </div>
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