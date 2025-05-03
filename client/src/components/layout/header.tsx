import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, Home, BriefcaseBusiness, PhoneCall, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: "/", label: "Home", icon: <Home className="mr-2 h-4 w-4" /> },
    { href: "/#services", label: "Services", icon: <BriefcaseBusiness className="mr-2 h-4 w-4" /> },
    { href: "/#about", label: "About", icon: <Info className="mr-2 h-4 w-4" /> },
    { href: "/#contact", label: "Contact", icon: <PhoneCall className="mr-2 h-4 w-4" /> },
  ];

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/">
            <a className="text-primary font-bold text-2xl">Tateo & Co</a>
          </Link>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex space-x-8">
          {links.map((link) => (
            <Link key={link.label} href={link.href}>
              <a className="text-foreground hover:text-primary font-medium">{link.label}</a>
            </Link>
          ))}
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
            <nav className="flex flex-col space-y-6 mt-12">
              {links.map((link) => (
                <Link key={link.label} href={link.href}>
                  <a 
                    className="flex items-center text-lg font-medium"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.icon}
                    {link.label}
                  </a>
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
