import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

// Generate a unique session ID for tracking user responses
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get or create session ID from localStorage
function getSessionId(): string {
  const stored = localStorage.getItem('questionnaire-session-id');
  if (stored) {
    return stored;
  }
  
  const newSessionId = generateSessionId();
  localStorage.setItem('questionnaire-session-id', newSessionId);
  return newSessionId;
}

export interface QuestionnaireResponse {
  id: number;
  sessionId: string;
  serviceType: string;
  stepName: string;
  responseData: any;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useQuestionnaireStorage() {
  const [sessionId] = useState(() => getSessionId());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save a questionnaire step response
  const saveStep = useCallback(async (
    serviceType: string,
    stepName: string,
    responseData: any,
    isCompleted: boolean = false
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/questionnaire/save-step', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          serviceType,
          stepName,
          responseData,
          isCompleted,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      console.log(`Saved ${serviceType} - ${stepName}:`, responseData);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save step';
      setError(errorMessage);
      console.error('Error saving questionnaire step:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Get all responses for current session
  const getSessionResponses = useCallback(async (): Promise<QuestionnaireResponse[]> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/questionnaire/session/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.responses || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get responses';
      setError(errorMessage);
      console.error('Error getting questionnaire responses:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Get saved data for a specific service and step
  const getSavedStep = useCallback(async (
    serviceType: string,
    stepName: string
  ): Promise<any | null> => {
    try {
      const responses = await getSessionResponses();
      const stepResponse = responses.find(
        r => r.serviceType === serviceType && r.stepName === stepName
      );
      return stepResponse?.responseData || null;
    } catch (err) {
      console.error('Error getting saved step:', err);
      return null;
    }
  }, [getSessionResponses]);

  // Clear session data (for starting fresh)
  const clearSession = useCallback(() => {
    localStorage.removeItem('questionnaire-session-id');
    window.location.reload(); // Refresh to generate new session
  }, []);

  return {
    sessionId,
    saveStep,
    getSessionResponses,
    getSavedStep,
    clearSession,
    isLoading,
    error,
  };
}