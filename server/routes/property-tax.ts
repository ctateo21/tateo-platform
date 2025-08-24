import { Request, Response } from 'express';

interface HillsboroughTaxRequest {
  address: string;
  salePrice: number;
  homestead: boolean;
}

interface HillsboroughTaxResponse {
  estimatedAnnualTax: number;
  taxRate: number;
  adValoremTax: number;
  nonAdValoremTax: number;
  folio?: string;
}

// Hillsborough County Property Tax Estimator Integration
export async function getHillsboroughCountyPropertyTax(req: Request, res: Response) {
  try {
    const { address, salePrice, homestead }: HillsboroughTaxRequest = req.body;

    if (!address || !salePrice) {
      return res.status(400).json({
        error: 'Address and sale price are required'
      });
    }

    console.log(`Fetching property tax for: ${address}, $${salePrice}, Homestead: ${homestead}`);

    // Step 1: Search for the property by address
    const searchUrl = 'https://gis.hcpafl.org/propertysearch/taxestimator.aspx';
    
    // Use a headless approach to simulate the tax estimator interaction
    const taxData = await simulateHillsboroughTaxEstimator(address, salePrice, homestead);
    
    res.json(taxData);
  } catch (error) {
    console.error('Error fetching Hillsborough County property tax:', error);
    res.status(500).json({
      error: 'Failed to fetch property tax data',
      fallback: true
    });
  }
}

// Simulate the Hillsborough County tax estimator workflow
async function simulateHillsboroughTaxEstimator(
  address: string, 
  salePrice: number, 
  homestead: boolean
): Promise<HillsboroughTaxResponse> {
  try {
    // For now, we'll implement a calculation based on known Hillsborough County rates
    // In a production environment, you would use a headless browser (Puppeteer) 
    // or find an API to interact with the actual tax estimator
    
    // Hillsborough County rates (2024 estimates)
    const millageRate = 20.0; // Approximate total millage rate
    const assessmentRatio = 1.0; // Florida assesses at 100% for non-homestead
    
    // Apply homestead exemption
    let taxableValue = salePrice;
    if (homestead) {
      taxableValue = Math.max(salePrice - 50000, 0); // $50k homestead exemption
    }
    
    // Calculate taxes
    const estimatedAnnualTax = (taxableValue * millageRate) / 1000;
    const taxRate = (estimatedAnnualTax / salePrice) * 100;
    
    // Split between ad valorem and non-ad valorem (approximate)
    const adValoremTax = estimatedAnnualTax * 0.85;
    const nonAdValoremTax = estimatedAnnualTax * 0.15;
    
    return {
      estimatedAnnualTax: Math.round(estimatedAnnualTax * 100) / 100,
      taxRate: Math.round(taxRate * 100) / 100,
      adValoremTax: Math.round(adValoremTax * 100) / 100,
      nonAdValoremTax: Math.round(nonAdValoremTax * 100) / 100,
      folio: generateMockFolio(address)
    };
  } catch (error) {
    console.error('Error in tax calculation:', error);
    throw error;
  }
}

// Generate a mock folio number for demonstration
function generateMockFolio(address: string): string {
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `${hash % 1000000}`;
}

// Enhanced version that could use Puppeteer for actual website interaction
// This would be the implementation for production use
async function getActualHillsboroughTaxData(
  address: string, 
  salePrice: number, 
  homestead: boolean
): Promise<HillsboroughTaxResponse> {
  // This would require Puppeteer to:
  // 1. Navigate to https://gis.hcpafl.org/propertysearch/taxestimator.aspx#/nav/Search
  // 2. Enter the address in the search field
  // 3. Click on the matching result
  // 4. Enter the sale price
  // 5. Set homestead exemption
  // 6. Click calculate
  // 7. Extract the tax amounts
  
  // For now, return the simulated data
  return simulateHillsboroughTaxEstimator(address, salePrice, homestead);
}