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
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.error('Google Maps API key not found in environment');
    throw new Error('Google Maps API key is required');
  }
  
  // Use Google Maps Places API to search for and get reviews for Tateo & Co
  try {
    console.log(`Attempting to fetch Google reviews for Tateo & Co business with CID: ${TATEO_CID}`);
    
    // Try multiple approaches to get reviews
    
    // Approach 1: Use the highly specific business name and location
    console.log('Using Text Search API with specific business name and location');
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=Tateo+%26+Co+real+estate+13194+US+301+S+Riverview+FL&key=${apiKey}`;
    
    const searchResponse = await axios.get(searchUrl);
    
    if (searchResponse.data.status === 'OK' && searchResponse.data.results && searchResponse.data.results.length > 0) {
      // Found the place via search
      const foundPlaceId = searchResponse.data.results[0].place_id;
      const foundPlaceName = searchResponse.data.results[0].name;
      const formattedAddress = searchResponse.data.results[0].formatted_address || '';
      
      console.log(`Found place via search: ${foundPlaceName} (${formattedAddress}) with ID ${foundPlaceId}`);
      
      // Now get the details with this place ID
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${foundPlaceId}&fields=name,rating,reviews,formatted_address,business_status&key=${apiKey}`;
      const detailsResponse = await axios.get(detailsUrl);
      
      if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
        const reviews = detailsResponse.data.result.reviews || [];
        console.log(`Found ${reviews.length} reviews for place ${detailsResponse.data.result.name}`);
        
        // Add service name to reviews
        return reviews.map((review: any) => ({
          ...review,
          service: detailsResponse.data.result.name || 'Tateo & Co Services'
        }));
      }
    }
    
    // Approach 2: Try find place by ID API with our CID
    console.log('Trying Find Place API with CID');
    const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=Tateo+%26+Co&inputtype=textquery&locationbias=circle:50000@27.8488315,-82.3030728&fields=place_id,name,formatted_address&key=${apiKey}`;
    
    const findPlaceResponse = await axios.get(findPlaceUrl);
    
    if (findPlaceResponse.data.status === 'OK' && findPlaceResponse.data.candidates && findPlaceResponse.data.candidates.length > 0) {
      const foundPlaceId = findPlaceResponse.data.candidates[0].place_id;
      const foundPlaceName = findPlaceResponse.data.candidates[0].name;
      
      console.log(`Found place via Find Place API: ${foundPlaceName} with ID ${foundPlaceId}`);
      
      // Now get the details with this place ID
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${foundPlaceId}&fields=name,rating,reviews,formatted_address&key=${apiKey}`;
      const detailsResponse = await axios.get(detailsUrl);
      
      if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
        const reviews = detailsResponse.data.result.reviews || [];
        console.log(`Found ${reviews.length} reviews for place ${detailsResponse.data.result.name}`);
        
        // Add service name to reviews
        return reviews.map((review: any) => ({
          ...review,
          service: detailsResponse.data.result.name || 'Tateo & Co Services'
        }));
      }
    }
    
    // If we get here, all approaches failed
    console.error('All attempts to fetch Google reviews have failed');
    throw new Error('Unable to fetch Google reviews using available methods');
    
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
