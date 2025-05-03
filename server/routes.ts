import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  contactFormSchema, 
  realEstateFormSchema, 
  mortgageFormSchema, 
  insuranceFormSchema, 
  constructionFormSchema, 
  propertyManagementFormSchema, 
  homeServicesFormSchema, 
  serviceCategories
} from "@shared/schema";
import { netcalcsheetIntegration } from "./integrations/netcalcsheet";
import { ariveIntegration } from "./integrations/arive";
import { canopyConnectIntegration } from "./integrations/canopy-connect";
import { searchProperties, getPropertyDetails, ZillowSearchParams, ZillowProperty } from "./integrations/zillow";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  
  // Get service categories
  app.get("/api/services", async (req, res) => {
    res.json(serviceCategories);
  });

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

  // Zillow API endpoints
  
  // Get configuration for Zillow API integration
  app.get("/api/config/zillow-api-key", async (req, res) => {
    // In a real implementation, this would retrieve the API key from secure environment variables
    // Here we're using a placeholder for demonstration purposes
    const apiKey = process.env.ZILLOW_API_KEY || "demo-key";
    res.json({ apiKey });
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
  
  // Lookup property by address
  app.post("/api/properties/lookup-by-address", async (req, res) => {
    try {
      // Validate request body
      const schema = z.object({
        address: z.string().min(5),
        placeId: z.string().optional()
      });
      
      const { address, placeId } = schema.parse(req.body);
      
      // Get API key from environment
      const apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }
      
      // In a real implementation, we would use the address and place_id to get property details from Zillow API
      // Since we're simulating, we'll generate a realistic property with the address in the details
      
      // Generate a realistic price based on address length (just for simulation)
      // In a real implementation, this would be the actual Zillow API call
      const basePrice = 350000;
      const randomFactor = Math.random() * 400000 - 200000; // Random adjustment between -$200k and +$200k
      const price = Math.round(basePrice + randomFactor);
      
      // Generate a mock property object
      const property: ZillowProperty = {
        id: `prop-${Date.now()}`,
        address: {
          streetAddress: address,
          city: "Sample City",
          state: "CA",
          zipcode: "90210"
        },
        price: price,
        bedrooms: Math.floor(Math.random() * 4) + 2, // 2-5 bedrooms
        bathrooms: Math.floor(Math.random() * 3) + 1, // 1-3 bathrooms
        livingArea: Math.floor(Math.random() * 2000) + 1000, // 1000-3000 sq ft
        lotSize: Math.floor(Math.random() * 5000) + 2000, // 2000-7000 sq ft lot
        yearBuilt: Math.floor(Math.random() * 50) + 1970, // 1970-2020
        description: `This beautiful home at ${address} features modern amenities and a great location.`,
        photos: [
          "https://images.unsplash.com/photo-1580587771525-78b9dba3b914",
          "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83"
        ],
        listingStatus: "forSale",
        listingDate: new Date().toISOString(),
        latitude: 34.0522,
        longitude: -118.2437
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
