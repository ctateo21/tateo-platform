import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { getGoogleMapsApiKey } from "@/lib/api";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: any) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  name?: string;
}

export default function SimpleAddressInput({
  value,
  onChange,
  onPlaceSelected,
  className,
  placeholder = "Enter address or ZIP code",
  id,
  name,
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        setLoading(true);
        const key = await getGoogleMapsApiKey();
        if (typeof key === 'string') {
          setApiKey(key);
          setError(null);
        } else {
          setError("Invalid API key format");
        }
      } catch (err) {
        setError("Failed to load Google Maps API");
      } finally {
        setLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (!apiKey) return;

    // Check if Google Maps is already loaded
    if ((window as any).google?.maps?.places) {
      setScriptLoaded(true);
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (existingScript) {
      const checkLoaded = () => {
        if ((window as any).google?.maps?.places) {
          setScriptLoaded(true);
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setScriptLoaded(true);
    };
    
    script.onerror = () => {
      setError("Failed to load Google Maps");
    };

    document.head.appendChild(script);
  }, [apiKey]);

  // Initialize autocomplete
  useEffect(() => {
    if (!scriptLoaded || !inputRef.current || !(window as any).google?.maps?.places) return;

    // Clean up existing autocomplete
    if (autocompleteRef.current) {
      try {
        (window as any).google.maps.event.clearInstanceListeners(autocompleteRef.current);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Create new autocomplete instance
    const autocomplete = new (window as any).google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' }
    });

    autocompleteRef.current = autocomplete;

    // Handle place selection
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      
      if (place && place.formatted_address) {
        // Update React state immediately
        onChange(place.formatted_address);
        
        // Call the callback
        if (onPlaceSelected) {
          onPlaceSelected(place);
        }
      }
    });

    return () => {
      try {
        if (listener) {
          (window as any).google.maps.event.removeListener(listener);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [scriptLoaded, onChange, onPlaceSelected]);

  // Handle manual input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        className={className}
        placeholder={placeholder}
        id={id}
        name={name}
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="text-red-500 text-sm mt-1">
          {error}
        </div>
      )}
    </div>
  );
}