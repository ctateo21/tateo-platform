import { Link } from "wouter";
import { Facebook, Instagram, Linkedin, MapPin, Phone, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="bg-[#123764] text-white/80 pt-12 pb-6">
      <div className="container mx-auto px-4">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8 mb-12">
          {/* Column 1: Company & Social */}
          <div className="lg:col-span-1">
            <div className="flex items-center mb-6">
              <div className="bg-white px-3 py-2 rounded-md mr-2">
                <span className="text-[#123764] font-bold text-xl">Tateo & Co</span>
              </div>
            </div>
            <p className="mb-6 text-white/80 leading-relaxed">
              Your trusted partner for all real estate needs. We provide comprehensive services to make your real estate journey smooth and successful.
            </p>
            <div className="flex space-x-4 mb-6">
              <a href="https://www.facebook.com/tateoco" target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-[#f58634] h-10 w-10 rounded-full flex items-center justify-center transition-colors" aria-label="Facebook">
                <Facebook size={18} className="text-white" />
              </a>
              <a href="https://www.instagram.com/tateocommunities/" target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-[#f58634] h-10 w-10 rounded-full flex items-center justify-center transition-colors" aria-label="Instagram">
                <Instagram size={18} className="text-white" />
              </a>
              <a href="https://www.linkedin.com/company/tateo-co/" target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-[#f58634] h-10 w-10 rounded-full flex items-center justify-center transition-colors" aria-label="LinkedIn">
                <Linkedin size={18} className="text-white" />
              </a>
            </div>
          </div>
          
          {/* Column 2: Contact Info */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start">
                <MapPin className="mr-3 h-5 w-5 text-[#f58634] shrink-0 mt-0.5" />
                <span className="text-white/70">4900 Main Street, Suite 100<br />Kansas City, MO 64112</span>
              </li>
              <li className="flex items-center">
                <Phone className="mr-3 h-5 w-5 text-[#f58634]" />
                <a href="tel:+18168959500" className="text-white/70 hover:text-[#f58634]">(816) 895-9500</a>
              </li>
              <li className="flex items-center">
                <Mail className="mr-3 h-5 w-5 text-[#f58634]" />
                <a href="mailto:info@tateoco.com" className="text-white/70 hover:text-[#f58634]">info@tateoco.com</a>
              </li>
            </ul>
          </div>
          
          {/* Column 3: Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-6">Quick Links</h4>
            <div className="grid grid-cols-1 gap-3">
              <Link href="/real-estate" className="text-white/70 hover:text-[#f58634]">
                Real Estate
              </Link>
              <Link href="/#services" className="text-white/70 hover:text-[#f58634]">
                Mortgage
              </Link>
              <Link href="/#services" className="text-white/70 hover:text-[#f58634]">
                Insurance
              </Link>
              <Link href="/#services" className="text-white/70 hover:text-[#f58634]">
                Property Management
              </Link>
              <Link href="/#services" className="text-white/70 hover:text-[#f58634]">
                Construction
              </Link>
              <Link href="/#services" className="text-white/70 hover:text-[#f58634]">
                Home Services
              </Link>
            </div>
          </div>
          
          {/* Column 4: Business Hours */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-6">Business Hours</h4>
            <ul className="space-y-2">
              <li className="flex justify-between">
                <span className="text-white/70">Monday - Friday:</span>
                <span className="text-white">9:00 AM - 5:00 PM</span>
              </li>
              <li className="flex justify-between">
                <span className="text-white/70">Saturday:</span>
                <span className="text-white">By Appointment</span>
              </li>
              <li className="flex justify-between">
                <span className="text-white/70">Sunday:</span>
                <span className="text-white">Closed</span>
              </li>
            </ul>
          </div>
        </div>
        
        <Separator className="bg-white/10" />
        
        {/* Bottom Footer */}
        <div className="pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6 mb-4 md:mb-0">
              <p className="text-white/60">&copy; {new Date().getFullYear()} Tateo & Co. All rights reserved.</p>
              <div className="flex space-x-6">
                <a href="#" className="text-white/60 hover:text-[#f58634]">Privacy Policy</a>
                <a href="#" className="text-white/60 hover:text-[#f58634]">Terms of Service</a>
              </div>
            </div>
            <div className="text-white/60 text-sm">
              <span>Powered by React & Express | Designed with 💙 by Tateo Tech</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
