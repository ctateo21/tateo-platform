export interface PropertyTaxEstimate {
  estimatedAnnualTax: number;
  taxRate: number;
  county: string;
  adValoremTax: number;
  nonAdValoremTax: number;
  homesteadExemption: boolean;
  source: 'county_website' | 'estimated';
}

export interface CountyTaxRequest {
  address: string;
  salePrice: number;
  isPrimaryResidence: boolean;
  isVADisabled?: boolean;
}

// Extract county from address
function getCountyFromAddress(address: string): string | null {
  const addressLower = address.toLowerCase();
  
  // Florida counties mapping
  if (addressLower.includes('tampa') || 
      addressLower.includes('hillsborough') ||
      addressLower.includes('plant city') ||
      addressLower.includes('temple terrace')) {
    return 'hillsborough';
  }
  
  // Add more county mappings as needed
  if (addressLower.includes('miami') || addressLower.includes('dade')) {
    return 'miami-dade';
  }
  
  if (addressLower.includes('orlando') || addressLower.includes('orange')) {
    return 'orange';
  }
  
  return null;
}

// Hillsborough County Tax Estimator Integration
async function getHillsboroughCountyTax(request: CountyTaxRequest): Promise<PropertyTaxEstimate> {
  try {
    // Call the existing backend endpoint that interacts with Hillsborough County's tax estimator
    const response = await fetch('/api/property-tax/hillsborough', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: request.address,
        propertyValue: request.salePrice,
        isPrimaryResidence: request.isPrimaryResidence,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.useFallback) {
        // Use fallback for non-Hillsborough addresses
        return getEstimatedPropertyTax(request);
      }
      throw new Error('Failed to fetch Hillsborough County tax data');
    }

    const data = await response.json();
    const taxEstimate = data.taxEstimate;
    
    return {
      estimatedAnnualTax: taxEstimate.annualTax,
      taxRate: (taxEstimate.annualTax / request.salePrice) * 100,
      county: 'Hillsborough County',
      adValoremTax: taxEstimate.annualTax * 0.85, // Approximate split
      nonAdValoremTax: taxEstimate.annualTax * 0.15, // Approximate split
      homesteadExemption: request.isPrimaryResidence,
      source: 'county_website'
    };
  } catch (error) {
    console.error('Error fetching Hillsborough County tax data:', error);
    // Fall back to estimated calculation
    return getEstimatedPropertyTax(request);
  }
}

// Fallback estimation for counties without direct integration
function getEstimatedPropertyTax(request: CountyTaxRequest): PropertyTaxEstimate {
  // Base rate varies by county/state
  let baseRate = 0.015; // 1.5% for Florida default
  
  // Apply homestead exemption if applicable (reduces taxable value)
  const homesteadExemption = request.isPrimaryResidence ? 50000 : 0;
  const taxableValue = Math.max(request.salePrice - homesteadExemption, 0);
  
  const estimatedAnnualTax = taxableValue * baseRate;
  
  return {
    estimatedAnnualTax,
    taxRate: baseRate * 100,
    county: 'Estimated',
    adValoremTax: estimatedAnnualTax * 0.85,
    nonAdValoremTax: estimatedAnnualTax * 0.15,
    homesteadExemption: request.isPrimaryResidence,
    source: 'estimated'
  };
}

// Main function to get property tax estimate
export async function getPropertyTaxEstimate(request: CountyTaxRequest): Promise<PropertyTaxEstimate> {
  const county = getCountyFromAddress(request.address);
  
  switch (county) {
    case 'hillsborough':
      return await getHillsboroughCountyTax(request);
    
    // Add more counties as needed
    case 'miami-dade':
    case 'orange':
    default:
      return getEstimatedPropertyTax(request);
  }
}