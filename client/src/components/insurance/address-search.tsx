import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, Loader2, SearchIcon } from "lucide-react";
import { useGooglePlaces } from '@/hooks/use-google-places';

interface AddressSearchProps {
  onAddressSelected: (address: string, placeId?: string) => void;
}

export default function AddressSearch({ onAddressSelected }: AddressSearchProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState('');
  
  // Handle place selection from Google Places Autocomplete
  const handlePlaceSelected = (place: any) => {
    if (place && place.formatted_address) {
      setAddress(place.formatted_address);
      // Submit the form automatically when a place is selected
      if (place.formatted_address && place.place_id) {
        setLoading(true);
        onAddressSelected(place.formatted_address, place.place_id);
        setLoading(false);
      }
    }
  };

  // Fetch API key only once when component mounts
  useEffect(() => {
    let isMounted = true;
    
    const fetchApiKey = async () => {
      try {
        const response = await fetch('/api/config/google-maps-api-key');
        if (!isMounted) return;
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.apiKey) {
            setApiKey(data.apiKey);
          } else if (isMounted) {
            console.error('Google Maps API key not found in response');
          }
        } else if (isMounted) {
          console.error('Failed to fetch Google Maps API key');
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching Google Maps API key:', err);
        }
      }
    };

    fetchApiKey();
    
    // Cleanup function to prevent state updates after unmount
    return () => { isMounted = false; };
  }, []);

  // Initialize Google Places Autocomplete
  const { bindInputRef, isLoaded } = useGooglePlaces({
    apiKey,
    onPlaceSelected: handlePlaceSelected
  });

  // Connect the input ref to the Google Places hook when it's ready
  useEffect(() => {
    if (inputRef.current && isLoaded) {
      bindInputRef(inputRef.current);
    }
  }, [bindInputRef, isLoaded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address) {
      setLoading(true);
      // Submit the manually entered address
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
