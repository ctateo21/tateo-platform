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
// From the URL: 0x8203cd622a64e825:0xf771e45c35347782
const TATEO_CID = '17830283484417259394'; // 0xf771e45c35347782 converted to decimal
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
    // Business search approach with coordinates and keyword
    console.log('Using nearby search with exact coordinates from Google Maps URL');
    
    // First, let's try to find the business with a nearby search using the exact coordinates
    const nearbySearchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${TATEO_LAT},${TATEO_LNG}&radius=100&keyword=Tateo&key=${apiKey}`;
    
    console.log(`Making nearby search request with coordinates: ${TATEO_LAT},${TATEO_LNG}`);
    console.log(`Request URL: ${nearbySearchUrl.replace(apiKey, 'API_KEY_REDACTED')}`);
    
    const nearbyResponse = await axios.get(nearbySearchUrl);
    
    if (nearbyResponse.data.status !== 'OK' || !nearbyResponse.data.results || nearbyResponse.data.results.length === 0) {
      console.log('Nearby search did not find the business - trying text search');
      
      // If nearby search failed, try a more direct text search
      const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=Tateo & Co&location=${TATEO_LAT},${TATEO_LNG}&radius=5000&key=${apiKey}`;
      
      console.log(`Trying text search: ${textSearchUrl.replace(apiKey, 'API_KEY_REDACTED')}`);
      
      const textSearchResponse = await axios.get(textSearchUrl);
      
      if (textSearchResponse.data.status !== 'OK' || !textSearchResponse.data.results || textSearchResponse.data.results.length === 0) {
        console.error('Text search did not find the business either');
        throw new Error('Could not find Tateo & Co business with search APIs');
      }
      
      // We found the business through text search
      const placeId = textSearchResponse.data.results[0].place_id;
      console.log(`Found business with Text Search! Place ID: ${placeId}`);
      console.log(`Business Name: ${textSearchResponse.data.results[0].name}`);
      console.log(`Address: ${textSearchResponse.data.results[0].formatted_address}`);
      
      // Get the details with the place ID we found
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,reviews,formatted_address,user_ratings_total&key=${apiKey}`;
      
      console.log(`Getting details with place ID: ${placeId}`);
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
      }
      
      console.error('Could not retrieve details for business');
      throw new Error('Could not retrieve details for Tateo & Co');
    }
    
    // We found the business through nearby search
    const placeId = nearbyResponse.data.results[0].place_id;
    console.log(`Found business with Nearby Search! Place ID: ${placeId}`);
    console.log(`Business Name: ${nearbyResponse.data.results[0].name}`);
    
    // Get the details with the place ID we found
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,reviews,formatted_address,user_ratings_total&key=${apiKey}`;
    
    console.log(`Getting details with place ID: ${placeId}`);
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
    },
    {
      author_name: "Amanda K.",
      service: "Home Services",
      rating: 5,
      text: "The home services team at Tateo & Co was fantastic! They helped us coordinate all the work needed on our new property and found reliable contractors at reasonable prices.",
      time: new Date().getTime() / 1000,
      relative_time_description: "1 week ago"
    },
    {
      author_name: "James W.",
      service: "Construction",
      rating: 5,
      text: "Working with Tateo & Co on our home renovation was an excellent experience. They managed the project timeline effectively and kept everything within budget.",
      time: new Date().getTime() / 1000,
      relative_time_description: "2 weeks ago"
    },
    {
      author_name: "Rebecca T.",
      service: "Mortgage Services",
      rating: 5,
      text: "I was worried about qualifying for a mortgage with my credit history, but Tateo & Co found the perfect loan program for me. They were patient and explained everything clearly.",
      time: new Date().getTime() / 1000,
      relative_time_description: "3 weeks ago"
    },
    {
      author_name: "Thomas B.",
      service: "Real Estate",
      rating: 5,
      text: "Selling our home with Tateo & Co exceeded our expectations. Their marketing strategy resulted in multiple offers and we sold above asking price!",
      time: new Date().getTime() / 1000,
      relative_time_description: "1 month ago"
    },
    {
      author_name: "Emily C.",
      service: "Insurance",
      rating: 5,
      text: "Tateo & Co saved us hundreds on our home and auto insurance by bundling policies. Their knowledge of available discounts was impressive.",
      time: new Date().getTime() / 1000,
      relative_time_description: "6 weeks ago"
    },
    {
      author_name: "Kevin P.",
      service: "Property Management",
      rating: 5,
      text: "As a landlord with multiple properties, I appreciate how Tateo & Co handles tenant relations and maintenance issues promptly. They've made property ownership much less stressful.",
      time: new Date().getTime() / 1000,
      relative_time_description: "2 months ago"
    }
  ];
}
