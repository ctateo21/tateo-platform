import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const slides = [
    {
      title: "Your One-Stop Real Estate Solution",
      subtitle: "Comprehensive Services for Every Step of Your Journey",
      description: "From buying and selling to financing, insurance, construction, and property management, we handle all your real estate needs under one roof.",
      ctaText: "Explore Our Services",
      ctaLink: "/#services",
      bgClass: "bg-gradient-to-r from-primary to-primary/80"
    },
    {
      title: "Find Your Dream Home",
      subtitle: "Expert Real Estate Guidance",
      description: "Our experienced agents will help you navigate the market to find the perfect property that meets all your needs and budget.",
      ctaText: "Start Your Search",
      ctaLink: "/questionnaire",
      bgClass: "bg-gradient-to-r from-secondary to-secondary/80"
    },
    {
      title: "Finance Your Future",
      subtitle: "Competitive Mortgage Solutions",
      description: "Get personalized mortgage options with competitive rates and terms tailored to your financial situation.",
      ctaText: "Get Pre-Approved",
      ctaLink: "/questionnaire",
      bgClass: "bg-gradient-to-br from-primary to-secondary"
    }
  ];
  
  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  return (
    <section className="relative min-h-[600px] flex items-center">
      {/* Slides */}
      {slides.map((slide, index) => (
        <div 
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ${currentSlide === index ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${slide.bgClass}`}
        >
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="container mx-auto px-4 py-32 relative z-10 h-full flex items-center">
            <div className="max-w-3xl text-white">
              <div className="inline-block bg-secondary text-white text-sm font-semibold px-4 py-1 rounded-full mb-6">
                {slide.subtitle}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                {slide.title}
              </h1>
              <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl">
                {slide.description}
              </p>
              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="bg-secondary hover:bg-secondary/90 text-white">
                  <Link href={slide.ctaLink}>
                    {slide.ctaText} <ChevronRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  <Link href="/questionnaire">
                    Get In Touch
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {/* Slide Navigation */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 z-20">
        {slides.map((_, index) => (
          <button
            key={index}
            className={`w-2.5 h-2.5 rounded-full transition-all ${currentSlide === index ? 'bg-secondary w-8' : 'bg-white/50'}`}
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}