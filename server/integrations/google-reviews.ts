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

// Tateo & Co business identifiers extracted directly from the Google Maps URL
const TATEO_PLACE_ID = 'ChIJJWPkImPcwogRgndDPdR07Pc';  // Extracted from maps URL 0x8203cd622a64e825:0xf771e45c35347782
const TATEO_LAT = 32.8769575;  // Latitude from the maps URL
const TATEO_LNG = -80.759978;  // Longitude from the maps URL

export async function fetchGoogleReviews(): Promise<GoogleReview[]> {
  // First, check if API key is available
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.error('Google Maps API key not found in environment');
    throw new Error('Google Maps API key is required');
  }
  
  try {
    console.log('Using exact Place ID from Google Maps URL');
    
    // Use the exact Place ID extracted from your Google Maps URL
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${TATEO_PLACE_ID}&fields=name,rating,reviews,formatted_address,user_ratings_total&key=${apiKey}`;
    
    console.log(`Making request to the Place Details API with ID: ${TATEO_PLACE_ID}`);
    console.log(`Request URL: ${detailsUrl.replace(apiKey, 'API_KEY_REDACTED')}`);
    
    const detailsResponse = await axios.get(detailsUrl);
    
    if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
      const place = detailsResponse.data.result;
      const reviews = place.reviews || [];
      
      console.log(`Success! Found ${reviews.length} reviews for ${place.name}`);
      console.log(`Location: ${place.formatted_address}`);
      console.log(`Overall rating: ${place.rating} (from ${place.user_ratings_total} users)`);
      
      // Return just the most recent 5 reviews
      return reviews.slice(0, 5).map((review: any) => ({
        author_name: review.author_name,
        rating: review.rating,
        text: review.text,
        time: review.time,
        relative_time_description: review.relative_time_description,
        profile_photo_url: review.profile_photo_url,
        service: place.name
      }));
    } else {
      console.error('Place Details API error:', JSON.stringify(detailsResponse.data, null, 2));
      throw new Error(`Place Details API error: ${detailsResponse.data.status}`);
    }
  } catch (error: any) {
    // Provide more detailed error information for easier debugging
    let errorMessage = 'Error in Google reviews fetch operation';
    
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx range
      errorMessage = `API responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`;
      console.error('Google Places API error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = 'No response received from Google Places API';
      console.error('No response received from API:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      errorMessage = `Google Places API request error: ${error.message}`;
      console.error('Error setting up API request:', error.message);
    }
    
    // Log the full stack trace for debugging
    console.error('Full error:', error);
    
    throw new Error(errorMessage);
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
