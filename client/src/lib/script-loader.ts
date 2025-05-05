/**
 * Utility to dynamically load external scripts
 */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script already exists
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error(`Failed to load script: ${src}`));
    
    document.head.appendChild(script);
  });
}

/**
 * Load Google Maps API with Places library
 */
export async function loadGoogleMapsApi(apiKey: string): Promise<void> {
  if (!apiKey) {
    console.error('Cannot load Google Maps API: API key is empty or invalid');
    return Promise.reject(new Error('Google Maps API key is required'));
  }

  // If already loaded
  if (window.google && window.google.maps && window.google.maps.places) {
    console.log('Google Maps API already loaded');
    return Promise.resolve();
  }
  
  console.log('Loading Google Maps API with key:', apiKey.substring(0, 8) + '...');
  const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsCallback`;
  
  return new Promise((resolve, reject) => {
    // Create a global callback function that Google Maps will call when loaded
    (window as any).initGoogleMapsCallback = function() {
      console.log('Google Maps API loaded via callback');
      delete (window as any).initGoogleMapsCallback;
      resolve();
    };

    try {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      
      script.onerror = (e) => {
        console.error('Error loading Google Maps script:', e);
        delete (window as any).initGoogleMapsCallback;
        reject(new Error(`Failed to load Google Maps API`));
      };
      
      document.head.appendChild(script);
    } catch (error) {
      console.error('Error setting up Google Maps API script:', error);
      delete (window as any).initGoogleMapsCallback;
      reject(error);
    }
  });
}

// Add types for global Google Maps API
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
      };
    };
    initGoogleMapsCallback?: () => void;
  }
}
