import { useState } from "react";
import { Link } from "wouter";
import { Menu, PhoneCall, Home, Building2, Briefcase, LayoutDashboard, Shield, HelpCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: "/", label: "HOME", icon: <Home className="mr-2 h-4 w-4" /> },
    { 
      href: "/#services", 
      label: "SERVICES", 
      icon: <Briefcase className="mr-2 h-4 w-4" />, 
      hasDropdown: true,
      dropdownItems: [
        { href: "/real-estate", label: "Real Estate" },
        { href: "/mortgage", label: "Mortgage" },
        { href: "/insurance", label: "Insurance" },
        { href: "/construction", label: "Construction" },
        { href: "/property-management", label: "Property Management" },
        { href: "/home-services", label: "Home Services" }
      ]
    },
    { href: "/review", label: "REVIEWS", icon: <HelpCircle className="mr-2 h-4 w-4" /> },
    { href: "/#about", label: "ABOUT", icon: <Building2 className="mr-2 h-4 w-4" /> },
  ];

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      {/* Top Bar */}
      <div className="bg-primary py-2 text-white">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="text-sm hidden md:block">
            <span className="mr-4">123 Main Street, City, State</span>
            <span>(555) 123-4567</span>
          </div>
          <div className="flex items-center space-x-4">
            <a href="mailto:info@tateoco.com" className="text-white hover:text-white/80 text-sm">
              info@tateoco.com
            </a>
            <a href="#" className="text-white hover:text-white/80">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
              </svg>
            </a>
            <a href="#" className="text-white hover:text-white/80">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
            </a>
          </div>
        </div>
      </div>
      
      {/* Main Navigation */}
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <div className="bg-primary px-3 py-2 rounded-md mr-2">
              <span className="text-white font-bold text-sm">Tateo & Co</span>
            </div>
          </Link>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          {links.map((link) => (
            link.hasDropdown ? (
              <DropdownMenu key={link.label}>
                <DropdownMenuTrigger className="text-gray-700 hover:text-primary font-medium text-sm uppercase tracking-wide py-2 focus:outline-none flex items-center">
                  {link.label} <ChevronDown className="ml-1 h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  {link.dropdownItems?.map((item) => (
                    <DropdownMenuItem key={item.label} asChild>
                      <Link href={item.href} className="w-full cursor-pointer">
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link 
                key={link.label} 
                href={link.href}
                className="text-gray-700 hover:text-primary font-medium text-sm uppercase tracking-wide py-2"
              >
                {link.label}
              </Link>
            )
          ))}
          <Button asChild className="bg-black hover:bg-gray-800 text-white border border-black">
            <Link href="/#schedule">
              Schedule a Call
            </Link>
          </Button>
        </nav>
        
        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <div className="flex items-center mb-6">
              <div className="bg-primary px-3 py-2 rounded-md mr-2">
                <span className="text-white font-bold text-sm">Tateo & Co</span>
              </div>
            </div>
            <nav className="flex flex-col space-y-6">
              {links.map((link) => (
                <div key={link.label}>
                  {link.hasDropdown ? (
                    <>
                      <div className="flex items-center text-lg font-medium text-gray-700 mb-2">
                        {link.icon}
                        {link.label}
                      </div>
                      <div className="ml-8 space-y-3">
                        {link.dropdownItems?.map((item) => (
                          <Link 
                            key={item.label} 
                            href={item.href}
                            className="block text-gray-600 hover:text-primary"
                            onClick={() => setIsOpen(false)}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Link 
                      href={link.href}
                      className="flex items-center text-lg font-medium text-gray-700"
                      onClick={() => setIsOpen(false)}
                    >
                      {link.icon}
                      {link.label}
                    </Link>
                  )}
                </div>
              ))}
              <Button asChild className="bg-black hover:bg-gray-800 text-white border border-black w-full mt-4">
                <Link href="/#schedule">
                  Schedule a Call
                </Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
