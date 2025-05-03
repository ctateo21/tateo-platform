import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function CTASection() {
  return (
    <section className="py-16 bg-dark text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
        <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
          Let us help you navigate your real estate journey. Select your services above or contact us directly.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white font-medium"
          >
            <Link href="#services">
              Explore Services
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="bg-white hover:bg-gray-100 text-dark font-medium"
          >
            <Link href="#contact">
              Contact Us
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
