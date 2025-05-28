import { pgTable, text, serial, integer, boolean, json, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Main user table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  contactPreference: text("contact_preference").default("email"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  options: json("options").$type<string[]>().notNull(),
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  selectedServices: json("selected_services").$type<string[]>().notNull(),
  formData: json("form_data").notNull(),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Integration data
export const integrationRequests = pgTable("integration_requests", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  provider: text("provider").notNull(), // "netcalcsheet", "arive", "canopy"
  requestData: json("request_data").notNull(),
  responseData: json("response_data"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema for user input validation
export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    createdAt: true,
  });

export const insertSubmissionSchema = createInsertSchema(submissions)
  .omit({
    id: true,
    createdAt: true,
  });

export const insertIntegrationRequestSchema = createInsertSchema(integrationRequests)
  .omit({
    id: true,
    createdAt: true,
  });

// Define form validation schemas
export const realEstateFormSchema = z.object({
  // Common fields
  intent: z.enum(["buy", "sell", "both"]),
  propertyType: z.enum(["residential", "commercial", "industrial", "land"]).optional(),
  
  // For Buy intent
  purchaseMethod: z.enum(["cash", "mortgage"]).optional(),
  purchasePrice: z.string().optional(),
  propertyAddress: z.string().optional(),
  
  // For Sell intent
  sellingPrice: z.string().optional(),
  sellingAddress: z.string().optional(),
  
  // For Both intent (Buy & Sell)
  sellType: z.enum(["primary", "1031exchange"]).optional(),
  buyType: z.enum(["primary", "other"]).optional(),
  
  // Legacy fields
  location: z.string().optional(),
  priceRangeMin: z.string().optional(),
  priceRangeMax: z.string().optional(),
});

export const mortgageFormSchema = z.object({
  // Address or ZIP
  locationType: z.enum(["address", "zipcode"]),
  propertyAddress: z.string().optional(),
  zipCode: z.string().optional(),
  
  // Property value
  estimatedValue: z.string().optional(),
  purchasePrice: z.string().optional(),
  
  // Mortgage details
  type: z.enum(["purchase", "refinance"]),
  ownershipType: z.enum(["primary", "secondary", "investment"]).optional(),
  
  // Original fields (for backward compatibility)
  propertyValue: z.string().optional(),
  mortgageBalance: z.string().optional(),
  creditScore: z.string().optional(),
});

export const mortgagePropertyTypeSchema = z.object({
  // Basic info from previous form
  type: z.enum(["purchase", "refinance"]),
  ownershipType: z.enum(["primary", "secondary", "investment"]),
  
  // Property type - different options based on ownership type
  propertyType: z.string(),
});

export const mortgageFinancingSchema = z.object({
  // Credit score range
  creditScore: z.enum([
    "780+",
    "760-779",
    "740-759",
    "720-739",
    "700-719",
    "680-699",
    "660-679",
    "640-659",
    "620-639",
    "600-619",
    "580-599",
    "580 and below"
  ]),
  
  // Loan type - changes based on ownership type
  loanType: z.string(),
  
  // Optional Non-QM specific fields
  nonQMType: z.string().optional(),
});

export const mortgageIncomeSchema = z.object({
  // Main income type
  incomeType: z.enum(["salary-w2", "hourly", "self-employed", "retired"]),
  
  // Salary/W2 specific fields
  salaryType: z.enum(["salary-only", "salary-commission", "salary-bonus", "salary-rsu"]).optional(),
  baseSalary: z.string().optional(),
  commissionAverage: z.string().optional(),
  bonusAverage: z.string().optional(),
  vestedRsuBalance: z.string().optional(),
  
  // Hourly specific fields
  hourlyRate: z.string().optional(),
  hoursPerWeek: z.string().optional(),
  
  // Self-employed specific fields
  businessType: z.enum(["1099-personal", "1099-business", "s-corp", "c-corp"]).optional(),
  grossAverage: z.string().optional(),
  netIncome: z.string().optional(),
  w2Income: z.string().optional(),
  k1Amount: z.string().optional(),
  cCorpNetProfit: z.string().optional(),
  
  // Retired specific fields (can select multiple)
  socialSecurityIncome: z.string().optional(),
  disabilityIncome: z.string().optional(),
  disabilityType: z.enum(["social-security", "va", "other"]).optional(),
  pensionIncome: z.string().optional(),
  rmdIncome: z.string().optional(),
});

export const insuranceFormSchema = z.object({
  type: z.enum(["auto", "property", "other"]),
  currentProvider: z.string().optional(),
  coverageAmount: z.string().optional(),
  additionalInfo: z.string().optional(),
  address: z.string().optional(),
  placeId: z.string().optional(),
  propertyType: z.string().optional(),
  notes: z.string().optional(),
});

export const constructionFormSchema = z.object({
  type: z.enum(["build", "rehab"]),
  projectType: z.string().min(1, "Project type is required"),
  budget: z.string().min(1, "Budget is required"),
  timeline: z.string().optional(),
});

export const propertyManagementFormSchema = z.object({
  type: z.enum(["manage", "rentals"]),
  propertyCount: z.string().min(1, "Property count is required"),
  propertyType: z.enum(["residential", "commercial", "mixed"]),
  location: z.string().optional(),
});

export const homeServicesFormSchema = z.object({
  serviceType: z.string().min(1, "Service type is required"),
  urgency: z.enum(["emergency", "soon", "planning"]),
  description: z.string().optional(),
});

export const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  contactPreference: z.enum(["email", "phone", "text"]),
  termsAgreed: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions",
  }),
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissions.$inferSelect;

