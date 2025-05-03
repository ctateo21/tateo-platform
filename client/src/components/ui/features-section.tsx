import { 
  Home, 
  Building, 
  Shield, 
  Hammer, 
  BarChart4, 
  Wrench,
  Check
} from "lucide-react";

export default function FeaturesSection() {
  const features = [
    {
      title: "Real Estate Services",
      description: "Expert guidance on buying, selling, and investing in properties across the market.",
      icon: <Home className="h-10 w-10 text-primary" />,
      benefits: [
        "Market analysis and property valuation",
        "Strategic marketing for sellers",
        "Property search and negotiation for buyers",
        "Investment property consultation"
      ]
    },
    {
      title: "Mortgage Financing",
      description: "Competitive rates and flexible terms for all your home financing needs.",
      icon: <Building className="h-10 w-10 text-primary" />,
      benefits: [
        "Personalized loan options",
        "Refinancing opportunities",
        "First-time homebuyer programs",
        "Cash-out refinance solutions"
      ]
    },
    {
      title: "Insurance Protection",
      description: "Comprehensive coverage to protect your valuable assets and investments.",
      icon: <Shield className="h-10 w-10 text-primary" />,
      benefits: [
        "Homeowners insurance",
        "Auto insurance",
        "Umbrella policies",
        "Life and disability coverage"
      ]
    },
    {
      title: "Construction Services",
      description: "Quality construction and renovation services for residential and commercial properties.",
      icon: <Hammer className="h-10 w-10 text-primary" />,
      benefits: [
        "Custom home building",
        "Renovation and remodeling",
        "Project management",
        "Construction consulting"
      ]
    },
    {
      title: "Property Management",
      description: "Professional management services for rental properties and investment portfolios.",
      icon: <BarChart4 className="h-10 w-10 text-primary" />,
      benefits: [
        "Tenant screening and placement",
        "Rent collection and accounting",
        "Maintenance coordination",
        "Regular property inspections"
      ]
    },
    {
      title: "Home Services",
      description: "Reliable home services to keep your property in top condition year-round.",
      icon: <Wrench className="h-10 w-10 text-primary" />,
      benefits: [
        "Home maintenance",
        "Cleaning services",
        "Landscaping and lawn care",
        "HVAC and plumbing services"
      ]
    }
  ];

  return (
    <section id="features" className="py-12 pt-4 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-primary">
            Comprehensive Services
          </h2>
          <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            At Tateo & Co, we provide a full spectrum of real estate services to meet all your property needs.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-8 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="bg-primary/10 p-3 rounded-lg inline-block mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-primary mb-3">{feature.title}</h3>
              <p className="text-gray-600 mb-6">{feature.description}</p>
              <ul className="space-y-2">
                {feature.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start">
                    <Check className="h-5 w-5 text-secondary shrink-0 mr-2 mt-0.5" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}