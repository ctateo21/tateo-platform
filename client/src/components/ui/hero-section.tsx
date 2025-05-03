import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="relative bg-[#0c3a56] text-white">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://www.tateoco.com/wp-content/uploads/2021/09/AdobeStock_242825611-1-scaled.jpeg" 
          alt="Tateo & Co Real Estate" 
          className="w-full h-full object-cover opacity-30"
        />
      </div>
      <div className="container mx-auto px-4 py-24 md:py-32 relative z-10">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="text-secondary">Tateo & Co</span> <br />
            <span>Real Estate Services</span>
          </h1>
          <p className="text-xl mb-8 text-gray-100">Your one-stop solution for real estate, mortgage, insurance, construction, property management, and home services.</p>
          <div className="flex gap-4 flex-wrap">
            <Button
              asChild
              size="lg"
              className="bg-secondary hover:bg-secondary/90 text-white font-medium"
            >
              <Link href="#services">
                Explore Our Services
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
            >
              <Link href="#about">
                About Us
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
