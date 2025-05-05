import type { GoogleReview } from './google-reviews';

/**
 * Fetch Google reviews for Tateo & Co from the server API
 */
export async function fetchGoogleReviews(): Promise<GoogleReview[]> {
  try {
    const response = await fetch('/api/reviews/google');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch reviews: ${response.status}`);
    }
    
    const data = await response.json();
    return data.reviews || [];
  } catch (error) {
    console.error('Error fetching Google reviews from API:', error);
    // Return empty array on error
    return [];
  }
}
