import { useRef, useEffect, useState, useCallback } from "react";
import { useGooglePlaces } from "@/hooks/use-google-places";
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

export default function AddressInput({
  value,
  onChange,
  onPlaceSelected,
  className,
  placeholder = "Enter address or ZIP code",
  id,
  name,
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        setLoading(true);
        const key = await getGoogleMapsApiKey();
        // Check if key is a string before setting it
        if (typeof key === 'string') {
          setApiKey(key);
          setError(null);
        } else {
          setError("Invalid API key format");
          console.error("Invalid Google Maps API key format");
        }
      } catch (err) {
        setError("Failed to load Google Maps API");
        console.error("Failed to load Google Maps API key:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  // Handle place selection
  const handlePlaceSelected = useCallback((place: any) => {
    if (place && place.formatted_address) {
      // Force the input value to update immediately
      if (inputRef.current) {
        inputRef.current.value = place.formatted_address;
      }
      
      // Update the form state
      onChange(place.formatted_address);
      
      // Call the callback
      if (onPlaceSelected) {
        onPlaceSelected(place);
      }
    }
  }, [onChange, onPlaceSelected]);

  // Initialize Google Places
  const { bindInputRef, isLoaded } = useGooglePlaces({
    apiKey,
    onPlaceSelected: handlePlaceSelected,
  });

  // Bind input to Google Places when API is loaded
  useEffect(() => {
    if (inputRef.current && isLoaded) {
      bindInputRef(inputRef.current);
    }
  }, [bindInputRef, isLoaded]);

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
        <div className="mt-1 text-xs text-destructive">{error}</div>
      )}
    </div>
  );
}