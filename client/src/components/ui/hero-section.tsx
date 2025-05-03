import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="relative bg-dark text-white">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80" 
          alt="Modern real estate buildings" 
          className="w-full h-full object-cover opacity-40"
        />
      </div>
      <div className="container mx-auto px-4 py-20 md:py-24 relative z-10">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Your One-Stop Solution for All Things Real Estate</h1>
          <p className="text-xl mb-8">From buying and selling to mortgages, insurance, and property management - we've got you covered.</p>
          <Button
            asChild
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white font-medium"
          >
            <Link href="#services">
              Explore Our Services
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
