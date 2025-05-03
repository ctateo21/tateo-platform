import { Link } from "wouter";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#123764] text-white pt-16 pb-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Column 1: Company Info */}
          <div className="col-span-1 lg:col-span-1">
            <div className="mb-7">
              <span className="text-white font-bold text-5xl">TC</span>
            </div>
            <p className="mb-7 text-white/90 leading-relaxed text-base">
              Our mission is to provide unparalleled expertise and comprehensive support to clients in every step of their real
              estate journey. With Tateo & Co, you benefit from a team that knows every aspect of the real estate, mortgage,
              insurance, & solar industry.
            </p>
            <div className="flex space-x-2 mb-6">
              <a href="https://www.facebook.com/tateoco" target="_blank" rel="noopener noreferrer" 
                 className="bg-[#f6921e] h-8 w-8 rounded-full flex items-center justify-center transition-colors" aria-label="Facebook">
                <Facebook size={16} className="text-[#123764]" />
              </a>
              <a href="https://www.instagram.com/tateocommunities/" target="_blank" rel="noopener noreferrer" 
                 className="bg-[#f6921e] h-8 w-8 rounded-full flex items-center justify-center transition-colors" aria-label="Instagram">
                <Instagram size={16} className="text-[#123764]" />
              </a>
              <a href="https://www.linkedin.com/company/tateo-co/" target="_blank" rel="noopener noreferrer" 
                 className="bg-[#f6921e] h-8 w-8 rounded-full flex items-center justify-center transition-colors" aria-label="LinkedIn">
                <Linkedin size={16} className="text-[#123764]" />
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer" 
                 className="bg-[#f6921e] h-8 w-8 rounded-full flex items-center justify-center transition-colors" aria-label="Youtube">
                <Youtube size={16} className="text-[#123764]" />
              </a>
            </div>
          </div>
          
          {/* Column 2: License Info */}
          <div className="col-span-1 lg:col-span-1">
            <div className="space-y-6">
              <div>
                <h5 className="font-medium text-white">Paul Christian Tateo</h5>
                <p className="text-white/80 text-sm">CEO & Founder</p>
                <p className="text-white/80 text-sm">(239) 580-7786</p>
                <p className="text-white/80 text-sm">Tateo & Co.</p>
                <a href="mailto:christian@tateoco.com" className="text-white/80 text-sm hover:text-[#f6921e]">christian@tateoco.com</a>
              </div>
              
              <div>
                <h5 className="font-medium text-white">Paul Christian Tateo PA</h5>
                <p className="text-white/80 text-sm">SL3098399</p>
                <p className="text-white/80 text-sm">Licensed in FL</p>
                <p className="text-white/80 text-sm">Sponsored By The Zac, Inc</p>
                <a href="mailto:marcorealtor@mac.com" className="text-white/80 text-sm hover:text-[#f6921e]">marcorealtor@mac.com</a>
              </div>

              <div>
                <h5 className="font-medium text-white">Mortgage Originator</h5>
                <p className="text-white/80 text-sm">NMLS #1259745</p>
                <p className="text-white/80 text-sm">Licensed in FL & MO</p>
                <p className="text-white/80 text-sm">Barnett Financial LLC</p>
                <a href="http://www.barnettfinanced.com" target="_blank" rel="noopener noreferrer" className="text-white/80 text-sm hover:text-[#f6921e]">www.barnettfinanced.com</a>
              </div>

              <div>
                <h5 className="font-medium text-white">Insurance Agent</h5>
                <p className="text-white/80 text-sm">AM Insurance Group</p>
                <p className="text-white/80 text-sm">L123977</p>
                <p className="text-white/80 text-sm">Licensed in FL</p>
                <a href="http://www.aminsurancegroup.com" target="_blank" rel="noopener noreferrer" className="text-white/80 text-sm hover:text-[#f6921e]">www.aminsurancegroup.com</a>
              </div>
            </div>
          </div>
          
          {/* Column 3: Resources */}
          <div>
            <h4 className="text-xl font-semibold text-[#f6921e] mb-4">Resources</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/contact" className="text-white/90 hover:text-[#f6921e]">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/meet-the-team" className="text-white/90 hover:text-[#f6921e]">
                  Meet the Team
                </Link>
              </li>
              <li>
                <Link href="/real-estate-buyers-guide" className="text-white/90 hover:text-[#f6921e]">
                  RE Buyer's Guide
                </Link>
              </li>
              <li>
                <Link href="/real-estate-sellers-guide" className="text-white/90 hover:text-[#f6921e]">
                  RE Seller's Guide
                </Link>
              </li>
              <li>
                <Link href="/mortgage-calculator" className="text-white/90 hover:text-[#f6921e]">
                  Mortgage Calculator
                </Link>
              </li>
              <li>
                <Link href="/insurance-pricing" className="text-white/90 hover:text-[#f6921e]">
                  Insurance Pricing
                </Link>
              </li>
              <li>
                <Link href="/construction-bid" className="text-white/90 hover:text-[#f6921e]">
                  Construction Bid
                </Link>
              </li>
              <li>
                <Link href="/property-management" className="text-white/90 hover:text-[#f6921e]">
                  Prop Mgmt / Rentals
                </Link>
              </li>
              <li>
                <Link href="/home-services" className="text-white/90 hover:text-[#f6921e]">
                  Home Services
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Column 4: Services + Legal */}
          <div className="grid grid-cols-1 gap-8">
            <div>
              <h4 className="text-xl font-semibold text-[#f6921e] mb-4">Services</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/real-estate-buyers" className="text-white/90 hover:text-[#f6921e]">
                    Real Estate Buyers
                  </Link>
                </li>
                <li>
                  <Link href="/real-estate-sellers" className="text-white/90 hover:text-[#f6921e]">
                    Real Estate Sellers
                  </Link>
                </li>
                <li>
                  <Link href="/real-estate-investors" className="text-white/90 hover:text-[#f6921e]">
                    Real Estate Investors
                  </Link>
                </li>
                <li>
                  <Link href="/mortgage-purchase" className="text-white/90 hover:text-[#f6921e]">
                    Mortgage Purchase
                  </Link>
                </li>
                <li>
                  <Link href="/refinance" className="text-white/90 hover:text-[#f6921e]">
                    Refinance
                  </Link>
                </li>
                <li>
                  <Link href="/home-insurance" className="text-white/90 hover:text-[#f6921e]">
                    Home Insurance
                  </Link>
                </li>
                <li>
                  <Link href="/property-management" className="text-white/90 hover:text-[#f6921e]">
                    Property Management
                  </Link>
                </li>
                <li>
                  <Link href="/solar" className="text-white/90 hover:text-[#f6921e]">
                    Solar
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-xl font-semibold text-[#f6921e] mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/terms-conditions" className="text-white/90 hover:text-[#f6921e]">
                    Terms & Conditions
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-policy" className="text-white/90 hover:text-[#f6921e]">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/accessibility" className="text-white/90 hover:text-[#f6921e]">
                    Accessibility
                  </Link>
                </li>
                <li>
                  <Link href="/sitemap" className="text-white/90 hover:text-[#f6921e]">
                    Sitemap
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Diagonal Stripe Footer Decoration */}
        <div className="w-full h-6 overflow-hidden relative mt-8">
          <div className="absolute bottom-0 right-0 w-full h-12 bg-[#f6921e]/20" 
               style={{
                 clipPath: "polygon(0 100%, 100% 0, 100% 100%, 0% 100%)",
                 background: "repeating-linear-gradient(45deg, rgba(246, 146, 30, 0.2), rgba(246, 146, 30, 0.2) 10px, rgba(246, 146, 30, 0.3) 10px, rgba(246, 146, 30, 0.3) 20px)"
               }}>
          </div>
        </div>
      </div>
    </footer>
  );
}
