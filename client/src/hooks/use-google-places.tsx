import { useEffect, useState, useCallback, useRef } from 'react';

interface GooglePlacesHookProps {
  apiKey: string;
  onPlaceSelected?: (place: any) => void;
}

interface PlacesAutocompleteInstance {
  addListener: (
    eventName: string,
    callback: (...args: any[]) => void
  ) => any;
  getPlace: () => any;
}

export function useGooglePlaces({ apiKey, onPlaceSelected }: GooglePlacesHookProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [autocomplete, setAutocomplete] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load the Google Maps Places API script
  useEffect(() => {
    const scriptElement = document.getElementById('google-maps-script') as HTMLScriptElement;
    if (!scriptElement.src && apiKey) {
      scriptElement.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      scriptElement.onload = () => {
        setScriptLoaded(true);
      };
    } else if (window.google && window.google.maps && window.google.maps.places) {
      // Script already loaded
      setScriptLoaded(true);
    }

    return () => {
      // Cleanup if needed
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
        autocompleteInstance.addListener('place_changed', () => {
          const place = autocompleteInstance.getPlace();
          if (onPlaceSelected && place) {
            onPlaceSelected(place);
          }
        });

        setAutocomplete(autocompleteInstance);
        
        // Prevent form submission when Enter is pressed in the input field
        inputElement.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        });
      } catch (error) {
        console.error('Error initializing Google Places Autocomplete:', error);
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
      initializeAutocomplete(inputRef.current);
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
        };
        MapsEventListener: any;
      };
    };
  }
}
