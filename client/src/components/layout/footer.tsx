import { Link } from "wouter";
import { Facebook, Twitter, Instagram, Linkedin, MapPin, Phone, Mail, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export default function Footer() {
  return (
    <footer className="bg-[#0c3a56] text-white/80 pt-16 pb-8">
      {/* Newsletter Section */}
      <div className="container mx-auto px-4 mb-16">
        <div className="bg-primary/20 rounded-lg p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">Stay Updated</h3>
              <p className="text-white/90">Subscribe to our newsletter to receive the latest real estate news, tips, and exclusive offers.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="email" 
                placeholder="Your email address" 
                className="px-4 py-3 rounded-md flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
              <Button className="bg-secondary hover:bg-secondary/90 text-white px-6">
                Subscribe
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-16">
          <div>
            <div className="flex items-center mb-6">
              <div className="bg-secondary px-3 py-2 rounded-md mr-2">
                <span className="text-white font-bold text-xl">T&C</span>
              </div>
              <span className="text-white font-bold text-xl">Tateo & Co</span>
            </div>
            <p className="mb-6 text-white/80 leading-relaxed">Your trusted partner for all real estate needs. We provide comprehensive services to make your real estate journey smooth and successful.</p>
            <div className="flex space-x-4">
              <a href="#" className="bg-white/10 hover:bg-white/20 h-10 w-10 rounded-full flex items-center justify-center transition-colors" aria-label="Facebook">
                <Facebook size={18} className="text-white" />
              </a>
              <a href="#" className="bg-white/10 hover:bg-white/20 h-10 w-10 rounded-full flex items-center justify-center transition-colors" aria-label="Twitter">
                <Twitter size={18} className="text-white" />
              </a>
              <a href="#" className="bg-white/10 hover:bg-white/20 h-10 w-10 rounded-full flex items-center justify-center transition-colors" aria-label="Instagram">
                <Instagram size={18} className="text-white" />
              </a>
              <a href="#" className="bg-white/10 hover:bg-white/20 h-10 w-10 rounded-full flex items-center justify-center transition-colors" aria-label="LinkedIn">
                <Linkedin size={18} className="text-white" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-6">Our Services</h4>
            <ul className="space-y-3">
              <li>
                <Link 
                  href="/#services"
                  className="flex items-center text-white/70 hover:text-secondary"
                >
                  <ChevronRight className="mr-2 h-4 w-4 text-secondary" />
                  Real Estate
                </Link>
              </li>
              <li>
                <Link 
                  href="/#services"
                  className="flex items-center text-white/70 hover:text-secondary"
                >
                  <ChevronRight className="mr-2 h-4 w-4 text-secondary" />
                  Mortgage
                </Link>
              </li>
              <li>
                <Link 
                  href="/#services"
                  className="flex items-center text-white/70 hover:text-secondary"
                >
                  <ChevronRight className="mr-2 h-4 w-4 text-secondary" />
                  Insurance
                </Link>
              </li>
              <li>
                <Link 
                  href="/#services"
                  className="flex items-center text-white/70 hover:text-secondary"
                >
                  <ChevronRight className="mr-2 h-4 w-4 text-secondary" />
                  Construction
                </Link>
              </li>
              <li>
                <Link 
                  href="/#services"
                  className="flex items-center text-white/70 hover:text-secondary"
                >
                  <ChevronRight className="mr-2 h-4 w-4 text-secondary" />
                  Property Management
                </Link>
              </li>
              <li>
                <Link 
                  href="/#services"
                  className="flex items-center text-white/70 hover:text-secondary"
                >
                  <ChevronRight className="mr-2 h-4 w-4 text-secondary" />
                  Home Services
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-6">Resources</h4>
            <ul className="space-y-3">
              <li>
                <a href="#" className="flex items-center text-white/70 hover:text-secondary">
                  <ChevronRight className="mr-2 h-4 w-4 text-secondary" />
                  Buyer's Guide
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center text-white/70 hover:text-secondary">
                  <ChevronRight className="mr-2 h-4 w-4 text-secondary" />
                  Seller's Guide
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center text-white/70 hover:text-secondary">
                  <ChevronRight className="mr-2 h-4 w-4 text-secondary" />
                  Mortgage Calculator
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center text-white/70 hover:text-secondary">
                  <ChevronRight className="mr-2 h-4 w-4 text-secondary" />
                  Market Reports
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center text-white/70 hover:text-secondary">
                  <ChevronRight className="mr-2 h-4 w-4 text-secondary" />
                  Blog
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start">
                <MapPin className="mr-3 h-5 w-5 text-secondary shrink-0 mt-0.5" />
                <span className="text-white/70">123 Main Street, Suite 100<br />City, State 12345</span>
              </li>
              <li className="flex items-center">
                <Phone className="mr-3 h-5 w-5 text-secondary" />
                <span className="text-white/70">(555) 123-4567</span>
              </li>
              <li className="flex items-center">
                <Mail className="mr-3 h-5 w-5 text-secondary" />
                <span className="text-white/70">info@tateoco.com</span>
              </li>
            </ul>
          </div>
        </div>
        
        <Separator className="bg-white/10" />
        
        <div className="pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-white/60">&copy; {new Date().getFullYear()} Tateo & Co. All rights reserved.</p>
            <div className="mt-4 md:mt-0 flex space-x-6">
              <a href="#" className="text-white/60 hover:text-secondary">Privacy Policy</a>
              <a href="#" className="text-white/60 hover:text-secondary">Terms of Service</a>
              <a href="#" className="text-white/60 hover:text-secondary">Sitemap</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
