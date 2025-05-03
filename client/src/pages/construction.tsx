import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight, Home, Building, HardHat, PaintBucket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Construction() {  
  const resources = [
    {
      title: "New Construction Guide",
      description: "Everything you need to know about building a new home from the ground up, from planning to completion.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Construction Guide",
      link: "#"
    },
    {
      title: "Renovation Planning Guide",
      description: "Learn how to plan, budget, and execute successful renovation projects that add value to your property.",
      icon: <FileText className="h-10 w-10 text-primary" />,
      cta: "Download Renovation Guide",
      link: "#"
    }
  ];

  const constructionServices = [
    {
      title: "New Home Construction",
      description: "Custom home building services with attention to detail and quality craftsmanship from foundation to finishing touches.",
      icon: <Home className="h-10 w-10 text-primary" />
    },
    {
      title: "Home Renovations",
      description: "Transform your existing space with expert renovations that enhance functionality, aesthetics, and value.",
      icon: <Building className="h-10 w-10 text-primary" />
    },
    {
      title: "Structural Improvements",
      description: "Strengthen and enhance your property with quality structural upgrades and improvements.",
      icon: <HardHat className="h-10 w-10 text-primary" />
    },
    {
      title: "Interior & Exterior Finishing",
      description: "Professional finishing services including painting, flooring, cabinetry, and exterior details.",
      icon: <PaintBucket className="h-10 w-10 text-primary" />
    }
  ];

  return (
    <div>
      <Helmet>
        <title>Construction Services | Tateo & Co</title>
      </Helmet>

      <div className="py-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Construction Services</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            From new home construction to renovations and remodeling, our construction experts can bring your vision to life with quality craftsmanship and attention to detail.
          </p>
        </div>
      </div>
      
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">Our Construction Services</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Whether you're building a new home from the ground up or renovating your current property, our experienced construction team delivers exceptional results.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {constructionServices.map((service, index) => (
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
            <h2 className="text-3xl font-bold text-primary mb-4">Why Choose Us for Construction</h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <HardHat className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Experienced Team</h3>
              <p className="text-gray-600">Our construction professionals bring years of experience and expertise to every project, large or small.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <Building className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Quality Materials</h3>
              <p className="text-gray-600">We use only the highest quality materials to ensure durability, efficiency, and lasting beauty in every project.</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="mb-4">
                <div className="bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                  <ArrowRight className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">On-Time, On-Budget</h3>
              <p className="text-gray-600">We pride ourselves on completing projects according to schedule and within the agreed-upon budget.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary">
              Construction Resources
            </h2>
            <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Download our free guides to help you plan your construction or renovation project effectively.
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
            <h2 className="text-3xl font-bold mb-6 text-primary">Ready to Start Your Construction Project?</h2>
            <p className="text-gray-600 mb-8">Our construction team is ready to help bring your vision to life with quality craftsmanship and attention to detail.</p>
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