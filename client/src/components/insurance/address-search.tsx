import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, Loader2, SearchIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
  onAddressSelected: (address: string, propertyType: string, placeId?: string) => void;
}

export default function AddressSearch({ onAddressSelected }: AddressSearchProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<{address: string, placeId?: string} | null>(null);
  const [propertyType, setPropertyType] = useState<string>('');
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
            // Store selected address for property type selection
            setSelectedAddress({
              address: place.formatted_address,
              placeId: place.place_id
            });
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
    if (selectedAddress && propertyType) {
      setLoading(true);
      onAddressSelected(selectedAddress.address, propertyType, selectedAddress.placeId);
      setLoading(false);
    }
  };

  // Handle manual address entry without autocomplete
  const handleManualSubmit = () => {
    if (address) {
      setSelectedAddress({ address });
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
          {/* Step 1: Address input */}
          {!selectedAddress && (
            <div className="space-y-4">
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
                type="button"
                onClick={handleManualSubmit}
                className="bg-primary hover:bg-primary/90 text-white w-full h-12"
                disabled={!address}
              >
                <SearchIcon className="mr-2 h-4 w-4" />
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Property type selection */}
          {selectedAddress && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                <div className="text-sm font-medium text-gray-700">Selected Address:</div>
                <div className="text-gray-900">{selectedAddress.address}</div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="property-type" className="text-sm font-medium">
                  Property Type
                </Label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger id="property-type" className="w-full h-12">
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary Residence</SelectItem>
                    <SelectItem value="secondary">Secondary Home</SelectItem>
                    <SelectItem value="vacant">Vacant Property</SelectItem>
                    <SelectItem value="seasonal">Seasonal Property</SelectItem>
                    <SelectItem value="short-term-rental">Short Term Rental</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button"
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => {
                    setSelectedAddress(null);
                    setPropertyType('');
                  }}
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  className="bg-primary hover:bg-primary/90 text-white flex-1 h-12"
                  disabled={loading || !propertyType}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>Find Insurance Options</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
