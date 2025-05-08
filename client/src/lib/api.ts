import { apiRequest } from "./queryClient";

// Submit all questionnaire data
export async function submitQuestionnaire(data: {
  selectedServices: string[];
  realEstate?: any;
  mortgage?: any;
  insurance?: any;
  construction?: any;
  propertyManagement?: any;
  homeServices?: any;
  contact: any;
}) {
  return apiRequest("POST", "/api/submit", data);
}

// Get submission by ID
export async function getSubmission(id: number) {
  return apiRequest("GET", `/api/submission/${id}`);
}

// Get Google Maps API key
export async function getGoogleMapsApiKey(): Promise<string> {
  const response = await apiRequest("GET", "/api/config/google-maps-api-key");
  const data = await response.json();
  // Return the API key from the response or environment
  return data.apiKey || process.env.GOOGLE_MAPS_API_KEY || "";
}

// Get insurance quote
export async function getInsuranceQuote(data: {
  address: string;
  placeId?: string;
  propertyType?: string;
  insuranceTypes?: string[];
  otherOptions?: string[];
  type?: string;
}) {
  return apiRequest("POST", "/api/insurance/quote", data);
}

const apiClient = {
  submitQuestionnaire,
  getSubmission,
  getGoogleMapsApiKey,
  getInsuranceQuote
};

export default apiClient;
