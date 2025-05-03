import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight, Wrench, Zap, Droplets, ThermometerSnowflake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function HomeServices() {  
  const resources = [
    {
      title: "Home Maintenance Guide",
      description: "A comprehensive guide to maintaining your home throughout the seasons and preventing costly repairs.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Maintenance Guide",
      link: "#"
    },
    {
      title: "Home Service Provider Directory",
      description: "Our directory of trusted, pre-screened service providers for all your home maintenance and repair needs.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Directory",
      link: "#"
    }
  ];

  const homeServices = [
    {
      title: "General Repairs & Maintenance",
      description: "Regular maintenance and repair services to keep your home in optimal condition and prevent larger issues.",
      icon: <Wrench className="h-10 w-10 text-primary" />
    },
    {
      title: "Electrical Services",
      description: "Professional electrical services including installations, repairs, and upgrades by licensed electricians.",
      icon: <Zap className="h-10 w-10 text-primary" />
    },
    {
      title: "Plumbing Services",
      description: "Comprehensive plumbing services from routine maintenance to emergency repairs by expert plumbers.",
      icon: <Droplets className="h-10 w-10 text-primary" />
    },
    {
      title: "HVAC Services",
      description: "Heating, ventilation, and air conditioning services to keep your home comfortable in every season.",
      icon: <ThermometerSnowflake className="h-10 w-10 text-primary" />
    }
  ];

  return (
    <div>
      <Helmet>
        <title>Home Services | Tateo & Co</title>
      </Helmet>

      <div className="py-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Home Services</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            From routine maintenance to emergency repairs, our network of trusted service providers can handle all your home service needs with professionalism and care.
          </p>
        </div>
      </div>
      
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">Our Home Services</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We provide access to a wide range of home services through our network of pre-screened, qualified service professionals.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {homeServices.map((service, index) => (
              <Card key={index} className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="bg-primary/10 p-3 rounded-lg inline-block mb-4">
                    {service.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-primary mb-2">{service.title}</h3>
                  <p className="text-gray-600">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">Why Choose Our Home Services</h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <Wrench className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Trusted Professionals</h3>
              <p className="text-gray-600">All service providers in our network are thoroughly vetted, insured, and have a proven track record of quality work.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Prompt Service</h3>
              <p className="text-gray-600">We understand the urgency of home repairs and prioritize quick response times and efficient service.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <ArrowRight className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Quality Guaranteed</h3>
              <p className="text-gray-600">We stand behind the work of our service providers and ensure your complete satisfaction with every job.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
              Home Service Resources
            </h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Download our free guides to help maintain your home and connect with the right service providers when needed.
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
            <h2 className="text-3xl font-bold mb-6 text-primary">Ready to Connect with Home Service Professionals?</h2>
            <p className="text-gray-600 mb-8">Let us help you find the right service providers for your home maintenance and repair needs.</p>
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