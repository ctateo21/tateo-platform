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

// Tateo & Co business identifiers from your provided Google review link
const TATEO_CID = '17830283484417259394';  // LudoCID from the URL parameter
const TATEO_PLACE_ID = 'ChIJJeg0Ii09QIYRgiNHNcTlf_c';  // Original Place ID (may be outdated)
const REVIEW_ACCOUNT_ID = '8679399039741655442';  // From the URL path

export async function fetchGoogleReviews(): Promise<GoogleReview[]> {
  // First, check if API key is available
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.error('Google Maps API key not found in environment');
    throw new Error('Google Maps API key is required');
  }
  
  // Attempt to get reviews using several methods
  try {
    // Most direct approach - use exact business name and location
    const businessName = "Tateo & Co";
    const businessLocation = "Riverview, FL";
    
    console.log(`Attempting to fetch Google reviews for ${businessName} in ${businessLocation}`);
    
    // APPROACH 1: Direct search with very specific query including exact address
    console.log('APPROACH 1: Direct search with exact address');
    const exactAddress = "13194 US-301, Riverview, FL 33578";
    const searchUrl1 = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(businessName + " " + exactAddress)}&key=${apiKey}`;
    
    console.log(`Making request to: ${searchUrl1.replace(apiKey, 'API_KEY_REDACTED')}`);
    const searchResponse1 = await axios.get(searchUrl1);
    console.log(`Text search API response status: ${searchResponse1.data.status}`);
    
    // Log full response for debugging
    if (searchResponse1.data.status !== 'OK') {
      console.error('Text search API error:', JSON.stringify(searchResponse1.data, null, 2));
    }
    
    if (searchResponse1.data.status === 'OK' && searchResponse1.data.results && searchResponse1.data.results.length > 0) {
      const result = searchResponse1.data.results[0];
      const foundPlaceId = result.place_id;
      console.log(`Found place using exact address: ${result.name} (${result.formatted_address}) with ID ${foundPlaceId}`);
      
      // Get reviews using the place ID
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${foundPlaceId}&fields=name,rating,reviews,formatted_address,user_ratings_total&key=${apiKey}`;
      const detailsResponse = await axios.get(detailsUrl);
      
      if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
        const place = detailsResponse.data.result;
        const reviews = place.reviews || [];
        console.log(`Success! Found ${reviews.length} reviews for ${place.name}`);
        
        return reviews.map((review: any) => ({
          ...review,
          service: place.name
        }));
      }
    }
    
    // APPROACH 2: Nearby Search with exact coordinates
    console.log('APPROACH 2: Nearby Search with exact coordinates');
    // These coordinates are for Tateo & Co at 13194 US-301, Riverview, FL
    const lat = 27.8488315;
    const lng = -82.3030728;
    const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=100&keyword=${encodeURIComponent(businessName)}&key=${apiKey}`;
    
    console.log(`Making request to: ${nearbyUrl.replace(apiKey, 'API_KEY_REDACTED')}`);
    const nearbyResponse = await axios.get(nearbyUrl);
    console.log(`Nearby search API response status: ${nearbyResponse.data.status}`);
    
    // Log full response for debugging
    if (nearbyResponse.data.status !== 'OK') {
      console.error('Nearby search API error:', JSON.stringify(nearbyResponse.data, null, 2));
    }
    
    if (nearbyResponse.data.status === 'OK' && nearbyResponse.data.results && nearbyResponse.data.results.length > 0) {
      const result = nearbyResponse.data.results[0];
      const foundPlaceId = result.place_id;
      console.log(`Found place using nearby search: ${result.name} with ID ${foundPlaceId}`);
      
      // Get reviews using the place ID
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${foundPlaceId}&fields=name,rating,reviews,formatted_address,user_ratings_total&key=${apiKey}`;
      const detailsResponse = await axios.get(detailsUrl);
      
      if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
        const place = detailsResponse.data.result;
        const reviews = place.reviews || [];
        console.log(`Success! Found ${reviews.length} reviews for ${place.name}`);
        
        return reviews.map((review: any) => ({
          ...review,
          service: place.name
        }));
      }
    }
    
    // APPROACH 3: Find Place API with phone number
    console.log('APPROACH 3: Find Place with phone number');
    const phoneNumber = "+18134093663"; // Tateo & Co phone number
    const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${phoneNumber}&inputtype=phonenumber&fields=place_id,name,formatted_address&key=${apiKey}`;
    
    console.log(`Making request to: ${findPlaceUrl.replace(apiKey, 'API_KEY_REDACTED')}`);
    const findPlaceResponse = await axios.get(findPlaceUrl);
    console.log(`Find Place API response status: ${findPlaceResponse.data.status}`);
    
    // Log full response for debugging
    if (findPlaceResponse.data.status !== 'OK') {
      console.error('Find Place API error:', JSON.stringify(findPlaceResponse.data, null, 2));
    }
    
    if (findPlaceResponse.data.status === 'OK' && findPlaceResponse.data.candidates && findPlaceResponse.data.candidates.length > 0) {
      const foundPlaceId = findPlaceResponse.data.candidates[0].place_id;
      const foundPlaceName = findPlaceResponse.data.candidates[0].name;
      console.log(`Found place via phone number: ${foundPlaceName} with ID ${foundPlaceId}`);
      
      // Get reviews using the place ID
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${foundPlaceId}&fields=name,rating,reviews,formatted_address,user_ratings_total&key=${apiKey}`;
      const detailsResponse = await axios.get(detailsUrl);
      
      if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
        const place = detailsResponse.data.result;
        const reviews = place.reviews || [];
        console.log(`Success! Found ${reviews.length} reviews for ${place.name}`);
        
        return reviews.map((review: any) => ({
          ...review,
          service: place.name
        }));
      }
    }
    
    // If all approaches fail
    console.error('All attempts to fetch Google reviews have failed');
    throw new Error('Unable to find and fetch Google reviews using multiple methods');
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
