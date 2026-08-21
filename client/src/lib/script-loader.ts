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
let googleMapsPromise: Promise<void> | null = null;

async function resolveGoogleMapsApiKey(apiKey?: string): Promise<string> {
  if (apiKey) return apiKey;

  const response = await fetch('/api/config/google-maps-api-key');
  if (!response.ok) throw new Error('Google Maps API key is not configured');
  const data = await response.json();
  if (!data.apiKey) throw new Error('Google Maps API key is not configured');
  return data.apiKey;
}

async function ensurePlacesLibrary(): Promise<void> {
  if (!window.google?.maps?.importLibrary) {
    throw new Error('Google Maps JavaScript API did not initialize');
  }
  await window.google.maps.importLibrary('places');
}

export async function loadGoogleMapsApi(apiKey?: string): Promise<void> {
  if (window.google?.maps?.importLibrary) {
    await ensurePlacesLibrary();
    return;
  }

  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = (async () => {
    const resolvedApiKey = await resolveGoogleMapsApiKey(apiKey);
    const existingScript = document.getElementById('google-maps-script') as HTMLScriptElement | null;

    if (existingScript) {
      await new Promise<void>((resolve, reject) => {
        if (window.google?.maps?.importLibrary) {
          resolve();
          return;
        }
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps API')), { once: true });
      });
      await ensurePlacesLibrary();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const callbackName = '__havoGoogleMapsReady';
      (window as any)[callbackName] = () => {
        delete (window as any)[callbackName];
        resolve();
      };

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(resolvedApiKey)}&libraries=places&loading=async&v=weekly&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        delete (window as any)[callbackName];
        script.remove();
        reject(new Error('Failed to load Google Maps API'));
      };
      document.head.appendChild(script);
    });

    await ensurePlacesLibrary();
  })().catch(error => {
    googleMapsPromise = null;
    throw error;
  });

  return googleMapsPromise;
}

// Add types for global Google Maps API. Typed as `any` to stay
// consistent with the other `window.google` declaration (see
// address-search.tsx) — a single shared shape avoids TS2717 "subsequent
// property declarations must have the same type" conflicts.
declare global {
  interface Window {
    google?: any;
    __havoGoogleMapsReady?: () => void;
  }
}
