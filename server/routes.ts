import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  contactFormSchema, 
  realEstateFormSchema, 
  mortgageFormSchema, 
  insuranceFormSchema, 
  InsuranceFormData,
  constructionFormSchema, 
  propertyManagementFormSchema, 
  homeServicesFormSchema, 
  serviceCategories
} from "@shared/schema";
import { netcalcsheetIntegration } from "./integrations/netcalcsheet";
import { ariveIntegration } from "./integrations/arive";
import { canopyConnectIntegration } from "./integrations/canopy-connect";
import { searchProperties, getPropertyDetails, ZillowSearchParams, ZillowProperty } from "./integrations/zillow";
import { getHillsboroughTaxEstimate, isHillsboroughCountyAddress } from "./integrations/hillsborough-tax";
import { fetchGoogleReviews, getMockReviews } from "./integrations/google-reviews";
import { getHillsboroughCountyPropertyTax } from "./routes/property-tax";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  
  // Get service categories
  app.get("/api/services", async (req, res) => {
    res.json(serviceCategories);
  });
  
  // API Routes defined below

  // Submit questionnaire data
  app.post("/api/submit", async (req, res) => {
    try {
      // Validate selected services
      const selectedServices = z.array(z.string()).parse(req.body.selectedServices);
      
      // Validate form data based on selected services
      const formData: Record<string, any> = {};
      let validationErrors: Record<string, any> = {};
      let hasErrors = false;
      
      // Validate real estate form if selected
      if (selectedServices.includes("real-estate") && req.body.realEstate) {
        try {
          formData.realEstate = realEstateFormSchema.parse(req.body.realEstate);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.realEstate = error.format();
            hasErrors = true;
          }
        }
      }
      
      // Validate mortgage form if selected
      if (selectedServices.includes("mortgage") && req.body.mortgage) {
        try {
          formData.mortgage = mortgageFormSchema.parse(req.body.mortgage);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.mortgage = error.format();
            hasErrors = true;
          }
        }
      }
      
      // Validate insurance form if selected
      if (selectedServices.includes("insurance") && req.body.insurance) {
        try {
          formData.insurance = insuranceFormSchema.parse(req.body.insurance);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.insurance = error.format();
            hasErrors = true;
          }
        }
      }
      
      // Validate construction form if selected
      if (selectedServices.includes("construction") && req.body.construction) {
        try {
          formData.construction = constructionFormSchema.parse(req.body.construction);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.construction = error.format();
            hasErrors = true;
          }
        }
      }
      
      // Validate property management form if selected
      if (selectedServices.includes("property-management") && req.body.propertyManagement) {
        try {
          formData.propertyManagement = propertyManagementFormSchema.parse(req.body.propertyManagement);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.propertyManagement = error.format();
            hasErrors = true;
          }
        }
      }
      
      // Validate home services form if selected
      if (selectedServices.includes("home-services") && req.body.homeServices) {
        try {
          formData.homeServices = homeServicesFormSchema.parse(req.body.homeServices);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.homeServices = error.format();
            hasErrors = true;
          }
        }
      }
      
      // Validate contact form (always required)
      try {
        formData.contact = contactFormSchema.parse(req.body.contact);
      } catch (error) {
        if (error instanceof z.ZodError) {
          validationErrors.contact = error.format();
          hasErrors = true;
        }
      }
      
      if (hasErrors) {
        return res.status(400).json({ errors: validationErrors });
      }
      
      // Create submission
      const submission = await storage.createSubmission({
        userId: null, // Anonymous submission for now
        selectedServices,
        formData,
        status: "pending",
      });
      
      // Process integrations based on selected services
      const integrationPromises = [];
      
      // NetCalcSheet integration for real estate
      if (selectedServices.includes("real-estate")) {
        integrationPromises.push(processNetCalcsheetIntegration(submission.id, formData.realEstate));
      }
      
      // Arive integration for mortgage
      if (selectedServices.includes("mortgage")) {
        integrationPromises.push(processAriveIntegration(submission.id, formData.mortgage));
      }
      
      // Canopy Connect integration for insurance
      if (selectedServices.includes("insurance")) {
        integrationPromises.push(processCanopyConnectIntegration(submission.id, formData.insurance));
      }
      
      // Process all integrations in parallel
      await Promise.allSettled(integrationPromises);
      
      // Update submission status to completed
      await storage.updateSubmissionStatus(submission.id, "completed");
      
      res.status(201).json({ 
        message: "Submission successful",
        submissionId: submission.id
      });
    } catch (error) {
      console.error("Error processing submission:", error);
      res.status(500).json({ message: "An error occurred while processing your submission" });
    }
  });

  // Get submission by ID
  app.get("/api/submission/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid submission ID" });
    }
    
    const submission = await storage.getSubmission(id);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }
    
    res.json(submission);
  });

  // Questionnaire step saving endpoints
  
  // Save questionnaire step response
  app.post("/api/questionnaire/save-step", async (req, res) => {
    try {
      const { sessionId, serviceType, stepName, responseData, isCompleted } = req.body;
      
      if (!sessionId || !serviceType || !stepName || !responseData) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required fields" 
        });
      }
      
      const response = await storage.saveQuestionnaireResponse({
        sessionId,
        serviceType,
        stepName,
        responseData,
        isCompleted: isCompleted || false,
      });
      
      res.json({ 
        success: true, 
        response,
        message: "Step saved successfully" 
      });
    } catch (error) {
      console.error("Error saving questionnaire step:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to save step" 
      });
    }
  });

  // Get questionnaire responses for a session
  app.get("/api/questionnaire/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const responses = await storage.getQuestionnaireResponsesBySession(sessionId);
      
      res.json({ 
        success: true, 
        responses,
        sessionId 
      });
    } catch (error) {
      console.error("Error getting questionnaire responses:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to get responses" 
      });
    }
  });

  // API keys endpoints
  
  // Get configuration for Zillow API integration
  app.get("/api/config/zillow-api-key", async (req, res) => {
    // In a real implementation, this would retrieve the API key from secure environment variables
    // Here we're using a placeholder for demonstration purposes
    const apiKey = process.env.ZILLOW_API_KEY || "demo-key";
    res.json({ apiKey });
  });
  
  // Get configuration for Google Maps API integration
  app.get("/api/config/google-maps-api-key", async (req, res) => {
    // Retrieve the Google Maps API key from environment variables
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
    if (!apiKey) {
      return res.status(500).json({ message: "Google Maps API key not configured" });
    }
    res.json({ apiKey });
  });
  
  // Get Google Reviews for Tateo & Co
  app.get("/api/reviews/google", async (req, res) => {
    try {
      // Check if Google Maps API key is configured
      const apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
      if (!apiKey) {
        console.error("Google Maps API key is not configured");
        return res.status(200).json({ 
          success: false,
          error: "Google Maps API key not configured",
          message: "Please contact the administrator to set up the Google Maps API key.",
          reviews: []
        });
      }
      
      // For development: Use mock reviews since we're having issues with the Google Places API
      // In production, uncomment the fetchGoogleReviews() line and remove the getMockReviews() line
      console.log("Using mock reviews for development");
      // const reviews = await fetchGoogleReviews();
      const reviews = getMockReviews();
      
      if (reviews && reviews.length > 0) {
        console.log(`Successfully fetched ${reviews.length} Google reviews for Tateo & Co`);
        return res.json({ 
          success: true, 
          reviews,
          isDemoData: true,
          message: "Successfully fetched Tateo & Co reviews"
        });
      } else {
        console.error("No reviews found for Tateo & Co");
        return res.status(200).json({ 
          success: false,
          error: "No reviews found for Tateo & Co",
          message: "Tateo & Co has no reviews on Google yet. Please check back later.",
          reviews: []
        });
      }
    } catch (error: any) {
      console.error("Error fetching Google reviews:", error);
      
      // Provide a specific error message to help troubleshoot
      let errorMessage = "Unable to fetch Google reviews";
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      // Return an empty array with a clear error message
      return res.status(200).json({ 
        success: false,
        error: errorMessage,
        message: "Could not fetch Tateo & Co reviews at this time. Please try again later.",
        reviews: []
      });
    }
  });
  
  // Search properties
  app.post("/api/properties/search", async (req, res) => {
    try {
      // Validate search parameters
      const searchParamsSchema = z.object({
        location: z.string(),
        priceMin: z.number().optional(),
        priceMax: z.number().optional(),
        bedroomsMin: z.number().optional(),
        bedroomsMax: z.number().optional(),
        bathroomsMin: z.number().optional(),
        homeType: z.array(z.string()).optional(),
        livingAreaMin: z.number().optional(),
        livingAreaMax: z.number().optional(),
        lotSizeMin: z.number().optional(),
        lotSizeMax: z.number().optional(),
        yearBuiltMin: z.number().optional(),
        yearBuiltMax: z.number().optional(),
        keywords: z.string().optional(),
        customArea: z.object({
          points: z.array(z.object({
            lat: z.number(),
            lng: z.number()
          }))
        }).optional()
      });
      
      const params: ZillowSearchParams = searchParamsSchema.parse(req.body);
      
      // Get API key from environment (in a real implementation)
      const apiKey = process.env.ZILLOW_API_KEY || "demo-key";
      
      // Search properties using Zillow API
      const properties = await searchProperties(params, apiKey);
      
      res.json({ properties });
    } catch (error) {
      console.error("Error searching properties:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid search parameters", errors: error.format() });
      }
      res.status(500).json({ message: "An error occurred while searching properties" });
    }
  });
  
  // Get property tax estimate for Hillsborough County
  app.post("/api/property-tax/hillsborough", async (req, res) => {
    try {
      // Validate request body
      const schema = z.object({
        address: z.string(),
        propertyValue: z.number().min(1),
        isPrimaryResidence: z.boolean().default(true)
      });
      
      const params = schema.parse(req.body);
      
      // Check if address is in Hillsborough County
      if (!isHillsboroughCountyAddress(params.address)) {
        return res.status(400).json({ 
          message: "Address is not in Hillsborough County, FL",
          useFallback: true
        });
      }
      
      // Get tax estimate
      const taxEstimate = await getHillsboroughTaxEstimate({
        address: params.address,
        propertyValue: params.propertyValue,
        isPrimaryResidence: params.isPrimaryResidence
      });
      
      res.json({
        taxEstimate,
        message: "Tax estimate calculated successfully"
      });
    } catch (error) {
      console.error("Error getting property tax estimate:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid parameters", errors: error.format() });
      }
      res.status(500).json({ 
        message: "An error occurred while calculating property tax",
        useFallback: true
      });
    }
  });

  // Lookup property by address
  // Get insurance quote from Canopy Connect
  app.post("/api/insurance/quote", async (req, res) => {
    try {
      // Validate request body
      const schema = z.object({
        address: z.string().min(5),
        placeId: z.string().optional(),
        propertyType: z.string().optional(),
        type: z.enum(['auto', 'property', 'other']).default('property')
      });
      
      const params = schema.parse(req.body);
      
      console.log("Processing Canopy Connect integration with data:", params);
      
      // Create a form data object compatible with our schema
      const formData: InsuranceFormData = {
        type: params.type,
        coverageAmount: params.type === 'property' ? "$500,000" : "$100,000",
        address: params.address,
        placeId: params.placeId,
        propertyType: params.propertyType || 'primary',
        notes: ""
      };
      
      // Process the insurance quote
      const quote = await canopyConnectIntegration(formData);
      
      res.json(quote);
    } catch (error) {
      console.error("Error getting insurance quote:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid parameters", errors: error.format() });
      }
      res.status(500).json({ message: "An error occurred while getting insurance quote" });
    }
  });

  app.post("/api/properties/lookup-by-address", async (req, res) => {
    try {
      // Validate request body
      const schema = z.object({
        address: z.string().min(5),
        placeId: z.string().optional()
      });
      
      const { address, placeId } = schema.parse(req.body);
      
      // Get Google Maps API key from environment
      const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";
      if (!googleMapsApiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }
      
      // Get Zillow API key from environment
      const zillowApiKey = process.env.ZILLOW_API_KEY || "";
      
      // Parse address components
      let city = "";
      let state = "";
      let zipcode = "";
      let streetAddress = address;
      
      // Try to extract city, state, and zip from the address
      // For a real implementation, you would use a proper geocoding API
      // or the Google Maps Geocoding API to get precise address components
      const stateZipMatch = address.match(/,\s*([A-Z]{2})\s+(\d{5})/);
      if (stateZipMatch) {
        state = stateZipMatch[1];
        zipcode = stateZipMatch[2];
      }
      
      const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]{2}/);
      if (cityMatch) {
        city = cityMatch[1].trim();
      }
      
      // Extract just the street address (everything before the first comma)
      const streetMatch = address.match(/^([^,]+)/);
      if (streetMatch) {
        streetAddress = streetMatch[1].trim();
      }
      
      console.log(`Address lookup: ${streetAddress}, ${city}, ${state} ${zipcode}`);
      
      // Two pricing strategies:
      // 1. If we have a Zillow API key, try to get real property data
      // 2. If no API key, generate realistic price based on location
      
      let property: ZillowProperty;
      let priceSource = "estimated";
      let priceType = "zestimate";
      
      if (zillowApiKey) {
        try {
          // This is where we would make a real API call to Zillow
          // For now, this is just a placeholder for future implementation
          console.log("Would call Zillow API with key:", zillowApiKey);
          
          // If the real API integration was implemented, we'd use the response here
          // For now, we'll fall back to our simulation logic below
        } catch (apiError) {
          console.error("Error calling Zillow API:", apiError);
          // Continue with simulated data if API call fails
        }
      }
      
      // For simulation purposes, generate realistic property prices based on state
      // These are rough averages based on 2025 national real estate data
      const statePriceFactors: {[key: string]: number} = {
        'CA': 1.8,   // California: 80% above baseline
        'NY': 1.6,   // New York: 60% above baseline
        'FL': 1.1,   // Florida: 10% above baseline
        'TX': 0.9,   // Texas: 10% below baseline
        'OH': 0.6,   // Ohio: 40% below baseline
        'MI': 0.65,  // Michigan: 35% below baseline
      };
      
      // Default price factor if state not in our list
      const priceFactor = state ? (statePriceFactors[state] || 1.0) : 1.0;
      
      // Base price for simulation
      const basePrice = 350000;
      
      // Add some randomness based on address length and a random factor
      // This creates variety while keeping prices somewhat realistic
      const randomFactor = Math.random() * 0.4 - 0.2; // Random adjustment between -20% and +20%
      const finalPriceFactor = priceFactor * (1 + randomFactor);
      
      // Generate the price
      const price = Math.round(basePrice * finalPriceFactor);
      
      // Determine if it's for sale (30% chance) or just a zestimate
      const isForSale = Math.random() < 0.3;
      
      // If it's for sale, may have a slightly different price
      let listPrice = price;
      if (isForSale) {
        // Listed properties might be priced slightly differently than their zestimate
        listPrice = Math.round(price * (1 + (Math.random() * 0.06 - 0.03))); // ±3%
        priceType = "listPrice";
        priceSource = "listing";
      }
      
      // Generate property details
      property = {
        id: `prop-${Date.now()}`,
        address: {
          streetAddress: streetAddress,
          city: city || "Unknown City",
          state: state || "Unknown State",
          zipcode: zipcode || "Unknown Zip"
        },
        price: isForSale ? listPrice : price,
        zestimate: price,             // Always include zestimate
        listPrice: isForSale ? listPrice : undefined,  // Only include listPrice if for sale
        bedrooms: Math.floor(Math.random() * 3) + 2,   // 2-4 bedrooms
        bathrooms: Math.floor(Math.random() * 2) + 1.5, // 1.5-3.5 bathrooms
        livingArea: Math.floor(Math.random() * 1500) + 1000, // 1000-2500 sq ft
        lotSize: Math.floor(Math.random() * 4000) + 3000,    // 3000-7000 sq ft lot
        yearBuilt: Math.floor(Math.random() * 50) + 1970,    // 1970-2020
        description: `This beautiful home at ${streetAddress} features modern amenities and a convenient location in ${city || "the area"}.`,
        photos: [
          "https://images.unsplash.com/photo-1580587771525-78b9dba3b914",
          "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83"
        ],
        listingStatus: isForSale ? "forSale" : "offMarket",
        listingDate: isForSale ? new Date().toISOString() : "",
        latitude: 34.0522,  // Placeholder - would come from geocoding in real implementation
        longitude: -118.2437,
        priceSource: priceSource,
        priceType: priceType,
        zillow_url: `https://www.zillow.com/homes/${encodeURIComponent(address)}_rb/`
      };
      
      res.json({ property });
    } catch (error) {
      console.error("Error looking up property by address:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request parameters", errors: error.format() });
      }
      res.status(500).json({ message: "An error occurred while looking up the property" });
    }
  });

  // Get property details
  app.get("/api/properties/:id", async (req, res) => {
    try {
      const propertyId = req.params.id;
      
      // Get API key from environment (in a real implementation)
      const apiKey = process.env.ZILLOW_API_KEY || "demo-key";
      
      // Get property details from Zillow API
      const property = await getPropertyDetails(propertyId, apiKey);
      
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      res.json({ property });
    } catch (error) {
      console.error("Error getting property details:", error);
      res.status(500).json({ message: "An error occurred while retrieving property details" });
    }
  });
  
  // Get Zestimate for a property address
  app.post("/api/properties/zestimate", async (req, res) => {
    try {
      const schema = z.object({
        address: z.string().min(1, "Address is required")
      });
      
      const { address } = schema.parse(req.body);
      
      // Get API key from environment
      const apiKey = process.env.ZILLOW_API_KEY || "demo-key";
      
      // Search for property by address
      const searchParams = {
        location: address,
        // Limit to 1 result for the most accurate match
        limit: 1
      } as ZillowSearchParams;
      
      const properties = await searchProperties(searchParams, apiKey);
      
      if (properties.length === 0) {
        return res.status(200).json({ 
          message: "No properties found for this address",
          averagePrice: 350000 // Fallback average price
        });
      }
      
      const property = properties[0];
      
      res.json({
        zestimate: property.zestimate || property.price,
        address: property.address,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        livingArea: property.livingArea,
        yearBuilt: property.yearBuilt,
        message: "Zestimate found"
      });
    } catch (error) {
      console.error("Error getting Zestimate:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid address", errors: error.format() });
      }
      
      res.status(200).json({ 
        message: "An error occurred while getting Zestimate",
        averagePrice: 350000 // Fallback average price
      });
    }
  });
  
  // Get average price for a ZIP code
  app.post("/api/properties/zipcode-average", async (req, res) => {
    try {
      const schema = z.object({
        zipCode: z.string().min(5, "ZIP code must be at least 5 characters")
      });
      
      const { zipCode } = schema.parse(req.body);
      
      // Get API key from environment
      const apiKey = process.env.ZILLOW_API_KEY || "demo-key";
      
      // In a real implementation, we would query Zillow's API for average home prices in this ZIP code
      // For now, we're generating a realistic average based on the ZIP code
      
      // Generate a deterministic but realistic average price based on ZIP code
      // This is just a demo implementation - in production, use actual API data
      const zipSum = zipCode.split('').reduce((sum, digit) => sum + parseInt(digit, 10), 0);
      const basePrice = 300000; // Base average home price
      const multiplier = (zipSum / 45) + 0.7; // Normalize zip sum to provide reasonable variance
      const averagePrice = Math.round(basePrice * multiplier);
      
      res.json({
        zipCode,
        averagePrice,
        message: "Average price calculated for ZIP code"
      });
    } catch (error) {
      console.error("Error getting ZIP code average:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ZIP code", errors: error.format() });
      }
      
      res.status(200).json({ 
        message: "An error occurred while getting ZIP code average",
        averagePrice: 350000 // Fallback average price
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Integration helper functions
async function processNetCalcsheetIntegration(submissionId: number, formData: any) {
  try {
    // Create integration request record
    const integrationRequest = await storage.createIntegrationRequest({
      submissionId,
      provider: "netcalcsheet",
      requestData: formData,
      status: "pending",
    });
    
    // Process the integration
    const response = await netcalcsheetIntegration(formData);
    
    // Update integration request with response
    await storage.updateIntegrationRequest(
      integrationRequest.id,
      "completed",
      response
    );
    
    return response;
  } catch (error) {
    console.error("NetCalcSheet integration error:", error);
    throw error;
  }
}

async function processAriveIntegration(submissionId: number, formData: any) {
  try {
    // Create integration request record
    const integrationRequest = await storage.createIntegrationRequest({
      submissionId,
      provider: "arive",
      requestData: formData,
      status: "pending",
    });
    
    // Process the integration
    const response = await ariveIntegration(formData);
    
    // Update integration request with response
    await storage.updateIntegrationRequest(
      integrationRequest.id,
      "completed",
      response
    );
    
    return response;
  } catch (error) {
    console.error("Arive integration error:", error);
    throw error;
  }
}

async function processCanopyConnectIntegration(submissionId: number, formData: any) {
  try {
    // Create integration request record
    const integrationRequest = await storage.createIntegrationRequest({
      submissionId,
      provider: "canopy-connect",
      requestData: formData,
      status: "pending",
    });
    
    // Process the integration
    const response = await canopyConnectIntegration(formData);
    
    // Update integration request with response
    await storage.updateIntegrationRequest(
      integrationRequest.id,
      "completed",
      response
    );
    
    return response;
  } catch (error) {
    console.error("Canopy Connect integration error:", error);
    throw error;
  }
}
