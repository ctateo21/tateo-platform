import { InsuranceFormData } from "@shared/schema";

/**
 * Integration with Canopy Connect API for insurance services
 */
export async function canopyConnectIntegration(formData: InsuranceFormData) {
  try {
    // In a real implementation, we would make API calls to Canopy Connect
    // For this MVP, we'll simulate the integration
    
    console.log("Processing Canopy Connect integration with data:", formData);
    
    // Simulate API response delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Prepare response data based on form inputs
    const response = {
      quoteId: `CC-${Date.now()}`,
      insuranceType: formData.type,
      estimatedPremium: calculateEstimatedPremium(formData),
      coverageOptions: generateCoverageOptions(formData),
      carriers: getRecommendedCarriers(formData),
      discounts: getAvailableDiscounts(formData),
      nextSteps: generateNextSteps(formData),
      timestamp: new Date().toISOString()
    };
    
    return response;
  } catch (error) {
    console.error("Canopy Connect integration error:", error);
    throw new Error("Failed to process insurance quote");
  }
}

// Helper functions to simulate real calculations
function calculateEstimatedPremium(formData: InsuranceFormData) {
  // This would be a real calculation based on Canopy Connect's algorithms
  // For now, we'll use a simple placeholder calculation
  
  // Base premium by insurance type (default to property insurance)
  const insuranceType = formData.type || "property";
  const basePremium = {
    auto: 1200,
    property: 1800,
    other: 1500
  }[insuranceType];
  
  // Adjust based on coverage amount if provided
  let coverageMultiplier = 1.0;
  if (formData.coverageAmount) {
    const amount = parseFloat(formData.coverageAmount.replace(/[^\d.]/g, ''));
    if (formData.type === 'auto') {
      coverageMultiplier = amount > 100000 ? 1.3 : 1.0;
    } else if (formData.type === 'property') {
      coverageMultiplier = amount > 500000 ? 1.5 : 1.0;
    }
  }
  
  const annualPremium = basePremium * coverageMultiplier;
  const monthlyPremium = annualPremium / 12;
  
  return {
    monthly: `$${Math.round(monthlyPremium).toLocaleString()}/month`,
    annual: `$${Math.round(annualPremium).toLocaleString()}/year`
  };
}

function generateCoverageOptions(formData: InsuranceFormData) {
  // Generate coverage options based on the insurance type
  if (formData.type === 'auto') {
    return [
      {
        name: "Basic Coverage",
        description: "Liability coverage that meets state requirements",
        premium: "$80/month"
      },
      {
        name: "Standard Coverage",
        description: "Liability plus collision and comprehensive coverage",
        premium: "$120/month"
      },
      {
        name: "Premium Coverage",
        description: "Maximum coverage with low deductibles and roadside assistance",
        premium: "$160/month"
      }
    ];
  } else if (formData.type === 'property') {
    return [
      {
        name: "Basic Homeowners",
        description: "Standard dwelling and personal property coverage",
        premium: "$125/month"
      },
      {
        name: "Enhanced Protection",
        description: "Higher limits with additional coverage for valuables",
        premium: "$175/month"
      },
      {
        name: "Complete Protection",
        description: "Maximum coverage with flood and earthquake protection",
        premium: "$250/month"
      }
    ];
  } else {
    return [
      {
        name: "Basic Plan",
        description: "Essential coverage for your needs",
        premium: "$100/month"
      },
      {
        name: "Enhanced Plan",
        description: "Additional protection with higher limits",
        premium: "$150/month"
      }
    ];
  }
}

function getRecommendedCarriers(formData: InsuranceFormData) {
  // This would fetch real carrier recommendations from Canopy Connect
  // For now, we'll return placeholder data
  const commonCarriers = ["Progressive", "State Farm", "Allstate"];
  
  if (formData.type === 'auto') {
    return [...commonCarriers, "GEICO", "Liberty Mutual"];
  } else if (formData.type === 'property') {
    return [...commonCarriers, "Farmers", "Nationwide"];
  } else {
    return [...commonCarriers, "Travelers", "Chubb"];
  }
}

function getAvailableDiscounts(formData: InsuranceFormData) {
  // Return available discounts based on insurance type
  if (formData.type === 'auto') {
    return [
      "Safe Driver Discount",
      "Multi-Vehicle Discount",
      "Bundling Discount",
      "Good Student Discount",
      "Anti-theft Device Discount"
    ];
  } else if (formData.type === 'property') {
    return [
      "Home Security System Discount",
      "Bundling Discount",
      "New Home Discount",
      "Fire Protection Discount",
      "Claims-Free Discount"
    ];
  } else {
    return [
      "Bundling Discount",
      "Loyalty Discount",
      "Group Discount"
    ];
  }
}

function generateNextSteps(formData: InsuranceFormData) {
  return [
    "Review and select coverage options",
    "Provide detailed information for final quote",
    "Choose your preferred insurance carrier",
    "Schedule policy start date",
    "Complete final application and payment"
  ];
}
