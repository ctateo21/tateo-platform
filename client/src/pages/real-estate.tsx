import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight } from "lucide-react";
import PropertyMap from "@/components/real-estate/property-map";

export default function RealEstate() {
  const [zillowApiKey, setZillowApiKey] = useState<string | undefined>(undefined);

  // In a real implementation, you would fetch the API key from your environment variables
  // or from your backend
  useEffect(() => {
    // Simulate checking for an API key
    const checkForApiKey = async () => {
      try {
        // This would be a real API call to your backend
        // const response = await fetch('/api/config/zillow-api-key');
        // const data = await response.json();
        // setZillowApiKey(data.apiKey);
        
        // For demo purposes, we'll use a placeholder
        setZillowApiKey('demo-key');
      } catch (error) {
        console.error('Failed to get Zillow API key:', error);
        // Handle error
      }
    };
    
    checkForApiKey();
  }, []);
  
  const guides = [
    {
      title: "Buyer's Guide",
      description: "A comprehensive guide to help you navigate the home buying process, from pre-approval to closing.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Buyer's Guide",
      link: "#"
    },
    {
      title: "Seller's Guide",
      description: "Everything you need to know about selling your home, from pricing strategies to preparing for showings.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Seller's Guide",
      link: "#"
    }
  ];

  return (
    <div>
      <Helmet>
        <title>Real Estate Services | Tateo & Co</title>
      </Helmet>

      <div className="py-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Real Estate Services</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Our experienced real estate agents help buyers find their dream homes and sellers get the best value for their properties.
          </p>
        </div>
      </div>
      
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-primary mb-4">Find Your Dream Home</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8">
              Use our interactive map to search for properties in your desired location, draw custom search areas, and filter by your preferences.
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-4 h-[600px] mb-8" id="property-search-container">
            <PropertyMap apiKey={zillowApiKey} />
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
              Real Estate Resources
            </h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Download our free guides to help you navigate the real estate process with confidence.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-10">
            {guides.map((guide, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
                <div className="p-8">
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-3 rounded-lg mr-5">
                      {guide.icon}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-primary mb-3">{guide.title}</h3>
                      <p className="text-gray-600 mb-6 leading-relaxed">{guide.description}</p>
                      <Button asChild variant="outline" className="group border-primary text-primary hover:bg-primary hover:text-white">
                        <a href={guide.link} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                          {guide.cta}
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
            <h2 className="text-3xl font-bold mb-6 text-primary">Ready to Buy or Sell?</h2>
            <p className="text-gray-600 mb-8">Our team of real estate experts is ready to answer all your questions and provide personalized guidance.</p>
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