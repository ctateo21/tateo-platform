import { useEffect, useState, useCallback, useRef } from 'react';

interface GooglePlacesHookProps {
  apiKey: string;
  onPlaceSelected?: (place: any) => void;
}

export function useGooglePlaces({ apiKey, onPlaceSelected }: GooglePlacesHookProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [autocomplete, setAutocomplete] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load the Google Maps Places API script
  useEffect(() => {
    if (!apiKey) return;
    
    // Check if script element already exists
    let scriptElement = document.getElementById('google-maps-script') as HTMLScriptElement;
    
    // If element doesn't exist, create it
    if (!scriptElement) {
      scriptElement = document.createElement('script');
      scriptElement.id = 'google-maps-script';
      scriptElement.async = true;
      scriptElement.defer = true;
      document.head.appendChild(scriptElement);
    }
    
    // Only set the src if it's not already set
    if (!scriptElement.src) {
      scriptElement.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      scriptElement.onload = () => {
        setScriptLoaded(true);
      };
    } else if (window.google && window.google.maps && window.google.maps.places) {
      // Script already loaded with src set
      setScriptLoaded(true);
    }

    return () => {
      // Cleanup function - not removing the script because other components might use it
    };
  }, [apiKey]);

  // Initialize autocomplete when the input reference is available and script is loaded
  const initializeAutocomplete = useCallback(
    (inputElement: HTMLInputElement) => {
      if (!window.google || !window.google.maps || !window.google.maps.places || !scriptLoaded) {
        return;
      }

      try {
        // Create the autocomplete instance
        const options = {
          types: ['address'],
          componentRestrictions: { country: 'us' } // Restrict to US addresses only
        };
        
        const autocompleteInstance = new window.google.maps.places.Autocomplete(
          inputElement,
          options
        );

        // Add listener for place_changed event
        const listener = autocompleteInstance.addListener('place_changed', () => {
          const place = autocompleteInstance.getPlace();
          if (onPlaceSelected && place) {
            onPlaceSelected(place);
          }
        });

        setAutocomplete(autocompleteInstance);
        
        // Prevent form submission when Enter is pressed in the input field
        const keydownHandler = (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        };
        
        inputElement.addEventListener('keydown', keydownHandler);
        
        // Return cleanup function
        return () => {
          if (listener) {
            window.google?.maps?.event?.removeListener(listener);
          }
          inputElement.removeEventListener('keydown', keydownHandler);
        };
      } catch (error) {
        console.error('Error initializing Google Places Autocomplete:', error);
        return undefined;
      }
    },
    [scriptLoaded, onPlaceSelected]
  );

  // Function to bind the input ref
  const bindInputRef = useCallback(
    (ref: HTMLInputElement | null) => {
      if (ref !== inputRef.current) {
        inputRef.current = ref;
        if (ref && scriptLoaded && window.google && window.google.maps && window.google.maps.places) {
          initializeAutocomplete(ref);
        }
      }
    },
    [scriptLoaded, initializeAutocomplete]
  );

  // Initialize when the script is loaded and input ref exists
  useEffect(() => {
    if (scriptLoaded && inputRef.current && window.google && window.google.maps && window.google.maps.places) {
      const cleanup = initializeAutocomplete(inputRef.current);
      return cleanup;
    }
  }, [scriptLoaded, initializeAutocomplete]);

  return {
    bindInputRef,
    isLoaded: scriptLoaded && !!window.google?.maps?.places,
    autocomplete,
  };
}

// Add TypeScript definitions for the Google Maps API
declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (input: HTMLInputElement, options?: object) => any;
          PlacesService: any;
          PlacesServiceStatus: {
            OK: string;
            ZERO_RESULTS: string;
            OVER_QUERY_LIMIT: string;
            REQUEST_DENIED: string;
            INVALID_REQUEST: string;
            UNKNOWN_ERROR: string;
          };
        };
        event?: {
          removeListener: (listener: any) => void;
        };
        MapsEventListener: any;
      };
    };
  }
}
