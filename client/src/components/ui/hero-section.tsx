import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { loadGoogleMapsApi } from "@/lib/script-loader";

export default function HeroSection() {
  const [address, setAddress] = useState("");
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  // Load Google Maps API and init autocomplete
  useEffect(() => {
    async function init() {
      try {
        // Try env var first, fall back to server endpoint
        let apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
        if (!apiKey) {
          const res = await fetch("/api/config/google-maps-api-key");
          const data = await res.json();
          apiKey = data.apiKey || "";
        }
        if (!apiKey) return;

        await loadGoogleMapsApi(apiKey);

        if (!inputRef.current || !window.google?.maps?.places?.Autocomplete) return;

        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          componentRestrictions: { country: "us" },
          fields: ["formatted_address"],
        });

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current.getPlace();
          if (place?.formatted_address) {
            setAddress(place.formatted_address);
            // Navigate immediately on selection
            setLocation(`/estimate?address=${encodeURIComponent(place.formatted_address)}`);
          }
        });
      } catch (err) {
        // Autocomplete unavailable — form still works manually
        console.warn("Google Maps autocomplete unavailable:", err);
      }
    }

    init();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setLocation(`/estimate?address=${encodeURIComponent(address.trim())}`);
  };

  return (
    <section className="relative min-h-[100vh] flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70">
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
          What's the full cost to buy this home?
        </h1>
        <p className="text-lg md:text-xl text-white/80 mb-10">
          Enter any property address and instantly see your mortgage payment, insurance estimates, taxes, and whether you qualify.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter a property address..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full pl-10 pr-4 h-14 text-base rounded-xl bg-white border-0 shadow-lg outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-14 px-8 rounded-xl bg-secondary hover:bg-secondary/90 text-white font-semibold text-base shadow-lg"
          >
            Get Estimate
          </Button>
        </form>

        <p className="text-white/50 text-sm mt-5">
          No login required · Instant results · Free to use
        </p>
      </div>
    </section>
  );
}
