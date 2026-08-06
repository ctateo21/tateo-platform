import { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

// Google Places address autocomplete wrapper around the shared Input.
// Reuses the same loading pattern as insurance/address-search.tsx:
// fetch the API key from the server, inject the Maps script once
// (shared `google-maps-script` tag), then attach an Autocomplete
// instance to the input. Falls back to a plain input if the script
// can't load — typing still works.

declare global {
  interface Window {
    google?: any;
  }
}

interface AddressAutocompleteInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange"> {
  value: string;
  /** Fired on both manual typing and autocomplete selection. */
  onValueChange: (address: string) => void;
}

export function AddressAutocompleteInput({ value, onValueChange, ...inputProps }: AddressAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const listenerRef = useRef<any>(null);
  // Keep the latest callback in a ref so the place_changed listener
  // (attached once) never calls a stale closure.
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  // Load the Google Maps Places script once, app-wide.
  useEffect(() => {
    if (window.google?.maps?.places) return;
    if (document.getElementById("google-maps-script")) return;
    (async () => {
      try {
        const response = await fetch("/api/config/google-maps-api-key");
        const data = await response.json();
        if (!data.apiKey) {
          console.error("No Google Maps API key found");
          return;
        }
        const script = document.createElement("script");
        script.id = "google-maps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      } catch (err) {
        console.error("Error loading Google Maps API:", err);
      }
    })();
  }, []);

  // Attach the Autocomplete once the script and input are ready.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const init = () => {
      if (!inputRef.current || !window.google?.maps?.places) return false;
      try {
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          componentRestrictions: { country: "us" },
        });
        autocompleteRef.current = autocomplete;
        listenerRef.current = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (place?.formatted_address) {
            onValueChangeRef.current(place.formatted_address);
          }
        });
      } catch (err) {
        console.error("Error initializing Google Places Autocomplete:", err);
      }
      return true;
    };

    if (!init()) {
      interval = setInterval(() => {
        if (init() && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, 300);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (listenerRef.current && window.google?.maps?.event?.removeListener) {
        window.google.maps.event.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, []);

  return (
    <Input
      {...inputProps}
      ref={inputRef}
      type="text"
      autoComplete="off"
      value={value}
      onChange={e => onValueChange(e.target.value)}
      // The Places dropdown "selects" via Enter — don't let that submit
      // a surrounding form.
      onKeyDown={e => {
        if (e.key === "Enter") e.preventDefault();
      }}
    />
  );
}
