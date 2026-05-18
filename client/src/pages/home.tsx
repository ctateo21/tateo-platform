import { useEffect } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";
import HeroSection from "@/components/ui/hero-section";
import { useAuth } from "@/context/auth-context";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user]);

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
