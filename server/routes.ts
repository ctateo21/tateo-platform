import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = _require("pdf-parse");
import { storage } from "./storage";
import { getLiveRates } from "./refi-rates";
import { analyzeMortgageStatement } from "./anthropic-analyze";
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
import { canopyConnectIntegration } from "./integrations/canopy-connect";
import { searchProperties, getPropertyDetails, ZillowSearchParams, ZillowProperty } from "./integrations/zillow";
import { getHillsboroughTaxEstimate, isHillsboroughCountyAddress } from "./integrations/hillsborough-tax";
import { fetchGoogleReviews, getMockReviews } from "./integrations/google-reviews";
import { getHillsboroughCountyPropertyTax } from "./routes/property-tax";
import { fetchZillowProperty, derivePolicyType, buildNormalizedPropertyKey, type PropertyScenario } from "./integrations/apify-zillow";
import { supabaseAdmin } from "./supabase";
import { db } from "./db";
import { userSubscriptions } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  createSubscriptionCheckout,
  retrieveCheckoutSession,
  getSubscriptionStatus,
  isActiveStatus,
} from "./stripe";
import { sendWelcomeEmail, sendInternalAlert } from "./integrations/property-alert-emails";
import { getOrGenerateMarketAnalysis, type ListingInput } from "./integrations/listing-market-analysis";
import { enrichListingFromPropertyCache } from "./integrations/listing-enrichment";
import {
  getMarketAnalysisForDisplay,
  precomputeWeeklyMarketAnalysesForAllSellerScenarios,
} from "./integrations/market-analysis-scheduler";

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
  
  // Area Median Income lookup: geocode → Census tract → ACS median household income
  let _amiCache: Map<string, { data: Record<string, any>; ts: number }> = new Map();
  app.get("/api/ami", async (req, res) => {
    const address = (req.query.address as string || "").trim();
    if (!address) return res.status(400).json({ error: "address required" });

    const cacheKey = address.toLowerCase();
    const cached = _amiCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
      return res.json(cached.data);
    }

    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY || "";

      // 1. Geocode address → lat/lng + address components via Google Maps
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
      const geoRes = await fetch(geoUrl);
      const geoJson = await geoRes.json();
      if (!geoJson.results?.length) return res.status(404).json({ error: "Address not found" });

      const { lat, lng } = geoJson.results[0].geometry.location;
      const components: Array<{ long_name: string; short_name: string; types: string[] }> =
        geoJson.results[0].address_components || [];
      const stateComp = components.find((c) => c.types.includes("administrative_area_level_1"));
      const countyComp = components.find((c) => c.types.includes("administrative_area_level_2"));
      const stateName = stateComp?.short_name ?? "";
      const countyName = countyComp?.long_name.replace(" County", "").replace(" Parish", "").trim() ?? "";

      // 2. Census Geocoder: lat/lng → FIPS state + county codes
      const censusUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`;
      const censusRes = await fetch(censusUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TateoApp/1.0)" },
      });
      const censusText = await censusRes.text();
      let stateFips = "";
      let countyFips = "";
      if (censusText.trim().startsWith("{")) {
        const censusJson = JSON.parse(censusText);
        const county = censusJson?.result?.geographies?.["Counties"]?.[0];
        if (county) {
          stateFips = String(county.STATE).padStart(2, "0");
          countyFips = String(county.COUNTY).padStart(3, "0");
        }
      }

      // Fall back: look up FIPS via address endpoint if coordinates didn't work
      if (!stateFips || !countyFips) {
        const addrUrl = `https://geocoding.geo.census.gov/geocoder/geographies/address?street=${encodeURIComponent(address)}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`;
        const addrRes = await fetch(addrUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; TateoApp/1.0)" },
        });
        const addrText = await addrRes.text();
        if (addrText.trim().startsWith("{")) {
          const addrJson = JSON.parse(addrText);
          const match = addrJson?.result?.addressMatches?.[0]?.geographies?.["Counties"]?.[0];
          if (match) {
            stateFips = String(match.STATE).padStart(2, "0");
            countyFips = String(match.COUNTY).padStart(3, "0");
          }
        }
      }

      if (!stateFips || !countyFips) {
        return res.status(404).json({ error: "Could not determine county for this address" });
      }

      // 3. Census Reporter API (free, no key) — median household income for this county
      const geoId = `05000US${stateFips}${countyFips}`;
      const crUrl = `https://api.censusreporter.org/1.0/data/show/latest?table_ids=B19013&geo_ids=${geoId}`;
      const crRes = await fetch(crUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TateoApp/1.0)" },
      });
      const crText = await crRes.text();
      if (!crText.trim().startsWith("{")) {
        console.error("Census Reporter returned non-JSON:", crText.substring(0, 200));
        return res.status(500).json({ error: "Census income data unavailable" });
      }
      const crJson = JSON.parse(crText);
      const annualMedian = Math.round(crJson?.data?.[geoId]?.B19013?.estimate?.B19013001 ?? 0);
      const areaName = crJson?.geography?.[geoId]?.name ?? `${countyName}, ${stateName}`;

      if (!annualMedian || annualMedian <= 0) {
        return res.status(404).json({ error: "Income data not available for this area" });
      }

      const result = {
        areaName,
        annualAMI: annualMedian,
        monthlyAMI: Math.round(annualMedian / 12),
        source: "U.S. Census Bureau ACS 5-Year",
      };
      _amiCache.set(cacheKey, { data: result, ts: Date.now() });
      res.json(result);
    } catch (err) {
      console.error("AMI lookup failed:", err);
      res.status(500).json({ error: "Failed to fetch AMI data" });
    }
  });

  // FEMA flood zone lookup: geocode → NFHL ArcGIS query
  let _floodCache: Map<string, { data: Record<string, any>; ts: number }> = new Map();
  app.get("/api/flood-zone", async (req, res) => {
    const address = (req.query.address as string || "").trim();
    if (!address) return res.status(400).json({ error: "address required" });

    const cacheKey = address.toLowerCase();
    const cached = _floodCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
      return res.json(cached.data);
    }

    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY || "";

      // 1. Geocode address → lat/lng
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
      const geoRes = await fetch(geoUrl);
      const geoJson = await geoRes.json();
      if (!geoJson.results?.length) return res.status(404).json({ error: "Address not found" });

      const { lat, lng } = geoJson.results[0].geometry.location;

      // 2. Query FEMA NFHL ArcGIS – Flood Hazard Areas (layer 28)
      const femaUrl = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json&inSR=4326`;
      const femaRes = await fetch(femaUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TateoApp/1.0)" },
      });
      const femaJson = await femaRes.json();

      const feature = femaJson?.features?.[0]?.attributes;
      const zone: string = (feature?.FLD_ZONE ?? "UNKNOWN").trim().toUpperCase();
      const subtype: string = (feature?.ZONE_SUBTY ?? "").trim().toUpperCase();

      // X and X500 (0.2% annual chance) are low-risk — no required flood insurance
      const isLowRisk =
        zone === "X" ||
        zone === "X500" ||
        subtype.includes("0.2 PCT") ||
        subtype.includes("MINIMAL");

      const data = { zone, subtype, requiresFloodInsurance: !isLowRisk, lat, lng };
      _floodCache.set(cacheKey, { data, ts: Date.now() });
      return res.json(data);
    } catch (err) {
      console.error("Flood zone lookup failed:", err);
      res.status(500).json({ error: "Failed to fetch flood zone data" });
    }
  });

  // Live mortgage rates scraped from mortgagenewsdaily.com (cached 1 hr)
  let _ratesCache: { rates: Record<string, any>; ts: number } | null = null;
  app.get("/api/mortgage-rates", async (req, res) => {
    try {
      if (_ratesCache && Date.now() - _ratesCache.ts < 60 * 60 * 1000) {
        return res.json(_ratesCache.rates);
      }
      const response = await fetch("https://www.mortgagenewsdaily.com/mortgage-rates", {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Tateo/1.0)" },
      });
      const html = await response.text();

      const extractRate = (text: string, label: string): number | null => {
        // Find the "30 Yr. <label>" heading, then grab the first rate% within the next 1000 chars
        const anchor = `30 Yr. ${label}`;
        const headIdx = text.indexOf(anchor);
        if (headIdx === -1) return null;
        const section = text.substring(headIdx, headIdx + 1000);
        // Look for the <div class="rate"> block
        const rateDiv = section.indexOf('<div class="rate">');
        if (rateDiv === -1) return null;
        const after = section.substring(rateDiv, rateDiv + 80);
        const m = after.match(/([\d.]+)%/);
        if (!m) return null;
        const v = parseFloat(m[1]);
        return v >= 3 && v <= 15 ? v : null;
      }

      const rates = {
        conventional: extractRate(html, "Fixed") ?? 6.82,
        fha:          extractRate(html, "FHA")   ?? 6.38,
        va:           extractRate(html, "VA")    ?? 6.25,
        source: "mortgagenewsdaily.com",
        lastUpdated: new Date().toISOString(),
      };
      _ratesCache = { rates, ts: Date.now() };
      res.json(rates);
    } catch (err) {
      console.error("Failed to fetch mortgage rates:", err);
      res.json({ conventional: 6.82, fha: 6.38, va: 6.25, source: "fallback", lastUpdated: null });
    }
  });

  // Full live rates in LiveRatesResponse format (for refinance calculator)
  const _upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.get("/api/rates", async (req, res) => {
    try {
      const rates = await getLiveRates();
      res.json(rates);
    } catch (err) {
      console.error("Error fetching rates:", err);
      res.status(500).json({ error: "Failed to fetch rates" });
    }
  });

  app.post("/api/analyze-statement", _upload.single("file"), async (req, res) => {
    try {
      let documentText = "";
      if (req.file) {
        if (req.file.mimetype === "application/pdf") {
          const data = await pdfParse(req.file.buffer);
          documentText = data.text;
        } else if (req.file.mimetype.startsWith("text/")) {
          documentText = req.file.buffer.toString("utf-8");
        } else {
          res.status(400).json({ success: false, error: "Unsupported file type. Please upload a PDF or text file." });
          return;
        }
      } else if (req.body.documentText) {
        documentText = req.body.documentText;
      } else {
        res.status(400).json({ success: false, error: "Please upload a file or provide document text." });
        return;
      }
      if (!process.env.ANTHROPIC_API_KEY) {
        res.status(500).json({ success: false, error: "Anthropic API key not configured." });
        return;
      }
      const analysis = await analyzeMortgageStatement(documentText);
      res.json({ success: true, analysis });
    } catch (error) {
      console.error("Error analyzing statement:", error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to analyze statement" });
    }
  });

  // Get Google Reviews for Havo
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
      // const reviews = await fetchGoogleReviews();
      const reviews = getMockReviews();
      
      if (reviews && reviews.length > 0) {
        return res.json({ 
          success: true, 
          reviews,
          isDemoData: true,
          message: "Successfully fetched Havo reviews"
        });
      } else {
        console.error("No reviews found for Havo");
        return res.status(200).json({ 
          success: false,
          error: "No reviews found for Havo",
          message: "Havo has no reviews on Google yet. Please check back later.",
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
        message: "Could not fetch Havo reviews at this time. Please try again later.",
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
      
      
      // Create a form data object compatible with our schema
      const formData: InsuranceFormData = {
        type: params.type,
        coverageAmount: params.type === 'property' ? "$500,000" : "$100,000",
        address: params.address,
        placeId: params.placeId,
        propertyType: (params.propertyType as InsuranceFormData["propertyType"]) || 'primary',
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

  // ─── Lead Capture ──────────────────────────────────────────────────────────
  // In-memory stores (survives process lifetime; use a DB for persistence)
  const _verifyCodes = new Map<string, { code: string; expiresAt: number }>();
  type CapturedLead = { email: string; phone: string; address: string; createdAt: string };
  const _leads: CapturedLead[] = [];

  async function sendSms(to: string, body: string): Promise<void> {
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from  = process.env.TWILIO_PHONE_NUMBER;
    if (!sid || !token || !from) {
      return;
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const params = new URLSearchParams({ To: to, From: from, Body: body });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twilio error: ${err}`);
    }
  }

  // POST /api/leads/send-code
  app.post("/api/leads/send-code", async (req, res) => {
    try {
      const { phone } = z.object({ phone: z.string().min(10) }).parse(req.body);
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10) return res.status(400).json({ error: "Invalid phone number" });
      const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
      const isTwilioConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      _verifyCodes.set(e164, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
      if (isTwilioConfigured) {
        await sendSms(e164, `Your Havo verification code is: ${code}`);
        res.json({ ok: true, smsEnabled: true });
      } else {
        // Twilio not configured — skip SMS, return auto-verify code so frontend can bypass the step
        res.json({ ok: true, smsEnabled: false, autoCode: code });
      }
    } catch (err: any) {
      console.error("send-code error:", err);
      res.status(500).json({ error: err.message || "Failed to send code" });
    }
  });

  // POST /api/leads/verify
  app.post("/api/leads/verify", async (req, res) => {
    try {
      const { firstName, lastName, email, phone, code, address, agent, scenarioDetails, referral } = z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(10),
        code: z.string().length(6),
        address: z.string().optional(),
        agent: z.string().optional(),
        scenarioDetails: z.string().optional(),
        referral: referralSchema,
      }).parse(req.body);
      const digits = phone.replace(/\D/g, "");
      const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
      const stored = _verifyCodes.get(e164);
      if (!stored) return res.status(400).json({ error: "No code sent to this number. Request a new code." });
      if (Date.now() > stored.expiresAt) {
        _verifyCodes.delete(e164);
        return res.status(400).json({ error: "Code expired. Request a new code." });
      }
      if (stored.code !== code) return res.status(400).json({ error: "Incorrect code. Please try again." });
      _verifyCodes.delete(e164);

      // Save lead locally
      if (!_leads.find(l => l.email === email || l.phone === e164)) {
        _leads.push({ email, phone: e164, address: address || "", createdAt: new Date().toISOString() });
        console.log(`[LEAD] New lead: ${firstName} ${lastName} | ${email} | ${e164} | agent: ${agent || "none"}`);
      }

      // Create contact in FollowUpBoss (non-blocking — don't fail the verify if FUB errors)
      createFollowUpBossContact({ firstName, lastName, email, phone: e164, address, agent, scenarioDetails, referral }).catch(err =>
        console.error("[FUB] Failed to create contact:", err.message)
      );

      // Welcome email (non-blocking — never crash the verify if email fails)
      sendWelcomeEmail({ to: email, firstName }).catch(err =>
        console.error("[welcome-email] failed:", err?.message ?? err)
      );

      res.json({ ok: true });
    } catch (err: any) {
      console.error("verify error:", err);
      res.status(400).json({ error: err.message || "Verification failed" });
    }
  });

  // ─── FollowUpBoss integration ───────────────────────────────────────────────

  function fubHeaders(apiKey: string) {
    // FUB Basic auth: API key as username, empty password
    return {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Basic " + Buffer.from(`${apiKey}:`).toString("base64"),
    };
  }

  // GET /api/leads/test-fub — verify API key, list users, AND send a test event
  app.get("/api/leads/test-fub", async (_req, res) => {
    const apiKey = process.env.FOLLOWUPBOSS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "FOLLOWUPBOSS_API_KEY not set on server" });

    const result: Record<string, any> = { keyPresent: true, keyLength: apiKey.length };

    // Step 1: auth check
    try {
      const r = await fetch("https://api.followupboss.com/v1/users", {
        headers: fubHeaders(apiKey),
      });
      const data = await r.json();
      if (!r.ok) {
        result.authStatus = r.status;
        result.authError = data;
        return res.status(r.status).json(result);
      }
      result.authStatus = 200;
      result.users = (data.users || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email }));
    } catch (err: any) {
      result.authError = err.message;
      return res.status(500).json(result);
    }

    // Step 2: try three formats to find what works for assignedTo
    const formats = [
      { label: "no-assign",    payload: { source: "Tateo & Co Website", type: "Property Inquiry", message: "Test A", person: { firstName: "FmtA", lastName: "Test", email: "fmta@example.com", phone: "8135550020" } } },
      { label: "top-level",    payload: { source: "Tateo & Co Website", type: "Property Inquiry", message: "Test B", assignedTo: "christian@tateoco.com", person: { firstName: "FmtB", lastName: "Test", email: "fmtb@example.com", phone: "8135550021" } } },
      { label: "person-email", payload: { source: "Tateo & Co Website", type: "Property Inquiry", message: "Test C", person: { firstName: "FmtC", lastName: "Test", email: "fmtc@example.com", phone: "8135550022", assignedTo: "christian@tateoco.com" } } },
      { label: "person-name",  payload: { source: "Tateo & Co Website", type: "Property Inquiry", message: "Test D", person: { firstName: "FmtD", lastName: "Test", email: "fmtd@example.com", phone: "8135550023", assignedTo: "Christian Tateo" } } },
    ];
    result.formatTests = [];
    for (const { label, payload } of formats) {
      try {
        const r = await fetch("https://api.followupboss.com/v1/events", {
          method: "POST",
          headers: fubHeaders(apiKey),
          body: JSON.stringify(payload),
        });
        const text = await r.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        result.formatTests.push({ label, status: r.status, ok: r.ok, assignedTo: data?.person?.assignedTo ?? null, error: r.ok ? undefined : data });
      } catch (err: any) {
        result.formatTests.push({ label, error: err.message });
      }
    }
    result.eventOk = result.formatTests.some((t: any) => t.ok);

    console.log("[FUB] Test result:", JSON.stringify(result));
    res.json(result);
  });

  // FUB agent ID mapping (from /v1/users): used for PATCH /v1/people/{id}
  const FUB_AGENT_IDS: Record<string, number> = {
    "Christian Tateo": 1,
    "Omar Andujar":    2,
    "Kyle Schweinitz": 5,
    "Team":            1,
  };

  function formatPhoneDisplay(raw: string): string {
    const d = raw.replace(/\D/g, "");
    if (d.length === 11 && d[0] === "1") return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
    return d;
  }

  // Normalize phone to 10-digit US local format (strip leading 1 / + / formatting)
  function normalizePhoneDigits(raw: string): string {
    const d = (raw || "").replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("1")) return d.slice(1);
    return d;
  }

  // Look up an existing FUB person by email. Returns the person id, or null if not found.
  async function findFubPersonByEmail(apiKey: string, email: string): Promise<number | null> {
    try {
      const url = `https://api.followupboss.com/v1/people?email=${encodeURIComponent(email)}&limit=1`;
      const r = await fetch(url, { headers: fubHeaders(apiKey) });
      if (!r.ok) {
        if (r.status !== 404) console.warn(`[FUB] Person lookup ${r.status}:`, await r.text());
        return null;
      }
      const data = await r.json();
      const person = (data?.people || [])[0];
      return person?.id ?? null;
    } catch (err: any) {
      console.warn("[FUB] Person lookup error:", err.message);
      return null;
    }
  }

  // Human-readable label per referral source kind. Kept in sync with the
  // ReferralSourceDialog options on the client.
  const REFERRAL_SOURCE_LABELS: Record<string, string> = {
    licensed_professional: "Licensed Professional",
    social_media:          "Social Media",
    word_of_mouth:         "Word of Mouth",
  };
  const REFERRAL_PLATFORM_LABELS: Record<string, string> = {
    instagram: "Instagram",
    facebook:  "Facebook",
    tiktok:    "TikTok",
    youtube:   "YouTube",
    linkedin:  "LinkedIn",
    google:    "Google",
    other:     "Other",
  };

  // Zod schema for the optional referral block. Accepted by every endpoint
  // that may create a FUB contact so the answer to "How did you hear from
  // us?" follows the lead all the way into Follow Up Boss.
  const referralSchema = z.object({
    referral_source: z.enum(["licensed_professional", "social_media", "word_of_mouth"]),
    referral_name: z.string().optional(),
    referral_platform: z.enum(["instagram","facebook","tiktok","youtube","linkedin","google","other"]).optional(),
    referral_notes: z.string().optional(),
  }).optional();
  type ReferralPayload = z.infer<typeof referralSchema>;

  function formatReferralBlock(r: ReferralPayload): string | null {
    if (!r) return null;
    const lines = ["How they heard from us:"];
    lines.push(`Source: ${REFERRAL_SOURCE_LABELS[r.referral_source] ?? r.referral_source}`);
    if (r.referral_source === "licensed_professional" && r.referral_name?.trim()) {
      lines.push(`Referral Name: ${r.referral_name.trim()}`);
    }
    if (r.referral_source === "social_media" && r.referral_platform) {
      lines.push(`Platform: ${REFERRAL_PLATFORM_LABELS[r.referral_platform] ?? r.referral_platform}`);
    }
    if (r.referral_source === "word_of_mouth" && r.referral_name?.trim()) {
      lines.push(`Referral Name: ${r.referral_name.trim()}`);
    }
    if (r.referral_notes?.trim()) lines.push(`Notes: ${r.referral_notes.trim()}`);
    return lines.join("\n");
  }

  async function createFollowUpBossContact(params: {
    firstName: string; lastName: string; email: string;
    phone: string; address?: string; agent?: string; scenarioDetails?: string;
    messageHeader?: string;
    referral?: ReferralPayload;
  }) {
    const apiKey = process.env.FOLLOWUPBOSS_API_KEY;
    if (!apiKey) {
      console.log("[FUB] FOLLOWUPBOSS_API_KEY not set — skipping contact creation.");
      return { ok: false, noteAdded: false, personId: null as number | null, skipped: true, error: "FOLLOWUPBOSS_API_KEY not set" };
    }

    // "Team" always assigns to Christian Tateo (id: 1)
    const agentName = params.agent === "Team" ? "Christian Tateo" : (params.agent || "Christian Tateo");
    const agentId   = FUB_AGENT_IDS[agentName] ?? 1;

    const phoneDigits = normalizePhoneDigits(params.phone);
    const messageParts = [
      params.messageHeader || `Property: ${params.address || "address not provided"}`,
      `Agent: ${agentName}`,
    ];
    if (params.scenarioDetails) messageParts.push(params.scenarioDetails);
    const referralBlock = formatReferralBlock(params.referral);
    if (referralBlock) messageParts.push(referralBlock);
    const noteBody = messageParts.join("\n");

    // Step 1: look up existing contact by email to avoid creating duplicates
    const emailNorm = params.email.toLowerCase().trim();
    let personId: number | null = await findFubPersonByEmail(apiKey, emailNorm);
    let noteAdded = false;
    let noteError: string | null = null;

    if (personId) {
      // Existing contact — just add a note instead of creating a new contact.
      console.log(`[FUB] Existing person ${personId} found for ${emailNorm}; adding note`);
      try {
        const noteRes = await fetch("https://api.followupboss.com/v1/notes", {
          method: "POST",
          headers: fubHeaders(apiKey),
          body: JSON.stringify({
            personId,
            subject: messageParts[0].slice(0, 200),
            body: noteBody,
            isHtml: false,
          }),
        });
        if (!noteRes.ok) {
          const errText = await noteRes.text();
          noteError = `note POST ${noteRes.status}: ${errText}`;
          console.warn(`[FUB] Note POST failed ${noteRes.status}:`, errText);
        } else {
          noteAdded = true;
          console.log(`[FUB] Note added to person ${personId}`);
        }
      } catch (err: any) {
        noteError = err?.message ?? String(err);
        console.warn("[FUB] Note error:", noteError);
      }
    } else {
      // No existing contact — create one via /v1/events (also sends the message).
      const person: Record<string, any> = {
        firstName: params.firstName,
        lastName:  params.lastName,
        email:     params.email,
      };
      if (phoneDigits) person.phone = phoneDigits;
      const payload: Record<string, any> = {
        source:  "Tateo & Co Website",
        type:    "Property Inquiry",
        message: noteBody,
        person,
      };
      if (params.address) payload.property = { street: params.address };

      console.log(`[FUB] No existing contact for ${emailNorm}; creating via /v1/events (agent: ${agentName} / id:${agentId})`);

      const res = await fetch("https://api.followupboss.com/v1/events", {
        method: "POST",
        headers: fubHeaders(apiKey),
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!res.ok) {
        console.error(`[FUB] Error ${res.status}:`, text);
        throw new Error(`FUB ${res.status}: ${text}`);
      }
      personId = data?.person?.id ?? data?.id ?? null;
      noteAdded = true; // the /v1/events call also delivers the message/note
      console.log(`[FUB] Contact created: ${params.firstName} ${params.lastName} | event id: ${data.id ?? "unknown"} | person id: ${personId ?? "unknown"}`);
    }

    // Step 2: PUT /v1/people/{id} to ensure assignment + email + phone are set in FUB's required format
    if (personId) {
      try {
        const personUpdate: Record<string, any> = {
          assignedUserId: agentId,
          emails: [{ value: params.email, type: "work" }],
        };
        if (phoneDigits) {
          personUpdate.phones = [{ value: formatPhoneDisplay(phoneDigits), type: "mobile" }];
        }
        const putRes = await fetch(`https://api.followupboss.com/v1/people/${personId}`, {
          method: "PUT",
          headers: fubHeaders(apiKey),
          body: JSON.stringify(personUpdate),
        });
        if (putRes.ok) {
          console.log(`[FUB] Updated person ${personId}: assigned to ${agentName} (userId:${agentId})`);
        } else {
          const putErr = await putRes.text();
          console.warn(`[FUB] Person PUT failed ${putRes.status}:`, putErr);
        }
      } catch (putErr: any) {
        console.warn("[FUB] Person PUT error:", putErr.message);
      }
    }

    return { ok: noteAdded, noteAdded, personId, skipped: false, error: noteError };
  }

  // Simple per-IP rate limiter for the notify endpoint (max 10/min per IP)
  const _notifyHits = new Map<string, number[]>();

  // Dedupe window for account events (keyed by `${userId}:${event}`) so a
  // rapid re-login doesn't spam Follow Up Boss with sign-in notes.
  const _accountEventSeen = new Map<string, number>();
  function notifyRateLimited(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60_000;
    const hits = (_notifyHits.get(ip) || []).filter(t => now - t < windowMs);
    if (hits.length >= 10) { _notifyHits.set(ip, hits); return true; }
    hits.push(now);
    _notifyHits.set(ip, hits);
    return false;
  }

  // POST /api/leads/notify-new-scenario
  // Called when a logged-in user adds another property to their dashboard.
  // Sends a FUB event so the assigned agent knows the customer is exploring a new property.
  app.post("/api/leads/notify-new-scenario", async (req, res) => {
    try {
      const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
      if (notifyRateLimited(ip)) {
        return res.status(429).json({ error: "Too many notifications. Please wait a moment." });
      }
      const { firstName, lastName, email, phone, agent, address, scenarioType, scenarioDetails, referral } = z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional().default(""),
        agent: z.string().optional(),
        address: z.string().min(1),
        scenarioType: z.string().optional().default("Scenario"),
        scenarioDetails: z.string().optional(),
        referral: referralSchema,
      }).parse(req.body);

      console.log(`[LEAD] New property scenario: ${email} → ${address} (agent: ${agent || "Team"})`);

      // Non-blocking — never fail the request if FUB has an issue
      createFollowUpBossContact({
        firstName,
        lastName,
        email,
        phone,
        address,
        agent,
        scenarioDetails,
        referral,
        messageHeader: `Customer added another property to their dashboard: ${address}`,
      }).catch(err => console.error("[FUB] notify-new-scenario failed:", err.message));

      // Internal team alert (non-blocking — never crash the request if email fails)
      sendInternalAlert({
        scenarioType,
        userEmail: email,
        address,
        summary: scenarioDetails ?? "",
      }).catch(err => console.error("[internal-alert] notify-new-scenario failed:", err?.message ?? err));

      res.json({ ok: true });
    } catch (err: any) {
      console.error("notify-new-scenario error:", err);
      res.status(400).json({ error: err.message || "Failed to notify agent" });
    }
  });

  // POST /api/fub/showing-request
  // Fired when a user taps "Schedule your showing now" on Purchase with Loan
  // (Likely Qualifies only) or Purchase with Cash. Notifies Follow Up Boss
  // with the property address. The tel: link is handled entirely client-side
  // and is NEVER blocked by this endpoint — if FUB fails the user can still
  // call. Works for logged-in and logged-out visitors: with an email we
  // create/append the FUB contact note; either way the team gets an internal
  // alert email so anonymous requests still reach us.
  app.post("/api/fub/showing-request", async (req, res) => {
    try {
      const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
      if (notifyRateLimited(ip)) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }
      const body = z.object({
        address: z.string().min(1),
        service: z.enum(["purchase_with_loan", "purchase_with_cash"]),
        eventType: z.enum([
          "showing_request_started",
          "showing_request_text_selected",
          "showing_request_call_selected",
        ]).optional(),
        contactMethod: z.enum(["text", "call"]).nullish(),
        qualificationStatus: z.string().optional(),
        estimatedPrice: z.number().optional(),
        normalizedPropertyKey: z.string().optional(),
        pageUrl: z.string().optional().default(""),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional().default(""),
        agent: z.string().optional(),
        userId: z.string().optional(),
      }).parse(req.body);

      const serviceLabel = body.service === "purchase_with_loan" ? "Purchase with Loan" : "Purchase with Cash";
      const contactLabel = body.contactMethod === "text" ? "Text" : body.contactMethod === "call" ? "Call" : "";
      // Headline + lead-in line vary by which step of the flow fired this.
      const eventType = body.eventType ?? "showing_request_started";
      const eventTitle =
        eventType === "showing_request_text_selected"
          ? "User selected Text for showing request."
          : eventType === "showing_request_call_selected"
          ? "User selected Call for showing request."
          : "Showing request started from Havo.";
      console.log("[api/fub/showing-request] request received");
      console.log(`[api/fub/showing-request] property address: ${body.address}`);
      console.log(`[api/fub/showing-request] user email: ${body.email || "(none)"}`);
      console.log(`[api/fub/showing-request] user phone: ${body.phone || "(none)"}`);
      console.log(`[showing-alert-env] RESEND_API_KEY present ${!!process.env.RESEND_API_KEY}`);
      console.log(`[showing-alert-env] ALERT_FROM_EMAIL present ${!!process.env.ALERT_FROM_EMAIL}`);
      console.log(`[showing-alert-env] INTERNAL_ALERT_EMAIL present ${!!process.env.INTERNAL_ALERT_EMAIL}`);
      console.log(`[showing-alert-env] ALERT_FROM_EMAIL uses updates.tateoco.com ${(process.env.ALERT_FROM_EMAIL || "").includes("updates.tateoco.com")}`);
      console.log(`[showing-request] ${serviceLabel} → ${body.address} (event: ${eventType}, user: ${body.email || "anonymous"}, contact: ${body.contactMethod || "n/a"})`);
      console.log("[showing-request-schema] sql needed no");

      const priceLine = typeof body.estimatedPrice === "number" && body.estimatedPrice > 0
        ? `Estimated Price: $${Math.round(body.estimatedPrice).toLocaleString()}`
        : "";
      // Resolve a display name from first/last (the "-" placeholder lastName
      // means "no last name supplied", so drop it).
      const contactName = [
        body.firstName,
        body.lastName && body.lastName !== "-" ? body.lastName : "",
      ].filter((p) => (p || "").trim()).join(" ").trim();
      const contactEmail = body.email || "Not provided";
      const contactPhone = body.phone || "Not provided";
      const noteBody = [
        eventTitle,
        "",
        "Contact:",
        `Name: ${contactName || "Not provided"}`,
        `Email: ${contactEmail}`,
        `Phone: ${contactPhone}`,
        "",
        `Property: ${body.address}`,
        "",
        contactLabel ? `Preferred contact action: ${contactLabel}` : "",
        `Service: ${serviceLabel}`,
        body.qualificationStatus ? `Qualification Status: ${body.qualificationStatus}` : "",
        priceLine,
        body.pageUrl ? `Page: ${body.pageUrl}` : "",
        eventType === "showing_request_started"
          ? "The user clicked Schedule your showing now. Follow up even if no call/text was completed."
          : "",
      ].filter(Boolean).join("\n");

      // 1) Follow Up Boss — only when we have an email to match/create a contact.
      // This CRM note is unchanged in behaviour; we now await it so the response
      // can report its outcome alongside the email alert.
      const fub: { ok: boolean; noteAdded: boolean; skipped: boolean; error: string | null } =
        { ok: false, noteAdded: false, skipped: false, error: null };
      if (body.email) {
        console.log("[api/fub/showing-request] FUB note start");
        console.log("[fub-showing] contact lookup", body.email);
        try {
          const r = await createFollowUpBossContact({
            firstName: body.firstName || body.email.split("@")[0],
            lastName: body.lastName || "-",
            email: body.email,
            phone: body.phone || "",
            address: body.address,
            agent: body.agent,
            scenarioDetails: noteBody,
            messageHeader: `Showing requested: ${body.address}`,
          });
          fub.ok = r.ok;
          fub.noteAdded = r.noteAdded;
          fub.skipped = r.skipped;
          fub.error = r.error;
          if (r.ok) {
            console.log("[api/fub/showing-request] FUB note success");
            console.log("[fub-showing] note/event created");
          } else {
            console.warn(`[api/fub/showing-request] FUB note not added: ${r.error || (r.skipped ? "skipped" : "unknown")}`);
          }
        } catch (err: any) {
          fub.error = err?.message ?? String(err);
          console.error("[fub-showing] error", fub.error);
        }
      } else {
        fub.skipped = true;
        console.log("[fub-showing] no email on request — internal alert only");
      }

      // 2) Internal team email — always, so anonymous showing requests reach us.
      // Sent via the verified Resend domain (updates.tateoco.com).
      console.log("[api/fub/showing-request] email alert start");
      const alert = await sendInternalAlert({
        scenarioType: `Showing Requested — ${serviceLabel}`,
        userEmail: body.email || "logged-out visitor",
        address: body.address,
        summary: noteBody,
        contact: {
          name: contactName,
          email: body.email || "",
          phone: body.phone || "",
        },
      });
      const fromDomain = (alert.from.match(/@([^>\s]+)/)?.[1]) || "(none)";
      console.log(`[api/fub/showing-request] email recipient ${alert.to || "(none)"}`);
      console.log(`[api/fub/showing-request] email from domain ${fromDomain}`);
      const email = {
        ok: alert.status === "sent",
        status: alert.status,
        to: alert.to || null,
        from: alert.from || null,
        error: alert.error,
      };
      if (email.ok) {
        console.log("[api/fub/showing-request] email alert success");
      } else {
        console.error(`[api/fub/showing-request] email alert error: ${alert.error || alert.status}`);
      }

      // Partial success is fine: the popup/SMS/tel never depend on this response.
      console.log("[api/fub/showing-request] success");
      res.json({ ok: fub.ok || email.ok, fub, email });
    } catch (err: any) {
      console.error("[api/fub/showing-request] error:", err);
      res.status(400).json({ ok: false, error: err.message || "Failed to log showing request" });
    }
  });

  // POST /api/leads/account-event
  // Notifies Follow Up Boss when a user creates a free account or signs in.
  // Creates the contact if missing (account_created) or adds a note to the
  // existing contact (typical for account_signed_in). Auth-required and
  // non-blocking, with a short per-user dedupe on sign-ins. Only fired on
  // real signup/sign-in actions by the client — never on a session
  // restore/refresh — so sign-in notifications aren't duplicated on reload.
  app.post("/api/leads/account-event", async (req, res) => {
    // Identity is taken from the verified Supabase session, never the body —
    // this endpoint cannot be used to forge CRM events for arbitrary emails.
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const { event } = z.object({
        event: z.enum(["account_created", "account_signed_in"]),
      }).parse(req.body);

      const email = (user.email || "").toLowerCase().trim();
      if (!email) return res.status(400).json({ error: "No email on session" });

      // Dedupe: skip a repeat sign-in note within 5 minutes for the same
      // user. account_created is naturally once per user.
      const dedupeKey = `${user.id}:${event}`;
      const now = Date.now();
      const last = _accountEventSeen.get(dedupeKey) || 0;
      if (event === "account_signed_in" && now - last < 5 * 60_000) {
        console.log(`[fub] duplicate prevention result: skipped ${event} for ${user.id}`);
        return res.status(202).json({ ok: true, deduped: true });
      }
      _accountEventSeen.set(dedupeKey, now);

      const meta = (user.user_metadata || {}) as Record<string, any>;
      const parts = String(meta.name || "").trim().split(/\s+/).filter(Boolean);
      const firstName = parts[0] || "Havo";
      const lastName = parts.slice(1).join(" ") || "User";
      const phone = String(meta.phone || "");
      const messageHeader =
        event === "account_created"
          ? "User created a free account in the platform."
          : "User signed into their account.";

      console.log(`[fub] ${event} start`);

      // Non-blocking — never fail the request if FUB has an issue.
      createFollowUpBossContact({
        firstName,
        lastName,
        email,
        phone,
        agent: "Team",
        messageHeader,
      })
        .then(() => console.log(`[fub] ${event} success`))
        .catch((err) => console.error(`[fub] ${event} error:`, err.message));

      res.status(202).json({ ok: true });
    } catch (err: any) {
      console.error("account-event error:", err);
      res.status(400).json({ error: err.message || "Failed to record account event" });
    }
  });

  // POST /api/leads/update-profile
  // Called when a logged-in user changes their name/email/phone in Settings.
  // Looks up the FUB contact by their previous email and updates it in place.
  app.post("/api/leads/update-profile", async (req, res) => {
    try {
      const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
      if (notifyRateLimited(ip)) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }
      const { previousEmail, firstName, lastName, email, phone, agent } = z.object({
        previousEmail: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional().default(""),
        agent: z.string().optional(),
      }).parse(req.body);

      const apiKey = process.env.FOLLOWUPBOSS_API_KEY;
      if (!apiKey) {
        console.log("[FUB] FOLLOWUPBOSS_API_KEY not set — skipping profile update.");
        return res.json({ ok: true, skipped: true });
      }

      // Look up by previous email; if not found, also try the new email
      let personId = await findFubPersonByEmail(apiKey, previousEmail.toLowerCase().trim());
      if (!personId && email.toLowerCase().trim() !== previousEmail.toLowerCase().trim()) {
        personId = await findFubPersonByEmail(apiKey, email.toLowerCase().trim());
      }

      if (!personId) {
        console.log(`[FUB] No existing contact for ${previousEmail}; skipping profile update.`);
        return res.json({ ok: true, found: false });
      }

      const phoneDigits = normalizePhoneDigits(phone);
      const agentName = agent === "Team" ? "Christian Tateo" : (agent || "Christian Tateo");
      const agentId = FUB_AGENT_IDS[agentName] ?? 1;

      const personUpdate: Record<string, any> = {
        firstName,
        lastName,
        assignedUserId: agentId,
        emails: [{ value: email, type: "work" }],
      };
      if (phoneDigits) {
        personUpdate.phones = [{ value: formatPhoneDisplay(phoneDigits), type: "mobile" }];
      }

      const putRes = await fetch(`https://api.followupboss.com/v1/people/${personId}`, {
        method: "PUT",
        headers: fubHeaders(apiKey),
        body: JSON.stringify(personUpdate),
      });
      if (!putRes.ok) {
        const errText = await putRes.text();
        console.warn(`[FUB] Profile update failed ${putRes.status}:`, errText);
        return res.status(502).json({ error: `Failed to update contact (${putRes.status}).` });
      }

      console.log(`[FUB] Profile updated for person ${personId}: ${firstName} ${lastName} <${email}>`);
      res.json({ ok: true, personId });
    } catch (err: any) {
      console.error("update-profile error:", err);
      res.status(400).json({ error: err.message || "Failed to update profile" });
    }
  });

  // POST /api/leads/invite-user
  // Called when a logged-in user invites someone to share their account.
  // Creates a FUB contact for the invitee assigned to the same agent and adds a note on the inviter's record.
  app.post("/api/leads/invite-user", async (req, res) => {
    try {
      const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
      if (notifyRateLimited(ip)) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }
      const { inviterFirstName, inviterLastName, inviterEmail, inviterPhone, agent, inviteeName, inviteeEmail } = z.object({
        inviterFirstName: z.string().min(1),
        inviterLastName: z.string().min(1),
        inviterEmail: z.string().email(),
        inviterPhone: z.string().optional().default(""),
        agent: z.string().optional(),
        inviteeName: z.string().min(1),
        inviteeEmail: z.string().email(),
      }).parse(req.body);

      const inviterFullName = `${inviterFirstName} ${inviterLastName}`.trim();
      const trimmedInvitee = inviteeName.trim();
      const [first, ...rest] = trimmedInvitee.split(/\s+/);
      const inviteeFirst = first || inviteeEmail.split("@")[0];
      const inviteeLast = rest.join(" ") || "-";

      console.log(`[LEAD] Invite: ${inviterEmail} → ${inviteeEmail} (agent: ${agent || "Team"})`);

      // Create/update the invitee contact in FUB, assigned to the inviter's agent.
      createFollowUpBossContact({
        firstName: inviteeFirst,
        lastName: inviteeLast,
        email: inviteeEmail,
        phone: "",
        agent,
        messageHeader: `Invited by ${inviterFullName} (${inviterEmail}) to share their Havo account.`,
      }).catch(err => console.error("[FUB] invite-user invitee failed:", err.message));

      // Add a note to the inviter's FUB record too.
      createFollowUpBossContact({
        firstName: inviterFirstName,
        lastName: inviterLastName,
        email: inviterEmail,
        phone: inviterPhone,
        agent,
        messageHeader: `Added a shared account user: ${trimmedInvitee} (${inviteeEmail})`,
      }).catch(err => console.error("[FUB] invite-user inviter failed:", err.message));

      res.json({ ok: true });
    } catch (err: any) {
      console.error("invite-user error:", err);
      res.status(400).json({ error: err.message || "Failed to send invite" });
    }
  });

  // GET /api/leads (simple admin view — protect in production)
  app.get("/api/leads", (_req, res) => {
    res.json({ count: _leads.length, leads: _leads });
  });

  // ── POST /api/zillow-property-lookup ──────────────────────────────
  // Backend-only Apify Zillow Scraper. Successful results are cached
  // indefinitely in Supabase `property_cache` keyed by a NORMALIZED
  // property key (street# + street name + ZIP5 + state, no city) so the
  // same property entered with different formatting — or under a
  // different city name (e.g. Google says St. Petersburg, Zillow says
  // Kenneth City) — shares one cache entry. Cached entries do NOT
  // auto-expire; the original successful scrape stays stable for as long
  // as the property is owned. To force a re-pull (e.g. after a sale)
  // delete the row from `property_cache`.

  // In-process dedup so concurrent lookups for the same property don't
  // double-scrape Apify. Keyed by cacheKey, value is the in-flight
  // Promise; cleared once it resolves/rejects. Effective per server
  // instance — best-effort only.
  const inFlightZillow = new Map<string, Promise<PropertyScenario>>();

  app.post("/api/zillow-property-lookup", async (req, res) => {
    const addressOrUrl = String(req.body?.addressOrUrl ?? "").trim();
    if (!addressOrUrl) {
      return res.status(400).json({ error: "addressOrUrl is required" });
    }
    // Namespaced cache key. URLs and addresses live in distinct keyspaces
    // so a URL that happens to look like an address can never collide.
    // - URLs: drop query strings + trailing slashes so the same listing
    //   fetched with different tracking params shares one entry.
    // - Addresses: use the NORMALIZED property key (street + zip + state)
    //   when parseable, falling back to a sanitized raw string only when
    //   the address is too sparse to normalize.
    const isUrl = /^https?:\/\//i.test(addressOrUrl);
    let cacheKey: string;
    if (isUrl) {
      try {
        const u = new URL(addressOrUrl);
        const path = u.pathname.replace(/\/+$/, "");
        cacheKey = `url:${u.host.toLowerCase()}${path.toLowerCase()}`;
      } catch {
        cacheKey = `url:${addressOrUrl.toLowerCase()}`;
      }
    } else {
      const normalizedKey = buildNormalizedPropertyKey(addressOrUrl);
      cacheKey = normalizedKey
        ?? `addr:raw:${addressOrUrl.toLowerCase().replace(/\s+/g, " ").trim()}`;
    }

    // 1. Cache check (only if Supabase admin is configured). Successful
    // entries are served regardless of age — see header comment.
    let cachedNormalized: any = null;
    if (supabaseAdmin) {
      try {
        const { data: cached } = await supabaseAdmin
          .from("property_cache")
          .select("normalized, fetched_at")
          .eq("cache_key", cacheKey)
          .maybeSingle();
        if (cached?.normalized) {
          const ageMs = cached.fetched_at
            ? Date.now() - new Date(cached.fetched_at).getTime()
            : null;
          const cachedPhotosCount = Array.isArray((cached.normalized as any).photos)
            ? (cached.normalized as any).photos.length
            : 0;
          // Photo back-fill: if the cached normalized blob has photos
          // already, serve immediately. Otherwise fall through and
          // re-scrape — old cache entries from before the photo-fix
          // may have empty arrays.
          if (cachedPhotosCount > 0) {
            return res.json({ cached: true, property: cached.normalized });
          }
          cachedNormalized = cached.normalized;
        } else {
        }
      } catch (e: any) {
        console.warn("[zillow-lookup] cache read failed:", e?.message);
      }
    }

    // 2. Live Apify call — deduped by cacheKey so two concurrent requests
    // for the same property share one Apify run.
    let property: PropertyScenario;
    try {
      let inFlight = inFlightZillow.get(cacheKey);
      if (inFlight) {
      } else {
        inFlight = fetchZillowProperty(addressOrUrl);
        inFlightZillow.set(cacheKey, inFlight);
        // Clear the dedup slot when the scrape settles. The `.finally()`
        // returns a NEW promise that rejects in lockstep with `inFlight`
        // when the scrape fails (e.g. "No Zillow results found"); without
        // the trailing `.catch()` that rejection is unhandled and Node 20
        // treats it as fatal, crashing the whole server. The real error is
        // still surfaced to the request via the `await inFlight` below.
        void inFlight
          .finally(() => {
            // Clear only if the slot still points at this same promise.
            if (inFlightZillow.get(cacheKey) === inFlight) {
              inFlightZillow.delete(cacheKey);
            }
          })
          .catch(() => {});
      }
      property = await inFlight;
      // Data safety: if the fresh scrape returned 0 photos but the
      // existing cache row had some, preserve the cached photos so we
      // don't blank out a good record because of a one-off scrape miss.
      if (
        (!property.photos || property.photos.length === 0) &&
        cachedNormalized &&
        Array.isArray((cachedNormalized as any).photos) &&
        (cachedNormalized as any).photos.length > 0
      ) {
        property.photos = (cachedNormalized as any).photos;
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const status = /No Zillow results/i.test(msg) ? 404
        : /timed out/i.test(msg) ? 504
        : /Missing/i.test(msg) ? 400
        : 502;
      console.error("[zillow-lookup] apify error:", msg);
      // Failures are NOT cached — allow future retries.
      return res.status(status).json({ error: msg });
    }

    // 3. Write-through cache (best-effort; never block the response).
    // Only successful scrapes are cached.
    if (supabaseAdmin) {
      void Promise.resolve(
        supabaseAdmin
          .from("property_cache")
          .upsert(
            {
              cache_key: cacheKey,
              normalized: property,
              raw: property.rawZillowData,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: "cache_key" },
          )
          .then(({ error }) => {
            if (error) console.warn("[zillow-lookup] cache write failed:", error.message);
          })
      )
        // Fire-and-forget: a transport-level rejection here must not become
        // an unhandled rejection (fatal under Node 20's default).
        .catch((e: any) => console.warn("[zillow-lookup] cache write rejected:", e?.message ?? e));
    }

    return res.json({ cached: false, property });
  });

  // POST /api/zillow-property-lookup/policy-type
  // Tiny helper so the frontend can recompute insurancePolicyType after
  // the user changes propertyType or occupancy without re-hitting Apify.
  app.post("/api/zillow-property-lookup/policy-type", (req, res) => {
    const { propertyType = "", occupancyType = "" } = req.body ?? {};
    res.json({ policyType: derivePolicyType(propertyType, occupancyType) });
  });

  // ── POST /api/listing-market-analysis ──────────────────────────────
  // AI-powered weekly market briefing for a For Sale listing. Reads the
  // cached row from Supabase first; only calls Anthropic when stale (Friday
  // rollover) or missing. Anthropic API key is read from env server-side
  // and never sent to the frontend.
  //
  // Auth: the caller MUST send the Supabase access token in the
  // `Authorization: Bearer <token>` header. We verify it with the admin
  // client and derive `userId` from the token — never from the request body.
  // This prevents IDOR since we use the service-role client (RLS bypassed).
  app.post("/api/listing-market-analysis", async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(503).json({ error: "Auth backend not configured" });
      }
      const authHeader = req.headers.authorization || "";
      const match = /^Bearer\s+(.+)$/i.exec(authHeader);
      if (!match) {
        return res.status(401).json({ error: "Missing bearer token" });
      }
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(match[1]);
      if (userErr || !userData?.user?.id) {
        return res.status(401).json({ error: "Invalid or expired session" });
      }
      const verifiedUserId = userData.user.id;

      const body = (req.body ?? {}) as Partial<ListingInput> & { forceRefresh?: boolean };
      if (!body.listingId || !body.address) {
        return res.status(400).json({ error: "listingId and address are required" });
      }

      // Status gate: Market Analysis only runs for scenarios that are
      // actually being marketed. We trust the DB, not the client body,
      // so a spoofed status can't bypass the gate. A Draft row gets a
      // 200 with `skipped: true` so the client renders the clean
      // placeholder instead of an error.
      const { data: statusRow } = await supabaseAdmin
        .from("seller_scenarios")
        .select("status")
        .eq("id", body.listingId)
        .eq("user_id", verifiedUserId)
        .maybeSingle();
      const sellerStatus = (statusRow?.status ?? null) as string | null;
      const allowedStatus = sellerStatus === "ready_to_list" || sellerStatus === "listed";
      if (!allowedStatus) {
        return res.json({ analysis: null, generating: false, skipped: true, reason: "draft_status" });
      }

      // Server-side guardrail: the frontend cannot trigger Anthropic on
      // demand. `forceRefresh` is only honored for admin emails listed in
      // MARKET_ANALYSIS_ADMIN_EMAILS (comma-separated). Everyone else is
      // silently demoted to the normal cached/weekly path.
      const adminEmails = (process.env.MARKET_ANALYSIS_ADMIN_EMAILS || "")
        .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      const callerEmail = (userData.user.email || "").toLowerCase();
      const isAdmin = adminEmails.length > 0 && adminEmails.includes(callerEmail);
      const honorForceRefresh = !!body.forceRefresh && isAdmin;
      if (body.forceRefresh && !isAdmin) {
      }

      // Enrich the listing input with cached Zillow property data when we
      // have it (beds/baths/sqft/yearBuilt/lotSize/last sold/photo count/
      // property type). Same logic as the weekly precompute job uses.
      const enriched = await enrichListingFromPropertyCache({
        ...(body as ListingInput),
        userId: verifiedUserId,
      });

      // Two paths:
      //  - Admin force-refresh: synchronous generate (blocks until done).
      //  - Everyone else: fast read from Supabase. If the current-cycle
      //    saved analysis is missing/stale/insufficient, queue background
      //    generation and return the prior saved row (or a "generating"
      //    stub) immediately — NEVER blocks on Anthropic.
      let record;
      let generating = false;
      if (honorForceRefresh) {
        // Route through the single-flight lock so an admin refresh won't
        // duplicate an in-flight scheduler/display generation for the
        // same listing/week.
        const { ensureMarketAnalysis } = await import("./integrations/market-analysis-scheduler");
        record = await ensureMarketAnalysis(enriched, { forceRefresh: true });
      } else {
        const display = await getMarketAnalysisForDisplay(enriched);
        record = display.analysis;
        generating = display.generating;
      }
      if (!record) {
        return res.status(503).json({ error: "Market analysis unavailable" });
      }
      const { raw_prompt: _rp, raw_anthropic_response: _ra, ...safe } = record as any;
      return res.json({ analysis: safe, generating });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[market-analysis] route error:", message);
      return res.status(500).json({ error: message });
    }
  });

  // ── POST /api/admin/market-analysis-weekly/run ─────────────────────
  // Manual trigger for the weekly precompute job. Gated by
  // MARKET_ANALYSIS_ADMIN_EMAILS. Useful for QA / first-run after deploy
  // before Friday rolls around.
  app.post("/api/admin/market-analysis-weekly/run", async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(503).json({ error: "Auth backend not configured" });
      const authHeader = req.headers.authorization || "";
      const match = /^Bearer\s+(.+)$/i.exec(authHeader);
      if (!match) return res.status(401).json({ error: "Missing bearer token" });
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(match[1]);
      if (userErr || !userData?.user?.id) return res.status(401).json({ error: "Invalid or expired session" });
      const adminEmails = (process.env.MARKET_ANALYSIS_ADMIN_EMAILS || "")
        .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      const callerEmail = (userData.user.email || "").toLowerCase();
      const isAdmin = adminEmails.length > 0 && adminEmails.includes(callerEmail);
      if (!isAdmin) return res.status(403).json({ error: "Admin only" });
      // Run in background; respond immediately so the request doesn't time out.
      void precomputeWeeklyMarketAnalysesForAllSellerScenarios()
        .catch((e) => console.warn("[market-analysis-weekly] manual run failed:", e?.message));
      return res.json({ ok: true, queued: true });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // ── Property alert subscriptions (Phase 1: CRUD + admin manual checks) ─
  // The bell on dashboard saved scenarios writes here. Auth: Bearer token →
  // derive user from server-side verification (never trust body user_id).
  // RLS is also enabled on the table; this server still uses the service-
  // role client and enforces user_id manually.
  async function requireUser(req: any, res: any) {
    if (!supabaseAdmin) {
      res.status(503).json({ error: "Auth backend not configured" });
      return null;
    }
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
    if (!m) {
      res.status(401).json({ error: "Missing bearer token" });
      return null;
    }
    const { data, error } = await supabaseAdmin.auth.getUser(m[1]);
    if (error || !data?.user?.id) {
      res.status(401).json({ error: "Invalid or expired session" });
      return null;
    }
    return data.user;
  }

  // ── Havo Pro subscription (Stripe Managed Payments) ────────────────
  // POST /api/subscription/create-checkout-session — returns a Stripe
  // Checkout URL for the $20/mo Havo Pro plan. The userId comes from the
  // verified session, never the body.
  app.post("/api/subscription/create-checkout-session", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
      const origin = (req.headers.origin as string | undefined)
        || `${req.protocol}://${req.get("host")}`;
      const successUrl = `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/subscribe`;
      const { url } = await createSubscriptionCheckout({
        userId: user.id,
        email: user.email,
        successUrl,
        cancelUrl,
      });
      // Ensure a row exists so status checks have something to read.
      await db
        .insert(userSubscriptions)
        .values({ userId: user.id, email: user.email ?? null, status: "pending" })
        .onConflictDoUpdate({
          target: userSubscriptions.userId,
          set: { email: user.email ?? null, updatedAt: new Date() },
        });
      return res.json({ url });
    } catch (e: any) {
      console.error("[subscription] create-checkout-session error:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  // POST /api/subscription/confirm — called on return from Checkout. We
  // verify the session belongs to this user, then persist the customer /
  // subscription ids and status.
  app.post("/api/subscription/confirm", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const sessionId = String(req.body?.sessionId ?? "").trim();
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    try {
      const session = await retrieveCheckoutSession(sessionId);
      // Strictly require the session to belong to this user and to be the
      // subscription checkout we created — never trust a permissive fallback.
      if (session.client_reference_id !== user.id) {
        return res.status(403).json({ error: "Session does not belong to this user" });
      }
      if (session.mode !== "subscription") {
        return res.status(400).json({ error: "Not a subscription checkout session" });
      }
      const customerId = typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;
      const sub = session.subscription;
      const subscriptionId = typeof sub === "string" ? sub : sub?.id ?? null;
      const status: string = (typeof sub === "object" && sub?.status)
        ? sub.status
        : (session.payment_status === "paid" ? "active" : "incomplete");
      const periodEndSec = (typeof sub === "object" && typeof sub?.current_period_end === "number")
        ? sub.current_period_end
        : null;
      const currentPeriodEnd = periodEndSec ? new Date(periodEndSec * 1000) : null;

      await db
        .insert(userSubscriptions)
        .values({
          userId: user.id,
          email: user.email ?? null,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status,
          currentPeriodEnd,
        })
        .onConflictDoUpdate({
          target: userSubscriptions.userId,
          set: {
            email: user.email ?? null,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status,
            currentPeriodEnd,
            updatedAt: new Date(),
          },
        });
      return res.json({ active: isActiveStatus(status), status });
    } catch (e: any) {
      console.error("[subscription] confirm error:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  // GET /api/subscription/status — live-checks Stripe so cancellations /
  // renewals are reflected without webhooks. Falls back to the stored
  // status if Stripe is unreachable.
  // Emails that get full access with no paywall (comped accounts).
  // admin@tateoco.com is always included; extra addresses can be added
  // via the COMP_ACCESS_EMAILS env var (comma-separated).
  // The app is free with a free account: no Stripe checkout, payment
  // method, or subscription is enforced for any signed-in user. Stripe
  // routes/webhooks/tables are all left intact — only enforcement is
  // bypassed. This is intentionally hard-coded to true so that no
  // environment variable can accidentally re-enable payments. To restore
  // paid mode in the future, change this constant back to an env-driven value.
  const FREE_ACCESS_MODE = true;
  if (FREE_ACCESS_MODE) {
    console.log("[access-mode] free access mode enabled");
    console.log("[stripe] code retained");
  }

  function hasFreeAccess(email: string | null | undefined): boolean {
    const list = [
      "admin@tateoco.com",
      "courtney@tateoco.com",
      "zhornsby22@gmail.com",
      "paul@mymarcoisland.com",
      "coreyfranklin21@yahoo.com",
      "kellypozda22@gmail.com",
      ...(process.env.COMP_ACCESS_EMAILS || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ];
    return list.includes((email || "").toLowerCase());
  }

  app.get("/api/subscription/status", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    // Free access mode: payment enforcement is bypassed for every signed-in
    // user. Stripe is not contacted; the code below is preserved for paid mode.
    if (FREE_ACCESS_MODE) {
      return res.json({ active: true, status: "free_access" });
    }
    // Comped accounts skip Stripe entirely and always read as active.
    if (hasFreeAccess(user.email)) {
      return res.json({ active: true, status: "comped" });
    }
    try {
      const rows = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, user.id));
      const row = rows[0];
      if (!row || !row.stripeSubscriptionId) {
        return res.json({ active: false, status: row?.status ?? "inactive" });
      }
      try {
        const snap = await getSubscriptionStatus(row.stripeSubscriptionId);
        const currentPeriodEnd = snap.currentPeriodEnd
          ? new Date(snap.currentPeriodEnd * 1000)
          : null;
        await db
          .update(userSubscriptions)
          .set({ status: snap.status, currentPeriodEnd, updatedAt: new Date() })
          .where(eq(userSubscriptions.userId, user.id));
        return res.json({
          active: isActiveStatus(snap.status),
          status: snap.status,
          currentPeriodEnd: snap.currentPeriodEnd,
        });
      } catch (stripeErr: any) {
        console.warn("[subscription] status live-check failed, using stored:", stripeErr?.message);
        return res.json({ active: isActiveStatus(row.status), status: row.status });
      }
    } catch (e: any) {
      console.error("[subscription] status error:", e?.message);
      return res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  function isAdminEmail(email: string | null | undefined): boolean {
    const adminEmails = (process.env.MARKET_ANALYSIS_ADMIN_EMAILS || "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return adminEmails.length > 0 && adminEmails.includes((email || "").toLowerCase());
  }

  const VALID_SCENARIO_TYPES = ["purchase", "refinance", "cash_buy", "seller"] as const;
  const VALID_ALERT_TYPES = ["rate_drop", "price_drop"] as const;

  // GET /api/property-alerts?scenarioId=&scenarioType= — list this user's
  // subscriptions (optionally scoped to one scenario, used by the bell to
  // hydrate active state).
  app.get("/api/property-alerts", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const scenarioId = (req.query.scenarioId as string | undefined)?.trim();
    const scenarioType = (req.query.scenarioType as string | undefined)?.trim();
    let q = supabaseAdmin!
      .from("property_alert_subscriptions")
      .select("*")
      .eq("user_id", user.id);
    if (scenarioId) q = q.eq("scenario_id", scenarioId);
    if (scenarioType) q = q.eq("scenario_type", scenarioType);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ subscriptions: data ?? [] });
  });

  // POST /api/property-alerts — upsert one subscription (insert or update).
  // Body shape (server enforces user_id from the verified session):
  //   scenarioId, scenarioType, alertType, isActive (default true),
  //   targetRate, loanType, loanTermYears, occupancyType, creditScore, ltv,
  //   initialWatchedPrice, propertyAddress, normalizedPropertyKey,
  //   zpid, zillowUrl
  app.post("/api/property-alerts", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const b = (req.body ?? {}) as any;
    const scenarioId = String(b.scenarioId ?? "").trim();
    const scenarioType = String(b.scenarioType ?? "").trim();
    const alertType = String(b.alertType ?? "").trim();
    if (!scenarioId || !VALID_SCENARIO_TYPES.includes(scenarioType as any)) {
      return res.status(400).json({ error: "Invalid scenarioId/scenarioType" });
    }
    if (!VALID_ALERT_TYPES.includes(alertType as any)) {
      return res.status(400).json({ error: "Invalid alertType" });
    }
    if (alertType === "rate_drop") {
      const tr = Number(b.targetRate);
      if (!Number.isFinite(tr) || tr <= 0 || tr > 25) {
        return res.status(400).json({ error: "targetRate must be a positive number <= 25" });
      }
    }

    // Look up existing subscription so we can preserve immutable fields
    // (initial_watched_price, last_alerted_*).
    const { data: existing } = await supabaseAdmin!
      .from("property_alert_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("scenario_id", scenarioId)
      .eq("scenario_type", scenarioType)
      .eq("alert_type", alertType)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const isActive = b.isActive !== false; // default true

    const initialPrice = typeof b.initialWatchedPrice === "number" && b.initialWatchedPrice > 0
      ? b.initialWatchedPrice : null;

    const row: any = {
      user_id: user.id,
      scenario_id: scenarioId,
      scenario_type: scenarioType,
      alert_type: alertType,
      is_active: isActive,
      normalized_property_key: b.normalizedPropertyKey ?? existing?.normalized_property_key ?? null,
      property_address: b.propertyAddress ?? existing?.property_address ?? null,
      zpid: b.zpid ?? existing?.zpid ?? null,
      zillow_url: b.zillowUrl ?? existing?.zillow_url ?? null,
      target_rate: alertType === "rate_drop" ? Number(b.targetRate) : existing?.target_rate ?? null,
      loan_type: b.loanType ?? existing?.loan_type ?? null,
      loan_term_years: b.loanTermYears ?? existing?.loan_term_years ?? null,
      occupancy_type: b.occupancyType ?? existing?.occupancy_type ?? null,
      credit_score: b.creditScore ?? existing?.credit_score ?? null,
      ltv: b.ltv ?? existing?.ltv ?? null,
      // Preserve dedupe state across reactivation; only reset
      // last_alerted_rate when target rate is raised above prior threshold.
      last_alerted_rate: existing?.last_alerted_rate ?? null,
      initial_watched_price: existing?.initial_watched_price ?? initialPrice,
      last_seen_price: existing?.last_seen_price ?? initialPrice,
      last_alerted_price: existing?.last_alerted_price ?? null,
      notification_channel: existing?.notification_channel ?? "email",
      updated_at: nowIso,
    };

    // If the user raised their target above last_alerted_rate, clear the
    // dedupe marker so a fresh notification can fire on the next check.
    if (
      alertType === "rate_drop" &&
      existing?.last_alerted_rate != null &&
      row.target_rate != null &&
      row.target_rate > existing.last_alerted_rate
    ) {
      row.last_alerted_rate = null;
    }

    // Atomic upsert keyed by the unique index
    // (user_id, scenario_id, scenario_type, alert_type). Avoids a race
    // between SELECT and INSERT when the user double-clicks Save.
    const upsertRow = existing ? row : { ...row, created_at: nowIso };
    const { data, error } = await supabaseAdmin!
      .from("property_alert_subscriptions")
      .upsert(upsertRow, {
        onConflict: "user_id,scenario_id,scenario_type,alert_type",
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ subscription: data });
  });

  // DELETE /api/property-alerts/:id — soft delete (is_active=false). Hard
  // delete would lose dedupe history if the user re-subscribes immediately.
  app.delete("/api/property-alerts/:id", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const id = req.params.id;
    const { error } = await supabaseAdmin!
      .from("property_alert_subscriptions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  });

  // POST /api/admin/property-alerts/check-rates — admin manual trigger.
  app.post("/api/admin/property-alerts/check-rates", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    if (!isAdminEmail(user.email)) return res.status(403).json({ error: "Admin only" });
    try {
      const { runRateDropChecks } = await import("./integrations/property-alerts");
      const result = await runRateDropChecks();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  // POST /api/admin/property-alerts/check-prices — admin manual trigger.
  // May call Apify when watched-property caches are stale; rate-limited
  // implicitly by the small number of active subscriptions.
  app.post("/api/admin/property-alerts/check-prices", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    if (!isAdminEmail(user.email)) return res.status(403).json({ error: "Admin only" });
    try {
      const { runPriceDropChecks } = await import("./integrations/property-alerts");
      const result = await runPriceDropChecks();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

