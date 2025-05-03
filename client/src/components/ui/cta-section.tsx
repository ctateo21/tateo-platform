import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PhoneCall, Mail } from "lucide-react";

export default function CTASection() {
  return (
    <section className="py-20 relative">
      {/* Background with diagonal split */}
      <div className="absolute inset-0 z-0">
        <div className="h-full w-full bg-gradient-to-r from-primary to-primary/90"></div>
        <div className="absolute top-0 bottom-0 right-0 w-7/12 clip-path-polygon-[0_0,100%_0,100%_100%,25%_100%] bg-accent"></div>
      </div>
      
      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="bg-white p-10 rounded-lg shadow-xl max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-primary">Ready to Get Started?</h2>
          <div className="w-20 h-1 bg-secondary mx-auto mb-6"></div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Let us help you navigate your real estate journey. Select your services above or contact us directly.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="flex flex-col items-center p-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <PhoneCall className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Call Us</h3>
              <p className="text-gray-600">(555) 123-4567</p>
            </div>
            
            <div className="flex flex-col items-center p-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Email Us</h3>
              <p className="text-gray-600">info@tateoco.com</p>
            </div>
            
            <div className="flex flex-col items-center p-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Visit Us</h3>
              <p className="text-gray-600">123 Main Street, City, State</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-secondary hover:bg-secondary/90 text-white font-medium"
            >
              <Link href="#services">
                Explore Services
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary text-primary hover:bg-primary/5 font-medium"
            >
              <Link href="/questionnaire">
                Start Questionnaire
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
