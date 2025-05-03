import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PhoneCall, MessageCircle, ArrowRight } from "lucide-react";

export default function CTASection() {
  return (
    <section id="contact" className="py-20 relative bg-gradient-to-r from-primary to-primary/80 text-white">
      <div className="absolute inset-0 bg-opacity-90 bg-pattern"></div>
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Take the Next Step in Your Real Estate Journey?
            </h2>
            <p className="text-white/80 mb-8 text-lg leading-relaxed">
              Whether you're looking to buy, sell, finance, insure, build, or manage a property, our team of experts is here to guide you every step of the way.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="bg-white text-primary hover:bg-white/90">
                <a href="tel:5551234567">
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Call Us Today
                </a>
              </Button>

            </div>
          </div>
          
          <div className="bg-white rounded-lg p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-primary mb-6">Our Promise to You</h3>
            <ul className="space-y-4">
              <li className="flex items-start">
                <ArrowRight className="text-secondary mr-3 h-5 w-5 mt-0.5" />
                <span className="text-gray-700">Personalized service tailored to your unique needs</span>
              </li>
              <li className="flex items-start">
                <ArrowRight className="text-secondary mr-3 h-5 w-5 mt-0.5" />
                <span className="text-gray-700">Transparent communication throughout the process</span>
              </li>
              <li className="flex items-start">
                <ArrowRight className="text-secondary mr-3 h-5 w-5 mt-0.5" />
                <span className="text-gray-700">Expert guidance from experienced professionals</span>
              </li>
              <li className="flex items-start">
                <ArrowRight className="text-secondary mr-3 h-5 w-5 mt-0.5" />
                <span className="text-gray-700">Commitment to achieving your real estate goals</span>
              </li>
            </ul>
            <div className="mt-8 pt-6 border-t border-gray-200">
              <Button asChild className="w-full bg-secondary hover:bg-secondary/90 text-white">
                <Link href="/#contact">
                  CONTACT
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}