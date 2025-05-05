import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight, Car, Home, Shield, Umbrella } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import AddressSearch from "@/components/insurance/address-search";
import InsuranceResults from "@/components/insurance/insurance-results";

export default function Insurance() {  
  const [property, setProperty] = useState<{ address: string; placeId?: string } | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddressSelected = async (address: string, placeId?: string) => {
    setProperty({ address, placeId });
    setLoading(true);
    setError(null);
    
    try {
      // Call backend API to get insurance quote via Canopy Connect
      // In the real implementation, we would make a real API call
      const response = await fetch('/api/insurance/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          placeId,
          type: 'property' // Default to property insurance
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get insurance quote');
      }

      const data = await response.json();
      setQuote(data);
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
      title: "Property Insurance",
      description: "Protect your home, rental property, or business with comprehensive property insurance coverage.",
      icon: <Home className="h-10 w-10 text-primary" />
    },
    {
      title: "Life Insurance",
      description: "Ensure your loved ones' financial security with term life, whole life, or universal life insurance options.",
      icon: <Shield className="h-10 w-10 text-primary" />
    },
    {
      title: "Umbrella Insurance",
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
            <h2 className="text-3xl font-bold text-primary mb-4">Get a Quote for Your Property</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Find personalized insurance options for your property in just a few minutes. Enter your address to get started.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div>
              <AddressSearch onAddressSelected={handleAddressSelected} />
            </div>
            <div>
              <InsuranceResults 
                quote={quote} 
                isLoading={loading} 
                error={error} 
              />
            </div>
          </div>
          
          <div className="text-center mt-16 mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">Insurance Coverage Options</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We offer a comprehensive range of insurance products from top-rated carriers to ensure you get the protection you need at competitive rates.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
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
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">Why Choose Us for Your Insurance</h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Comprehensive Protection</h3>
              <p className="text-gray-600">We analyze your specific risks to create insurance solutions that provide complete protection for your assets.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <Car className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Multiple Carrier Options</h3>
              <p className="text-gray-600">We work with numerous insurance carriers to find you the best coverage at the most competitive rates.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <ArrowRight className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Claims Advocacy</h3>
              <p className="text-gray-600">When you need to file a claim, our team provides personalized support to ensure a smooth, hassle-free process.</p>
            </div>
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