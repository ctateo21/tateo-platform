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
        <title>Havo — Every Step Home</title>
        <meta name="description" content="Enter any property address and instantly see your full cost to buy — mortgage, insurance, taxes, and qualification." />
        {/* Keep link-share previews (iMessage, Slack, social) branded. Apple's
            preview crawler runs JS, so these must mirror the static tags in
            index.html or the homepage title/image gets overridden. */}
        <meta property="og:title" content="Havo | Every Step Home" />
        <meta property="og:description" content="One home journey. Everyone together." />
        <meta property="og:image" content="https://havofl.com/havo-og-v1.png" />
        <meta name="twitter:title" content="Havo | Every Step Home" />
        <meta name="twitter:description" content="One home journey. Everyone together." />
        <meta name="twitter:image" content="https://havofl.com/havo-og-v1.png" />
      </Helmet>
      <HeroSection />
    </>
  );
}
