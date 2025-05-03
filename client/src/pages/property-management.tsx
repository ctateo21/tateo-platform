import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight, Home, Building, ClipboardList, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function PropertyManagement() {  
  const resources = [
    {
      title: "Property Owner's Guide",
      description: "Essential information for property owners on how to maximize returns and minimize hassles with professional management.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Owner's Guide",
      link: "#"
    },
    {
      title: "Tenant's Handbook",
      description: "Everything tenants need to know about renting a property through our management services.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Tenant Handbook",
      link: "#"
    }
  ];

  const managementServices = [
    {
      title: "Full-Service Property Management",
      description: "Comprehensive management services including tenant screening, rent collection, maintenance, and financial reporting.",
      icon: <Building className="h-10 w-10 text-primary" />
    },
    {
      title: "Tenant Placement",
      description: "Professional marketing, screening, and placement services to find qualified tenants for your property.",
      icon: <User className="h-10 w-10 text-primary" />
    },
    {
      title: "Maintenance Coordination",
      description: "24/7 maintenance response and coordination with trusted contractors to keep your property in excellent condition.",
      icon: <ClipboardList className="h-10 w-10 text-primary" />
    },
    {
      title: "Rental Properties",
      description: "A wide selection of quality rental properties for potential tenants in various neighborhoods and price ranges.",
      icon: <Home className="h-10 w-10 text-primary" />
    }
  ];

  return (
    <div>
      <Helmet>
        <title>Property Management Services | Tateo & Co</title>
      </Helmet>

      <div className="py-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Property Management Services</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Our professional property management services help property owners maximize returns while minimizing hassles, and help tenants find quality rental homes.
          </p>
        </div>
      </div>
      
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">Our Management Services</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              From full-service property management to tenant placement, we offer comprehensive solutions for property owners and tenants alike.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {managementServices.map((service, index) => (
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
            <h2 className="text-3xl font-bold text-primary mb-4">Why Choose Our Property Management</h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <Building className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Experienced Team</h3>
              <p className="text-gray-600">Our property managers bring years of experience in the local market to maximize your investment's performance.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Tenant Satisfaction</h3>
              <p className="text-gray-600">We prioritize tenant satisfaction to ensure lower vacancy rates and higher retention for property owners.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Transparent Reporting</h3>
              <p className="text-gray-600">Our detailed financial reporting and property status updates keep you informed about your investment.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
              Property Management Resources
            </h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Download our free guides to help property owners and tenants understand the benefits of professional property management.
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
            <h2 className="text-3xl font-bold mb-6 text-primary">Ready to Simplify Your Property Management?</h2>
            <p className="text-gray-600 mb-8">Whether you're a property owner looking for management services or a tenant searching for your next home, we're here to help.</p>
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