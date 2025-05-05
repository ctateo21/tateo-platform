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

// Tateo & Co CID from the Google Maps URL
const TATEO_CID = '15770577126747253634';  // Extracted from your Google Maps review URL

export async function fetchGoogleReviews(): Promise<GoogleReview[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.error('Google Maps API key not found in environment');
    throw new Error('Google Maps API key is required');
  }
  
  // Use Google Maps Places API to search for and get reviews for Tateo & Co
  try {
    console.log(`Attempting to fetch Google reviews for Tateo & Co business`);
    
    // Start with Text Search API to find the place first
    console.log('Using Text Search API to find Tateo & Co');
    
    // Option 2: Using Text Search API to find the place first
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=Tateo+%26+Co+real+estate+Tampa&key=${apiKey}`;
    const searchResponse = await axios.get(searchUrl);
    
    if (searchResponse.data.status === 'OK' && searchResponse.data.results && searchResponse.data.results.length > 0) {
      // Found the place via search
      const foundPlaceId = searchResponse.data.results[0].place_id;
      const foundPlaceName = searchResponse.data.results[0].name;
      console.log(`Found place via search: ${foundPlaceName} with ID ${foundPlaceId}`);
      
      // Now get the details with this place ID
      const secondDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${foundPlaceId}&fields=name,rating,reviews,formatted_address&key=${apiKey}`;
      const detailsResponse = await axios.get(secondDetailsUrl);
      
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
    
    // If we get here, both approaches failed
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
