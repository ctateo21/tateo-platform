import { Helmet } from "react-helmet";
import HeroSection from "@/components/ui/hero-section";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Home Cost & Qualification Engine</title>
        <meta name="description" content="Enter any property address and instantly see your full cost to buy — mortgage, insurance, taxes, and qualification." />
      </Helmet>

      <HeroSection />
    </>
  );
}
