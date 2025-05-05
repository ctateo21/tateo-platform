import type { GoogleReview } from './google-reviews';

/**
 * Response from the Google reviews API endpoint
 */
interface GoogleReviewsResponse {
  success?: boolean;
  error?: string;
  message?: string;
  reviews: GoogleReview[];
}

/**
 * Fetch Google reviews for Tateo & Co from the server API
 */
export async function fetchGoogleReviews(): Promise<GoogleReview[]> {
  try {
    const response = await fetch('/api/reviews/google');
    
    // Always parse the response, even if it's not a 200 status code
    // as our API returns useful error information
    const data: GoogleReviewsResponse = await response.json();
    console.log('Reviews data from API:', data);
    
    // Check if the request was successful
    if (data.success === false) {
      console.warn(`API reported an error: ${data.error || data.message || 'Unknown error'}`);
      // Still return any reviews provided (which may be mock data)
      if (data.reviews && Array.isArray(data.reviews)) {
        return data.reviews;
      }
      return [];
    }
    
    // Validate reviews data
    if (!data.reviews || !Array.isArray(data.reviews)) {
      console.warn('Invalid or missing reviews data from API');
      return [];
    }
    
    return data.reviews;
  } catch (error) {
    console.error('Error fetching Google reviews from API:', error);
    // Return empty array on error
    return [];
  }
}
