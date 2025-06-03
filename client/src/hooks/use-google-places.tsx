import { useEffect, useState, useCallback } from 'react';

interface GooglePlacesHookProps {
  apiKey: string;
  onPlaceSelected?: (place: any) => void;
}

// Define Google Maps API types
type AutocompleteInstance = google.maps.places.Autocomplete;
type AutocompleteOptions = google.maps.places.AutocompleteOptions;

export function useGooglePlaces({ apiKey, onPlaceSelected }: GooglePlacesHookProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [autocomplete, setAutocomplete] = useState<AutocompleteInstance | null>(null);

  // Load the Google Maps script only once when apiKey is available
  useEffect(() => {
    if (!apiKey) return;
    
    // Check if script is already in the document
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      // Script tag exists, check if Google Maps is loaded
      if (window.google?.maps?.places) {
        setScriptLoaded(true);
      }
      return;
    }
    
    // Create and add the script element
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    // Set up onload handler
    script.onload = () => setScriptLoaded(true);
    
    // Handle load errors
    script.onerror = () => {
      console.error('Failed to load Google Maps script');
    };
    
    // Add to document
    document.head.appendChild(script);
    
    // No cleanup needed for script tag as it should persist
  }, [apiKey]);

  // Function to initialize autocomplete on an input element
  const initializeAutocomplete = useCallback(
    (inputElement: HTMLInputElement) => {
      if (!scriptLoaded || !window.google?.maps?.places || !inputElement) {
        return;
      }

      try {
        // Skip if autocomplete is already initialized
        if ((inputElement as any).__googleAutocomplete) {
          return;
        }

        // Configure autocomplete options
        const options: AutocompleteOptions = {
          types: ['address'],
          componentRestrictions: { country: 'us' } // Restrict to US addresses
        };
        
        // Create autocomplete instance
        const instance = new window.google.maps.places.Autocomplete(inputElement, options);
        
        // Prevent autocomplete from interfering with React's controlled input
        // Store original value setter
        const originalSetValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        
        // Add place_changed listener
        instance.addListener('place_changed', () => {
          const place = instance.getPlace();
          if (place && place.formatted_address) {
            // Update the input value directly
            inputElement.value = place.formatted_address;
            
            // Trigger React's onChange event properly
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(inputElement, place.formatted_address);
            }
            
            // Create and dispatch a proper input event that React will recognize
            const inputEvent = new Event('input', { bubbles: true });
            Object.defineProperty(inputEvent, 'target', { writable: false, value: inputElement });
            inputElement.dispatchEvent(inputEvent);
            
            // Also dispatch change event for good measure
            const changeEvent = new Event('change', { bubbles: true });
            Object.defineProperty(changeEvent, 'target', { writable: false, value: inputElement });
            inputElement.dispatchEvent(changeEvent);
            
            // Call the onPlaceSelected callback
            if (onPlaceSelected) {
              onPlaceSelected(place);
            }
          }
        });
        
        // Handle keyboard events to allow normal typing
        const handleKeydown = (e: KeyboardEvent) => {
          // Only prevent form submission on Enter, allow all other typing
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        };
        
        inputElement.addEventListener('keydown', handleKeydown);
        
        // Store reference to prevent input field interference
        (inputElement as any).__googleAutocomplete = instance;
        setAutocomplete(instance);
        
        // Return cleanup function
        return () => {
          inputElement.removeEventListener('keydown', handleKeydown);
          // Clear the reference
          delete (inputElement as any).__googleAutocomplete;
        };
      } catch (error) {
        console.error('Error initializing Google Places Autocomplete:', error);
      }
    },
    [scriptLoaded, onPlaceSelected]
  );

  // Function to bind an input ref to Google Places
  const bindInputRef = useCallback(
    (inputElement: HTMLInputElement | null) => {
      if (!inputElement) return;
      
      if (scriptLoaded && window.google?.maps?.places) {
        initializeAutocomplete(inputElement);
      }
    },
    [scriptLoaded, initializeAutocomplete]
  );

  return {
    bindInputRef,
    isLoaded: scriptLoaded && !!window.google?.maps?.places,
    autocomplete,
  };
}

// Add TypeScript definitions for the Google Maps API
declare global {
  namespace google.maps {
    namespace places {
      class Autocomplete {
        constructor(inputElement: HTMLInputElement, options?: AutocompleteOptions);
        addListener(eventName: string, handler: Function): any;
        getPlace(): any;
      }
      
      interface AutocompleteOptions {
        types?: string[];
        componentRestrictions?: {
          country: string | string[];
        };
      }
      
      class PlacesService {
        constructor(attrContainer: Element);
        findPlaceFromQuery(request: any, callback: (results: any, status: any) => void): void;
      }
      
      const PlacesServiceStatus: {
        OK: string;
        ZERO_RESULTS: string;
        OVER_QUERY_LIMIT: string;
        REQUEST_DENIED: string;
        INVALID_REQUEST: string;
        UNKNOWN_ERROR: string;
      };
    }
  }
}
