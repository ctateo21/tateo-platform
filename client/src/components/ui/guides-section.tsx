import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText, Download, ArrowRight } from "lucide-react";

export default function GuidesSection() {
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
    <section id="buyers-sellers" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-primary">
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
        
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold mb-6 text-primary">Need More Information?</h3>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">Our team of real estate experts is ready to answer all your questions and provide personalized guidance.</p>
          <Button asChild className="bg-secondary hover:bg-secondary/90 text-white">
            <Link href="/#contact">
              CONTACT <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}