import axios from 'axios';

export interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
  profile_photo_url?: string;
  service?: string;
}

// Google Place ID for Tateo & Co extracted directly from the Google Maps URL
const TATEO_PLACE_ID = 'ChIJJeg0Ii09QIYRgiNHNcTlf_c';  // Tateo & Co Place ID

export async function fetchGoogleReviews(): Promise<GoogleReview[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.error('Google Maps API key not found in environment');
    throw new Error('Google Maps API key is required');
  }
  
  // Construct the API URL with more fields
  const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${TATEO_PLACE_ID}&fields=name,rating,reviews,formatted_address&key=${apiKey}`;
  console.log(`Fetching Google reviews for place ID: ${TATEO_PLACE_ID}`);
  
  try {
    // Fetch place details including reviews using Google Places API
    const response = await axios.get(apiUrl);
    
    // Log the response status
    console.log(`Google Places API response status: ${response.data.status}`);
    
    if (response.data.status !== 'OK') {
      if (response.data.error_message) {
        console.error(`Google Places API error message: ${response.data.error_message}`);
      }
      throw new Error(`Google Places API error: ${response.data.status}`);
    }
    
    // Check if we have the expected result structure
    if (!response.data.result) {
      console.error('Missing result in Google Places API response');
      throw new Error('Invalid API response format');
    }
    
    // Get reviews from the response
    const reviews = response.data.result.reviews || [];
    console.log(`Found ${reviews.length} reviews for place ${response.data.result.name || TATEO_PLACE_ID}`);
    
    // Add service name to reviews
    return reviews.map((review: any) => ({
      ...review,
      service: 'Tateo & Co Services'
    }));
    
  } catch (error) {
    console.error('Error fetching Google reviews:', error);
    throw error;
  }
}

// Get mock reviews for local development when API is not available
export function getMockReviews(): GoogleReview[] {
  return [
    {
      author_name: "Jennifer R.",
      service: "Mortgage Services",
      rating: 5,
      text: "Working with Tateo & Co on our mortgage was a game-changer! They secured us a fantastic rate and made the entire process smooth and stress-free.",
      time: new Date().getTime() / 1000,
      relative_time_description: "1 month ago"
    },
    {
      author_name: "David M.",
      service: "Real Estate",
      rating: 5,
      text: "Our agent went above and beyond to help us find our dream home. Their market knowledge and negotiation skills were invaluable.",
      time: new Date().getTime() / 1000,
      relative_time_description: "2 months ago"
    },
    {
      author_name: "Sarah L.",
      service: "Insurance",
      rating: 5,
      text: "Tateo & Co helped us find the perfect insurance coverage for our new home at a competitive rate. Their attention to detail ensured we had all the protection we needed.",
      time: new Date().getTime() / 1000,
      relative_time_description: "3 months ago"
    },
    {
      author_name: "Michael T.",
      service: "Property Management",
      rating: 5,
      text: "As an out-of-state property owner, their property management services have been essential. They handle everything professionally and keep me updated regularly.",
      time: new Date().getTime() / 1000,
      relative_time_description: "3 weeks ago"
    }
  ];
}
