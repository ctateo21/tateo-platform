import { Link } from "wouter";
import { Facebook, Twitter, Instagram, Linkedin, MapPin, Phone, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="bg-dark text-white/80 pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="text-xl font-bold text-white mb-4">Tateo & Co</h3>
            <p className="mb-4">Your one-stop solution for all real estate needs.</p>
            <div className="flex space-x-4">
              <a href="#" className="text-white hover:text-primary" aria-label="Facebook">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-white hover:text-primary" aria-label="Twitter">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-white hover:text-primary" aria-label="Instagram">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-white hover:text-primary" aria-label="LinkedIn">
                <Linkedin size={20} />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Services</h4>
            <ul className="space-y-2">
              <li><Link href="/#services" className="hover:text-primary">Real Estate</Link></li>
              <li><Link href="/#services" className="hover:text-primary">Mortgage</Link></li>
              <li><Link href="/#services" className="hover:text-primary">Insurance</Link></li>
              <li><Link href="/#services" className="hover:text-primary">Construction</Link></li>
              <li><Link href="/#services" className="hover:text-primary">Property Management</Link></li>
              <li><Link href="/#services" className="hover:text-primary">Home Services</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-primary">Blog</a></li>
              <li><a href="#" className="hover:text-primary">Market Reports</a></li>
              <li><a href="#" className="hover:text-primary">Buying Guide</a></li>
              <li><a href="#" className="hover:text-primary">Selling Tips</a></li>
              <li><a href="#" className="hover:text-primary">Mortgage Calculator</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-2">
              <li className="flex items-center">
                <MapPin className="mr-2 h-4 w-4" />
                123 Main Street, Suite 100
              </li>
              <li className="flex items-center">
                <Phone className="mr-2 h-4 w-4" />
                (555) 123-4567
              </li>
              <li className="flex items-center">
                <Mail className="mr-2 h-4 w-4" />
                info@tateoandco.com
              </li>
            </ul>
          </div>
        </div>
        
        <Separator className="bg-white/20" />
        
        <div className="pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p>&copy; {new Date().getFullYear()} Tateo & Co. All rights reserved.</p>
            <div className="mt-4 md:mt-0 flex space-x-6">
              <a href="#" className="hover:text-primary">Privacy Policy</a>
              <a href="#" className="hover:text-primary">Terms of Service</a>
              <a href="#" className="hover:text-primary">Sitemap</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
