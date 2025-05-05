import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, Loader2, SearchIcon } from "lucide-react";
import { useGooglePlaces } from "@/hooks/use-google-places";

interface AddressSearchProps {
  onAddressSelected: (address: string, placeId?: string) => void;
}

export default function AddressSearch({ onAddressSelected }: AddressSearchProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Get Google Maps API key from server
  const [apiKey, setApiKey] = useState<string>('');
  useEffect(() => {
    async function getApiKey() {
      try {
        console.log('Trying to fetch Google Maps API key from server...');
        const response = await fetch('/api/config/google-maps-api-key');
        const data = await response.json();
        
        if (data.apiKey) {
          console.log('Successfully retrieved Google Maps API key from server');
          setApiKey(data.apiKey);
        } else {
          setError('Could not load Google Maps API key from server.');
        }
      } catch (err) {
        console.error('Error fetching Google Maps API key:', err);
        setError('Failed to load Google Maps API. Please try again later.');
      }
    }
    
    getApiKey();
  }, []);

  // Initialize Google Places
  const { isLoaded, bindInputRef } = useGooglePlaces({
    apiKey,
    onPlaceSelected: (place) => {
      if (place) {
        setAddress(place.formatted_address || '');
        onAddressSelected(place.formatted_address || '', place.place_id);
      }
    }
  });

  // Bind to input when it's available
  useEffect(() => {
    if (inputRef.current && apiKey) {
      bindInputRef(inputRef.current);
    }
  }, [bindInputRef, apiKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address) {
      setLoading(true);
      // This would be processed through the form, but for simplicity
      // we'll just pass the address directly
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
              disabled={placesLoading || !apiKey}
            />
            {placesLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
              </div>
            )}
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
