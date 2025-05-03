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
  // If already loaded
  if (window.google && window.google.maps && window.google.maps.places) {
    return Promise.resolve();
  }
  
  const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
  
  try {
    await loadScript(scriptUrl);
    return Promise.resolve();
  } catch (error) {
    console.error('Error loading Google Maps API:', error);
    return Promise.reject(error);
  }
}

// Add types for global Google Maps API
declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (input: HTMLInputElement, options?: object) => any;
          PlacesService: any;
        };
      };
    };
  }
}
