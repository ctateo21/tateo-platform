import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, Loader2, SearchIcon, CheckIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

// Define simplified types for Google Maps API to avoid conflicts
type GoogleMapsEvent = any;
type GoogleAutocomplete = any;

// Simplify the Window interface
declare global {
  interface Window {
    google?: any;
  }
}

interface InsuranceType {
  id: string;
  label: string;
  showPropertyType?: boolean;
  showOtherOptions?: boolean;
}

interface OtherInsuranceOption {
  id: string;
  label: string;
}

interface AddressSearchProps {
  onAddressSelected: (address: string, insuranceTypes: string[], propertyType: string, otherOptions: string[], placeId?: string) => void;
}

export default function AddressSearch({ onAddressSelected }: AddressSearchProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<{address: string, placeId?: string} | null>(null);
  const [propertyType, setPropertyType] = useState<string>('');
  const [selectedInsuranceTypes, setSelectedInsuranceTypes] = useState<string[]>([]);
  const [selectedOtherOptions, setSelectedOtherOptions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const listenerRef = useRef<GoogleMapsEvent | null>(null);
  
  // Insurance types
  const insuranceTypes: InsuranceType[] = [
    { id: 'auto', label: 'Auto' },
    { id: 'property', label: 'Property', showPropertyType: true },
    { id: 'flood', label: 'Flood', showPropertyType: true },
    { id: 'other', label: 'Other', showOtherOptions: true }
  ];

  // Other insurance options
  const otherOptions: OtherInsuranceOption[] = [
    { id: 'commercial', label: 'Commercial Property' },
    { id: 'umbrella', label: 'Umbrella' },
    { id: 'liability', label: 'General Liability' },
    { id: 'workers-comp', label: 'Worker\'s Comp' },
    { id: 'boat', label: 'Boat' }
  ];

  // Determine if property type selection should be shown
  const showPropertyTypeSelection = selectedInsuranceTypes.some(type => 
    insuranceTypes.find(it => it.id === type)?.showPropertyType
  );

  // Determine if other options should be shown
  const showOtherOptions = selectedInsuranceTypes.includes('other');

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
      // We need to check if the API is loaded periodically if it's not loaded yet
      const checkGoogleApi = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(checkGoogleApi);
          initializeAutocomplete();
        }
      }, 300);
      
      // Clear the interval when the component unmounts
      return () => clearInterval(checkGoogleApi);
    }
    
    // If the API is already loaded, initialize autocomplete
    initializeAutocomplete();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once when component mounts

  // Function to initialize the Google Places Autocomplete
  const initializeAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places) return;
    
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
      
      console.log('Google Places Autocomplete initialized successfully');
    } catch (err) {
      console.error('Error initializing Google Places Autocomplete:', err);
    }
  };

  // Handle insurance type selection
  const handleInsuranceTypeChange = (type: string, checked: boolean) => {
    if (checked) {
      setSelectedInsuranceTypes(prev => [...prev, type]);
    } else {
      setSelectedInsuranceTypes(prev => prev.filter(t => t !== type));
    }
  };

  // Handle other options selection
  const handleOtherOptionChange = (option: string, checked: boolean) => {
    if (checked) {
      setSelectedOtherOptions(prev => [...prev, option]);
    } else {
      setSelectedOtherOptions(prev => prev.filter(o => o !== option));
    }
  };

  // Check if form can be submitted
  const canSubmit = selectedInsuranceTypes.length > 0 && 
    (!showPropertyTypeSelection || propertyType !== '') &&
    (!showOtherOptions || selectedOtherOptions.length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAddress && selectedInsuranceTypes.length > 0) {
      // Property type is required only if property/flood is selected
      if (showPropertyTypeSelection && !propertyType) {
        return;
      }
      
      // At least one other option is required if 'other' is selected
      if (showOtherOptions && selectedOtherOptions.length === 0) {
        return;
      }
      
      setLoading(true);
      onAddressSelected(
        selectedAddress.address, 
        selectedInsuranceTypes, 
        propertyType, 
        selectedOtherOptions, 
        selectedAddress.placeId
      );
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
            Enter Your Address
          </h3>
          <p className="text-gray-600 mt-1">
            We'll help you find insurance coverage options tailored for you.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Address input - always show it */}
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Enter your address"
              className="pr-10 h-12 border-gray-300"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="off"
              disabled={!!selectedAddress} /* Disable when address is selected */
            />
          </div>
          
          {/* Insurance type selection */}
          {selectedAddress && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Type of Insurance (Select all that apply)
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {insuranceTypes.map(type => (
                    <div key={type.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`insurance-${type.id}`} 
                        checked={selectedInsuranceTypes.includes(type.id)}
                        onCheckedChange={(checked) => 
                          handleInsuranceTypeChange(type.id, checked === true)
                        }
                      />
                      <Label 
                        htmlFor={`insurance-${type.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Property type dropdown that appears when property or flood is selected */}
          {selectedAddress && showPropertyTypeSelection && (
            <div className="space-y-2">
              <Label htmlFor="property-type" className="text-sm font-medium">
                Property Type
              </Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger id="property-type" className="w-full h-12">
                  <SelectValue placeholder="Select property type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="short-term-rental">Short Term Rental</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Other insurance options */}
          {selectedAddress && showOtherOptions && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Other Insurance Options (Select all that apply)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {otherOptions.map(option => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`option-${option.id}`} 
                      checked={selectedOtherOptions.includes(option.id)}
                      onCheckedChange={(checked) => 
                        handleOtherOptionChange(option.id, checked === true)
                      }
                    />
                    <Label 
                      htmlFor={`option-${option.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Show the action buttons */}
          <div className={`${selectedAddress ? 'flex gap-3' : ''} mt-4`}>
            {selectedAddress && (
              <Button 
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={() => {
                  setSelectedAddress(null);
                  setPropertyType('');
                  setSelectedInsuranceTypes([]);
                  setSelectedOtherOptions([]);
                }}
              >
                Change Address
              </Button>
            )}
            
            <Button 
              type={selectedAddress ? "submit" : "button"}
              onClick={selectedAddress ? undefined : handleManualSubmit}
              className="bg-primary hover:bg-primary/90 text-white w-full h-12"
              disabled={selectedAddress ? (loading || !canSubmit) : !address}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <SearchIcon className="mr-2 h-4 w-4" />
                  {selectedAddress ? "Find Insurance Options" : "Continue"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