export type InsertIntegrationRequest = z.infer<typeof insertIntegrationRequestSchema>;
export type IntegrationRequest = typeof integrationRequests.$inferSelect;

export type RealEstateFormData = z.infer<typeof realEstateFormSchema>;
export type MortgageFormData = z.infer<typeof mortgageFormSchema>;
export type MortgagePropertyTypeData = z.infer<typeof mortgagePropertyTypeSchema>;
export type MortgageFinancingData = z.infer<typeof mortgageFinancingSchema>;
export type MortgageIncomeData = z.infer<typeof mortgageIncomeSchema>;
export type InsuranceFormData = z.infer<typeof insuranceFormSchema>;
export type ConstructionFormData = z.infer<typeof constructionFormSchema>;
export type PropertyManagementFormData = z.infer<typeof propertyManagementFormSchema>;
export type HomeServicesFormData = z.infer<typeof homeServicesFormSchema>;
export type ContactFormData = z.infer<typeof contactFormSchema>;

// Service type definitions
export const serviceCategories = [
  {
    id: "real-estate",
    displayName: "Real Estate",
    description: "Buy or sell residential and commercial properties with our expert agents.",
    options: ["Buy", "Sell"],
    imageUrl: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80"
  },
  {
    id: "mortgage",
    displayName: "Mortgage",
    description: "Get the best rates for new mortgages, refinancing, or cash-out options.",
    options: ["Purchase", "Refinance"],
    imageUrl: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80"
  },
  {
    id: "insurance",
    displayName: "Insurance",
    description: "Protect your investments with comprehensive insurance coverage.",
    options: ["Auto", "Property", "Other"],
    imageUrl: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80"
  },
  {
    id: "construction",
    displayName: "Construction",
    description: "Build your dream home or renovate your existing property with our construction services.",
    options: ["Build", "Rehab"],
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80"
  },
  {
    id: "property-management",
    displayName: "Property Management",
    description: "Let us handle the day-to-day management of your properties or find the perfect rental.",
    options: ["Manage", "Rentals"],
    imageUrl: "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80"
  },
  {
    id: "home-services",
    displayName: "Home Services",
    description: "Access a wide range of home services from repairs to maintenance and more.",
    options: ["Maintenance", "Other"],
    imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80"
  }
];

export type ServiceCategory = typeof serviceCategories[0];
