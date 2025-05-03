/**
 * Integration with Zillow API for property search and display
 */

// Define the types for Zillow property data
export interface ZillowProperty {
  id: string;
  address: {
    streetAddress: string;
    city: string;
    state: string;
    zipcode: string;
  };
  price: number;             // Current price (either listPrice if for sale, or zestimate if not)
  zestimate?: number;        // Zillow's estimate of the property value
  listPrice?: number;        // Only present if property is for sale
  bedrooms: number;
  bathrooms: number;
  livingArea: number;        // square feet
  lotSize: number;           // square feet
  yearBuilt: number;
  description: string;
  photos: string[];
  listingStatus: 'forSale' | 'sold' | 'offMarket';
  listingDate?: string;      // Only present if property is for sale or sold
  latitude: number;
  longitude: number;
  priceSource?: string;      // Where the price data came from: 'listing', 'estimated', 'zestimate', etc.
  priceType?: string;        // The type of price: 'listPrice', 'zestimate', etc.
  zillow_url?: string;       // URL to the property on Zillow
}

export interface ZillowSearchParams {
  location: string;
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  bedroomsMax?: number;
  bathroomsMin?: number;
  homeType?: string[];
  livingAreaMin?: number;
  livingAreaMax?: number;
  lotSizeMin?: number;
  lotSizeMax?: number;
  yearBuiltMin?: number;
  yearBuiltMax?: number;
  keywords?: string;
  customArea?: { points: { lat: number; lng: number }[] };
}

/**
 * Search for properties using Zillow API
 */
export async function searchProperties(params: ZillowSearchParams, apiKey: string): Promise<ZillowProperty[]> {
  // In a real implementation, this would make an API call to Zillow
  // using the provided API key and search parameters
  
  console.log('Searching Zillow with params:', params);
  console.log('Using API key:', apiKey);
  
  // For demonstration purposes, return mock data
  return generateMockProperties(params);
}

/**
 * Get details for a specific property by ID
 */
export async function getPropertyDetails(propertyId: string, apiKey: string): Promise<ZillowProperty | null> {
  // In a real implementation, this would make an API call to Zillow
  // to get detailed information about a specific property
  
  console.log('Getting property details for ID:', propertyId);
  console.log('Using API key:', apiKey);
  
  // For demonstration purposes, return mock data
  const mockProperties = generateMockProperties({ location: '' });
  return mockProperties.find(p => p.id === propertyId) || null;
}

/**
 * Get recommended properties based on user preferences
 */
export async function getRecommendedProperties(userId: string, apiKey: string): Promise<ZillowProperty[]> {
  // In a real implementation, this would make an API call to Zillow
  // to get property recommendations based on user preferences
  
  console.log('Getting recommended properties for user:', userId);
  console.log('Using API key:', apiKey);
  
  // For demonstration purposes, return mock data
  return generateMockProperties({ location: '' }).slice(0, 3);
}

/**
 * Generate mock property data for demonstration purposes
 * In a real implementation, this would be replaced with actual API calls
 */
function generateMockProperties(params: Partial<ZillowSearchParams>): ZillowProperty[] {
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
  const streets = ['Main St', 'Oak Ave', 'Maple Rd', 'Washington Blvd', 'Lincoln Dr'];
  const states = ['NY', 'CA', 'IL', 'TX', 'AZ'];
  const zipcodes = ['10001', '90001', '60601', '77001', '85001'];
  
  const location = params.location || '';
  let filteredCities = cities;
  
  if (location) {
    filteredCities = cities.filter(city => 
      city.toLowerCase().includes(location.toLowerCase())
    );
    if (filteredCities.length === 0) {
      filteredCities = [cities[0]]; // Default to first city if no matches
    }
  }
  
  // Generate between 5-10 properties
  const count = Math.floor(Math.random() * 6) + 5;
  const properties: ZillowProperty[] = [];
  
  for (let i = 0; i < count; i++) {
    const cityIndex = Math.floor(Math.random() * filteredCities.length);
    const city = filteredCities[cityIndex];
    const stateIndex = cities.indexOf(city);
    const state = states[stateIndex >= 0 ? stateIndex : 0];
    const zipcode = zipcodes[stateIndex >= 0 ? stateIndex : 0];
    
    const streetNumber = Math.floor(Math.random() * 9000) + 1000;
    const streetIndex = Math.floor(Math.random() * streets.length);
    const street = streets[streetIndex];
    
    const price = (Math.floor(Math.random() * 900) + 100) * 1000;
    const bedrooms = Math.floor(Math.random() * 5) + 1;
    const bathrooms = Math.floor(Math.random() * 3) + 1;
    const livingArea = (Math.floor(Math.random() * 3000) + 1000);
    const lotSize = livingArea + (Math.floor(Math.random() * 5000));
    const yearBuilt = Math.floor(Math.random() * 70) + 1950;
    
    // Apply filters if provided
    if (params.priceMin && price < params.priceMin) continue;
    if (params.priceMax && price > params.priceMax) continue;
    if (params.bedroomsMin && bedrooms < params.bedroomsMin) continue;
    if (params.bedroomsMax && bedrooms > params.bedroomsMax) continue;
    
    properties.push({
      id: `prop-${Date.now()}-${i}`,
      address: {
        streetAddress: `${streetNumber} ${street}`,
        city,
        state,
        zipcode
      },
      price,
      bedrooms,
      bathrooms,
      livingArea,
      lotSize,
      yearBuilt,
      description: `Beautiful ${bedrooms} bedroom, ${bathrooms} bathroom home in ${city}. This property features ${livingArea} sq ft of living space on a ${lotSize} sq ft lot.`,
      photos: [
        'https://picsum.photos/800/600',
        'https://picsum.photos/800/600',
        'https://picsum.photos/800/600'
      ],
      listingStatus: 'forSale',
      listingDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
      // Generate random coordinates centered roughly in the US
      latitude: 37 + (Math.random() * 10 - 5),
      longitude: -95 + (Math.random() * 20 - 10)
    });
  }
  
  return properties;
}