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
export async function getGoogleMapsApiKey() {
  return apiRequest("GET", "/api/config/google-maps-api-key");
}

// Get insurance quote
export async function getInsuranceQuote(data: {
  address: string;
  placeId?: string;
  type?: "auto" | "property" | "other";
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
