import { Home, DollarSign, UserCheck, Zap, Shield, Settings } from "lucide-react";

export default function FeaturesSection() {
  const features = [
    {
      icon: <Home className="text-secondary text-xl" />,
      title: "All-in-One Solution",
      description: "Access all your real estate needs in one place, from buying to managing properties."
    },
    {
      icon: <DollarSign className="text-secondary text-xl" />,
      title: "Cost Savings",
      description: "Save money with our bundled services and competitive rates across all offerings."
    },
    {
      icon: <UserCheck className="text-secondary text-xl" />,
      title: "Expert Guidance",
      description: "Work with industry professionals who understand all aspects of real estate."
    },
    {
      icon: <Zap className="text-secondary text-xl" />,
      title: "Streamlined Process",
      description: "Experience a smooth, efficient process from start to finish with our integrated services."
    },
    {
      icon: <Shield className="text-secondary text-xl" />,
      title: "Comprehensive Protection",
      description: "Get complete coverage with our insurance and property management services."
    },
    {
      icon: <Settings className="text-secondary text-xl" />,
      title: "Customized Solutions",
      description: "Receive personalized service packages tailored to your specific needs and goals."
    }
  ];

  return (
    <section id="about" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-primary">Why Choose Tateo & Co</h2>
          <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">We provide comprehensive real estate solutions all under one roof, saving you time and money.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="p-8 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="feature-icon bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-primary">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
