import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export default function HeroSection() {
  const slide = {
    title: "One Guide. Every Home Decision.",
    description: "Buyers waste weeks chasing answers and don't know who to trust. With me, one conversation replaces agents, lenders, and insurers — so you avoid mistakes, protect your money, and close fast.",
    ctaText: "Explore Our Services",
    ctaLink: "/#services",
    bgClass: "bg-gradient-to-r from-primary to-primary/80"
  };

  return (
    <section className="relative min-h-[400px] flex items-center">
      <div className={`absolute inset-0 ${slide.bgClass}`}>
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="container mx-auto px-4 py-16 relative z-10 h-full flex items-center">
          <div className="max-w-3xl text-white">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
              {slide.title}
            </h1>
            <p className="text-base md:text-lg text-white/90 mb-6 max-w-2xl">
              {slide.description}
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-secondary hover:bg-secondary/90 text-white">
                <Link href={slide.ctaLink}>
                  {slide.ctaText} <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}