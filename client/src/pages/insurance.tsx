import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight, Car, Home, Shield, Umbrella, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import AddressSearch from "@/components/insurance/address-search";
import InsuranceResults from "@/components/insurance/insurance-results";
import { getInsuranceQuote } from "@/lib/api";

export default function Insurance() {  
  const [property, setProperty] = useState<{ 
    address: string; 
    propertyType: string; 
    insuranceTypes: string[]; 
    otherOptions: string[];
    placeId?: string 
  } | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleAddressSelected = async (
    address: string, 
    insuranceTypes: string[], 
    propertyType: string, 
    otherOptions: string[], 
    placeId?: string
  ) => {
    setProperty({ address, propertyType, insuranceTypes, otherOptions, placeId });
    setLoading(true);
    setError(null);
    
    try {
      // Call backend API to get insurance quote via Canopy Connect
      const data = await getInsuranceQuote({
        address,
        placeId,
        propertyType,
        insuranceTypes,
        otherOptions,
        // Determine primary insurance type based on selection
        type: insuranceTypes[0] || 'property'
      });
      
      setQuote(data);
      setShowResults(true);
    } catch (err) {
      console.error('Error getting insurance quote:', err);
      setError('We encountered a problem getting your insurance options. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const resources = [
    {
      title: "Florida Homeowners Insurance Guide",
      description: "Learn about Florida-specific homeowners insurance options, requirements, and how to get the best coverage for your property.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Homeowners Guide",
      link: "https://tateoco.com/florida-homeowners-insurance-guide/?utm_source=Insurance&utm_medium=form&utm_campaign=HOI_guide"
    },
    {
      title: "Insurance Claims Guide",
      description: "Step-by-step instructions for filing claims and maximizing your insurance benefits when you need them most.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Claims Guide",
      link: "#"
    }
  ];

  const insuranceTypes = [
    {
      title: "Auto Insurance",
      description: "Comprehensive coverage for your vehicles including liability, collision, comprehensive, and uninsured motorist protection.",
      icon: <Car className="h-10 w-10 text-primary" />
    },
    {
      title: "Property or Flood Insurance",
      description: "Protect your home, rental property, or business with comprehensive property and flood insurance coverage.",
      icon: <Home className="h-10 w-10 text-primary" />
    },
    {
      title: "Commercial Insurance",
      description: "Protect your business with comprehensive commercial property, liability, and business interruption insurance.",
      icon: <Shield className="h-10 w-10 text-primary" />
    },
    {
      title: "Other Insurance",
      description: "Additional liability coverage that protects your assets and future earnings beyond standard policy limits.",
      icon: <Umbrella className="h-10 w-10 text-primary" />
    }
  ];

  return (
    <div>
      <Helmet>
        <title>Insurance Services | Tateo & Co</title>
      </Helmet>

      <div className="py-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Insurance Services</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Our insurance specialists can help you find the right coverage to protect what matters most, whether it's your auto, property, or other valuable assets.
          </p>
        </div>
      </div>
      
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">Insurance Coverage Options</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We offer a comprehensive range of insurance products from top-rated carriers to ensure you get the protection you need at competitive rates.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {insuranceTypes.map((type, index) => (
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

          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">FREE QUOTE NOW</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Find personalized insurance options for you in just a few minutes.
            </p>
          </div>

          <div className="max-w-2xl mx-auto mb-12">
            <AddressSearch onAddressSelected={handleAddressSelected} />
            {property && quote && !loading && !error && (
              <div className="mt-8 bg-green-50 p-6 rounded-lg border border-green-200">
                <div className="flex items-center text-green-700 mb-2">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <h3 className="text-lg font-semibold">Quote Request Received</h3>
                </div>
                <p className="text-gray-700">Thank you for your request for {property.address}. An insurance specialist will contact you soon with personalized quotes.</p>
              </div>
            )}
            {loading && (
              <div className="mt-8 text-center p-6">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
                <p className="text-gray-600">Processing your request...</p>
              </div>
            )}
            {error && (
              <div className="mt-8 bg-red-50 p-6 rounded-lg border border-red-200">
                <div className="flex items-center text-red-700 mb-2">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  <h3 className="text-lg font-semibold">Error</h3>
                </div>
                <p className="text-gray-700">{error}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
              Insurance Resources
            </h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Download our free guides to help you understand different insurance options and make informed decisions about your coverage.
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
            <h2 className="text-3xl font-bold mb-6 text-primary">Ready to Protect What Matters Most?</h2>
            <p className="text-gray-600 mb-8">Our insurance specialists are ready to help you find the right coverage for your unique needs.</p>
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