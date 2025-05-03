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
