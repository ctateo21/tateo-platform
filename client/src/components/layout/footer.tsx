import { Link } from "wouter";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import barrettLogo from "@assets/barrett-financial-group.png";

export default function Footer() {
  return (
    <footer className="bg-[#0F1B3D] text-white pt-16 pb-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Column 1: Company Info */}
          <div className="col-span-1 lg:col-span-1">
            <div className="mb-7">
              <span className="text-white font-display font-extrabold text-5xl tracking-tight">
                havo<span className="text-primary">.</span>
              </span>
            </div>
            <p className="mb-7 text-white/90 leading-relaxed text-base">
              Our mission is to provide unparalleled expertise and comprehensive support to clients in every step of their real
              estate journey. With Havo, you benefit from a team that knows every aspect of the real estate, mortgage,
              insurance, & solar industry.
            </p>
            <div className="flex space-x-2 mb-6">
              <a href="https://www.facebook.com/tateoco" target="_blank" rel="noopener noreferrer" 
                 className="bg-[#00B6A9] h-8 w-8 rounded-full flex items-center justify-center transition-colors" aria-label="Facebook">
                <Facebook size={16} className="text-[#0F1B3D]" />
              </a>
              <a href="https://www.instagram.com/tateocommunities/" target="_blank" rel="noopener noreferrer" 
                 className="bg-[#00B6A9] h-8 w-8 rounded-full flex items-center justify-center transition-colors" aria-label="Instagram">
                <Instagram size={16} className="text-[#0F1B3D]" />
              </a>
              <a href="https://www.linkedin.com/company/tateo-co/" target="_blank" rel="noopener noreferrer" 
                 className="bg-[#00B6A9] h-8 w-8 rounded-full flex items-center justify-center transition-colors" aria-label="LinkedIn">
                <Linkedin size={16} className="text-[#0F1B3D]" />
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer" 
                 className="bg-[#00B6A9] h-8 w-8 rounded-full flex items-center justify-center transition-colors" aria-label="Youtube">
                <Youtube size={16} className="text-[#0F1B3D]" />
              </a>
            </div>

            {/* Powered by Barrett Financial Group LLC */}
            <div className="flex flex-col items-center md:items-start gap-2">
              <a href="https://www.barrettfinancial.com" target="_blank" rel="noopener noreferrer"
                 className="inline-block bg-white rounded-md p-2">
                <img
                  src={barrettLogo}
                  alt="Powered by Barrett Financial Group LLC"
                  className="w-auto h-auto max-w-[180px] md:max-w-[200px]"
                />
              </a>
              <span className="text-white/70 text-xs">Powered by Barrett Financial Group LLC</span>
            </div>
          </div>
          
          {/* Column 2: Paul Christian Tateo Info */}
          <div className="col-span-1 lg:col-span-1">
            <div className="space-y-10">
              <div>
                <h5 className="font-medium text-white">Christian Tateo</h5>
                <p className="text-white/80 text-sm">(239) 580-7786</p>
                <p className="text-white/80 text-sm">Havo</p>
                <a href="mailto:christian@tateoco.com" className="text-white/80 text-sm hover:text-[#00B6A9]">christian@tateoco.com</a>
              </div>
              
              <div>
                <h5 className="font-medium text-white">Paul Christian Tateo PA</h5>
                <p className="text-white/80 text-sm">Realtor</p>
                <p className="text-white/80 text-sm">SL3502339</p>
                <p className="text-white/80 text-sm">Licensed in FL</p>
                <a href="http://www.marconaplesliving.com" target="_blank" rel="noopener noreferrer" className="text-white/80 text-sm hover:text-[#00B6A9]">Horizons By The Sea, Inc</a>
              </div>
            </div>
          </div>

          {/* Column 3: Additional License Info */}
          <div className="col-span-1 lg:col-span-1">
            <div className="space-y-10">
              <div>
                <h5 className="font-medium text-white">Mortgage Loan Originator</h5>
                <p className="text-white/80 text-sm">NMLS #1223755</p>
                <p className="text-white/80 text-sm">Licensed in Multiple States</p>
                <a href="http://www.barrettfinancial.com" target="_blank" rel="noopener noreferrer" className="text-white/80 text-sm hover:text-[#00B6A9]">Barrett Financial Group, LLC</a>
              </div>

              <div>
                <h5 className="font-medium text-white">Tateo Insurance Corp</h5>
                <p className="text-white/80 text-sm">L132640</p>
                <p className="text-white/80 text-sm">2105 - Licensed Insurance Agency</p>
                <p className="text-white/80 text-sm">Paul Christian Tateo</p>
                <p className="text-white/80 text-sm">W142842</p>
                <p className="text-white/80 text-sm">0220 - Licensed Insurance Agent</p>
              </div>
            </div>
          </div>
          
          {/* Column 4: Resources & Legal */}
          <div>
            <div className="mb-8">
              <h4 className="text-xl font-semibold text-[#00B6A9] mb-4">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/contact" className="text-white/90 hover:text-[#00B6A9]">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/meet-the-team" className="text-white/90 hover:text-[#00B6A9]">
                    Meet the Team
                  </Link>
                </li>
                <li>
                  <Link href="/real-estate-buyers-guide" className="text-white/90 hover:text-[#00B6A9]">
                    RE Buyer's Guide
                  </Link>
                </li>
                <li>
                  <Link href="/real-estate-sellers-guide" className="text-white/90 hover:text-[#00B6A9]">
                    RE Seller's Guide
                  </Link>
                </li>
                <li>
                  <Link href="/mortgage-calculator" className="text-white/90 hover:text-[#00B6A9]">
                    Mortgage Calculator
                  </Link>
                </li>
                <li>
                  <Link href="/insurance-pricing" className="text-white/90 hover:text-[#00B6A9]">
                    Insurance Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/select-service" className="text-white/90 hover:text-[#00B6A9]">
                    Prop Mgmt / Rentals
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-xl font-semibold text-[#00B6A9] mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/terms-conditions" className="text-white/90 hover:text-[#00B6A9]">
                    Terms & Conditions
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-policy" className="text-white/90 hover:text-[#00B6A9]">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/accessibility" className="text-white/90 hover:text-[#00B6A9]">
                    Accessibility
                  </Link>
                </li>
                <li>
                  <Link href="/sitemap" className="text-white/90 hover:text-[#00B6A9]">
                    Sitemap
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Diagonal Stripe Footer Decoration */}
        <div className="w-full h-6 overflow-hidden relative mt-8">
          <div className="absolute bottom-0 right-0 w-full h-12 bg-[#00B6A9]/20" 
               style={{
                 clipPath: "polygon(0 100%, 100% 0, 100% 100%, 0% 100%)",
                 background: "repeating-linear-gradient(45deg, rgba(0, 182, 169, 0.2), rgba(0, 182, 169, 0.2) 10px, rgba(0, 182, 169, 0.35) 10px, rgba(0, 182, 169, 0.35) 20px)"
               }}>
          </div>
        </div>
      </div>
    </footer>
  );
}
