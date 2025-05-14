import { apiRequest } from './queryClient';

/**
 * Get Zillow Zestimate or average listing price for an address
 */
export async function getZestimate(address: string): Promise<{ 
  zestimate?: number, 
  averagePrice?: number 
}> {
  try {
    const response = await apiRequest(
      'POST', 
      '/api/properties/zestimate', 
      { address }
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Zestimate:', error);
    return {};
  }
}

/**
 * Get average listing price for a ZIP code
 */
export async function getZipCodeAverage(zipCode: string): Promise<{ 
  averagePrice?: number 
}> {
  try {
    const response = await apiRequest(
      'POST', 
      '/api/properties/zipcode-average', 
      { zipCode }
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching ZIP code average:', error);
    return {};
  }
}

/**
 * Format a price value as currency
 */
export function formatPrice(price?: number): string {
  if (!price) return '';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}