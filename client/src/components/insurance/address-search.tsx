import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, Loader2, SearchIcon } from "lucide-react";

// Define type for Google Autocomplete instance
type GoogleAutocomplete = any;
type GoogleMapsEvent = any;

// Add a declaration for Window with Google Maps
declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (input: HTMLInputElement, options?: any) => any;
        };
        event?: {
          removeListener: (listener: any) => void;
        };
      };
    };
  }
}

interface AddressSearchProps {
  onAddressSelected: (address: string, placeId?: string) => void;
}

export default function AddressSearch({ onAddressSelected }: AddressSearchProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const listenerRef = useRef<GoogleMapsEvent | null>(null);

  // Load Google Maps script with Places API
  useEffect(() => {
    // Skip if script is already loaded
    if (window.google?.maps?.places) {
      return;
    }

    // Skip if script is already being loaded
    if (document.getElementById('google-maps-script')) {
      return;
    }

    const loadScript = async () => {
      try {
        // Fetch API key
        const response = await fetch('/api/config/google-maps-api-key');
        const data = await response.json();
        
        if (!data.apiKey) {
          console.error('No Google Maps API key found');
          return;
        }

        // Create and add script
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      } catch (err) {
        console.error('Error loading Google Maps API:', err);
      }
    };

    loadScript();
  }, []);

  // Initialize autocomplete when input is available and Google Maps is loaded
  useEffect(() => {
    // Check if Google Maps API is loaded and input exists
    if (!inputRef.current || !window.google?.maps?.places) {
      return;
    }

    // Clean up previous instance if it exists
    if (listenerRef.current && window.google?.maps?.event?.removeListener) {
      window.google.maps.event.removeListener(listenerRef.current);
      listenerRef.current = null;
    }

    try {
      // Create new autocomplete instance
      const options = {
        types: ['address'],
        componentRestrictions: { country: 'us' }
      };
      
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, options);
      autocompleteRef.current = autocomplete;

      // Add place_changed listener
      const listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place && place.formatted_address) {
          setAddress(place.formatted_address);
          if (place.place_id) {
            setLoading(true);
            onAddressSelected(place.formatted_address, place.place_id);
            setLoading(false);
          }
        }
      });

      listenerRef.current = listener;

      // Prevent form submission on Enter key
      const preventSubmit = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && document.activeElement === inputRef.current) {
          e.preventDefault();
        }
      };

      inputRef.current.addEventListener('keydown', preventSubmit);

      // Clean up function
      return () => {
        if (window.google?.maps?.event?.removeListener && listenerRef.current) {
          window.google.maps.event.removeListener(listenerRef.current);
        }
        if (inputRef.current) {
          inputRef.current.removeEventListener('keydown', preventSubmit);
        }
      };
    } catch (err) {
      console.error('Error initializing Google Places Autocomplete:', err);
    }
  }, [onAddressSelected]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address) {
      setLoading(true);
      onAddressSelected(address);
      setLoading(false);
    }
  };

  return (
    <Card className="w-full bg-white shadow-sm border-0">
      <CardContent className="p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-primary flex items-center">
            <Home className="mr-2 h-5 w-5" /> 
            Enter Your Property Address
          </h3>
          <p className="text-gray-600 mt-1">
            We'll help you find insurance coverage options tailored to your property.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Enter your property address"
              className="pr-10 h-12 border-gray-300"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="off"
            />
          </div>

          <Button 
            type="submit" 
            className="bg-primary hover:bg-primary/90 text-white w-full h-12"
            disabled={loading || !address}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <SearchIcon className="mr-2 h-4 w-4" />
                Find Insurance Options
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
