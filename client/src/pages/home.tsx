import { Helmet } from "react-helmet";
import HeroSection from "@/components/ui/hero-section";
import ServiceSelector from "@/components/services/service-selector";
import CTASection from "@/components/ui/cta-section";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Tateo & Co - Your One-Stop Real Estate Solution</title>
        <meta name="description" content="From buying and selling to mortgages, insurance, and property management - we've got you covered." />
      </Helmet>
      
      <HeroSection />
      <ServiceSelector />
      <CTASection />
    </>
  );
}
