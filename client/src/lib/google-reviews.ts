import { loadGoogleMapsApi } from './script-loader';

export interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
  profile_photo_url?: string;
  service?: string;
}

interface GooglePlace {
  reviews?: any[];
  name?: string;
}

// We use the Window interface extension from script-loader.ts

// Google Place ID for Tateo & Co
const TATEO_PLACE_ID = 'ChIJJeg0Ii09QIYRgiNHNcTlf_c'; // Replace with your actual Place ID

/**
 * Initialize Google Maps API and fetch reviews for Tateo & Co
 */
export async function fetchGoogleReviews(): Promise<GoogleReview[]> {
  // Make sure we're using the correct environment variable name
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  try {
    await loadGoogleMapsApi(apiKey);
    return await getPlaceReviews(TATEO_PLACE_ID);
  } catch (error) {
    console.error('Error fetching Google reviews:', error);
    return [];
  }
}

/**
 * Get reviews for a specific place using Google Places API
 */
function getPlaceReviews(placeId: string): Promise<GoogleReview[]> {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      reject(new Error('Google Maps API not loaded'));
      return;
    }

    const request = {
      placeId: placeId,
      fields: ['reviews', 'name']
    };

    const service = new window.google.maps.places.PlacesService(document.createElement('div'));
    
    service.getDetails(request, (place: GooglePlace | null, status: string) => {
      if (status === window.google?.maps?.places?.PlacesServiceStatus.OK && place && place.reviews) {
        // Add a service type to each review (assuming all are general reviews)
        const reviewsWithService = place.reviews.map((review: any) => ({
          ...review,
          service: 'Tateo & Co Services'
        }));
        resolve(reviewsWithService);
      } else {
        reject(new Error(`Error fetching place details: ${status}`));
      }
    });
  });
}
