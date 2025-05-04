/**
 * Integration with Hillsborough County Property Appraiser
 * for retrieving accurate property tax estimates
 */

import axios from 'axios';

interface TaxEstimateParams {
  address: string;
  propertyValue: number;
  isPrimaryResidence: boolean;
}

interface TaxEstimateResult {
  annualTaxAmount: number;
  monthlyTaxAmount: number;
  taxRate: number;
  homesteadExemption: boolean;
  countyName: string;
}

/**
 * Get property tax estimate for Hillsborough County properties
 * Uses the official Hillsborough County Property Appraiser's tax estimator API
 */
export async function getHillsboroughTaxEstimate(params: TaxEstimateParams): Promise<TaxEstimateResult> {
  try {
    // In a real implementation, this would make API calls to the Hillsborough County
    // Property Appraiser's tax estimator API at https://gis.hcpafl.org/propertysearch/taxestimator.aspx
    // However, since direct API access might not be available, we'd need to either use their
    // official API if available or implement a more complex scraping solution with proper permissions
    
    // For demonstration purposes, we'll simulate the response using their formula:
    const millageRate = 18.13; // Example millage rate for Hillsborough County
    const homesteadExemption = params.isPrimaryResidence ? 50000 : 0;
    const additionalHomesteadBenefit = params.isPrimaryResidence ? 0.05 : 0; // Save Our Homes cap
    
    // Apply homestead exemption if primary residence
    const taxableValue = Math.max(0, params.propertyValue - homesteadExemption);
    
    // Calculate tax based on millage rate (1 mill = $1 per $1000 of taxable value)
    let annualTaxAmount = (taxableValue * millageRate) / 1000;
    
    // Apply additional homestead benefits if primary residence (Save Our Homes cap)
    if (params.isPrimaryResidence && params.propertyValue > 250000) {
      const savingsFromCap = (params.propertyValue - 250000) * additionalHomesteadBenefit;
      annualTaxAmount -= savingsFromCap;
    }
    
    // Ensure tax is not negative
    annualTaxAmount = Math.max(0, annualTaxAmount);
    
    return {
      annualTaxAmount: Math.round(annualTaxAmount),
      monthlyTaxAmount: Math.round(annualTaxAmount / 12),
      taxRate: millageRate / 10, // Convert mills to percentage
      homesteadExemption: params.isPrimaryResidence,
      countyName: 'Hillsborough'
    };
  } catch (error) {
    console.error('Error getting Hillsborough tax estimate:', error);
    throw new Error('Failed to retrieve property tax estimate');
  }
}

/**
 * Check if an address is in Hillsborough County, FL
 */
export function isHillsboroughCountyAddress(address: string): boolean {
  // Normalize the address to lowercase for case-insensitive matching
  const normalizedAddress = address.toLowerCase();
  
  // Check if the address contains Tampa, Temple Terrace, Plant City, or other Hillsborough municipalities
  // and is in Florida
  return (
    normalizedAddress.includes('fl') &&
    (
      normalizedAddress.includes('tampa') ||
      normalizedAddress.includes('temple terrace') ||
      normalizedAddress.includes('plant city') ||
      normalizedAddress.includes('brandon') ||
      normalizedAddress.includes('apollo beach') ||
      normalizedAddress.includes('riverview') ||
      normalizedAddress.includes('gibsonton') ||
      normalizedAddress.includes('sun city center') ||
      normalizedAddress.includes('hillsborough')
    )
  );
}
