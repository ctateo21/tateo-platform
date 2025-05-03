import { Home, DollarSign, UserCheck, Zap, Shield, Settings } from "lucide-react";

export default function FeaturesSection() {
  const features = [
    {
      icon: <Home className="text-primary text-xl" />,
      title: "All-in-One Solution",
      description: "Access all your real estate needs in one place, from buying to managing properties."
    },
    {
      icon: <DollarSign className="text-primary text-xl" />,
      title: "Cost Savings",
      description: "Save money with our bundled services and competitive rates across all offerings."
    },
    {
      icon: <UserCheck className="text-primary text-xl" />,
      title: "Expert Guidance",
      description: "Work with industry professionals who understand all aspects of real estate."
    },
    {
      icon: <Zap className="text-primary text-xl" />,
      title: "Streamlined Process",
      description: "Experience a smooth, efficient process from start to finish with our integrated services."
    },
    {
      icon: <Shield className="text-primary text-xl" />,
      title: "Comprehensive Protection",
      description: "Get complete coverage with our insurance and property management services."
    },
    {
      icon: <Settings className="text-primary text-xl" />,
      title: "Customized Solutions",
      description: "Receive personalized service packages tailored to your specific needs and goals."
    }
  ];

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Tateo & Co</h2>
          <p className="text-lg text-foreground/70 max-w-2xl mx-auto">We provide comprehensive real estate solutions all under one roof, saving you time and money.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-background p-6 rounded-lg">
              <div className="feature-icon">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-foreground/70">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
