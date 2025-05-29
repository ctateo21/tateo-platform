import { users, submissions, integrationRequests, questionnaireResponses, type User, type InsertUser, type Submission, type InsertSubmission, type IntegrationRequest, type InsertIntegrationRequest, type QuestionnaireResponse, type InsertQuestionnaireResponse } from "@shared/schema";

// Storage interface for the real estate services platform
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Submission operations
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  getSubmission(id: number): Promise<Submission | undefined>;
  updateSubmissionStatus(id: number, status: string): Promise<Submission | undefined>;
  getSubmissionsByUserId(userId: number): Promise<Submission[]>;
  
  // Integration request operations
  createIntegrationRequest(request: InsertIntegrationRequest): Promise<IntegrationRequest>;
  getIntegrationRequest(id: number): Promise<IntegrationRequest | undefined>;
  updateIntegrationRequest(id: number, status: string, responseData: any): Promise<IntegrationRequest | undefined>;
  getIntegrationRequestsBySubmissionId(submissionId: number): Promise<IntegrationRequest[]>;
  
  // Questionnaire response operations
  saveQuestionnaireResponse(response: InsertQuestionnaireResponse): Promise<QuestionnaireResponse>;
  getQuestionnaireResponse(sessionId: string, serviceType: string, stepName: string): Promise<QuestionnaireResponse | undefined>;
  getQuestionnaireResponsesBySession(sessionId: string): Promise<QuestionnaireResponse[]>;
  updateQuestionnaireResponse(sessionId: string, serviceType: string, stepName: string, responseData: any, isCompleted?: boolean): Promise<QuestionnaireResponse | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private submissions: Map<number, Submission>;
  private integrationRequests: Map<number, IntegrationRequest>;
  private questionnaireResponses: Map<string, QuestionnaireResponse>;
  private userIdCounter: number;
  private submissionIdCounter: number;
  private integrationRequestIdCounter: number;
  private questionnaireResponseIdCounter: number;

  constructor() {
    this.users = new Map();
    this.submissions = new Map();
    this.integrationRequests = new Map();
    this.questionnaireResponses = new Map();
    this.userIdCounter = 1;
    this.submissionIdCounter = 1;
    this.integrationRequestIdCounter = 1;
    this.questionnaireResponseIdCounter = 1;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const createdAt = new Date();
    const user: User = { ...insertUser, id, createdAt };
    this.users.set(id, user);
    return user;
  }

  // Submission operations
  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const id = this.submissionIdCounter++;
    const createdAt = new Date();
    const submission: Submission = { ...insertSubmission, id, createdAt };
    this.submissions.set(id, submission);
    return submission;
  }

  async getSubmission(id: number): Promise<Submission | undefined> {
    return this.submissions.get(id);
  }

  async updateSubmissionStatus(id: number, status: string): Promise<Submission | undefined> {
    const submission = this.submissions.get(id);
    if (!submission) return undefined;
    
    const updatedSubmission = { ...submission, status };
    this.submissions.set(id, updatedSubmission);
    return updatedSubmission;
  }

  async getSubmissionsByUserId(userId: number): Promise<Submission[]> {
    return Array.from(this.submissions.values()).filter(
      (submission) => submission.userId === userId,
    );
  }

  // Integration request operations
  async createIntegrationRequest(insertRequest: InsertIntegrationRequest): Promise<IntegrationRequest> {
    const id = this.integrationRequestIdCounter++;
    const createdAt = new Date();
    const request: IntegrationRequest = { ...insertRequest, id, createdAt };
    this.integrationRequests.set(id, request);
    return request;
  }

  async getIntegrationRequest(id: number): Promise<IntegrationRequest | undefined> {
    return this.integrationRequests.get(id);
  }

  async updateIntegrationRequest(
    id: number, 
    status: string, 
    responseData: any
  ): Promise<IntegrationRequest | undefined> {
    const request = this.integrationRequests.get(id);
    if (!request) return undefined;
    
    const updatedRequest = { ...request, status, responseData };
    this.integrationRequests.set(id, updatedRequest);
    return updatedRequest;
  }

  async getIntegrationRequestsBySubmissionId(submissionId: number): Promise<IntegrationRequest[]> {
    return Array.from(this.integrationRequests.values()).filter(
      (request) => request.submissionId === submissionId,
    );
  }

  // Questionnaire response operations
  async saveQuestionnaireResponse(response: InsertQuestionnaireResponse): Promise<QuestionnaireResponse> {
    const id = this.questionnaireResponseIdCounter++;
    const createdAt = new Date();
    const questionnaireResponse: QuestionnaireResponse = { 
      ...response, 
      id, 
      createdAt,
      updatedAt: createdAt
    };
    
    const key = `${response.sessionId}-${response.serviceType}-${response.stepName}`;
    this.questionnaireResponses.set(key, questionnaireResponse);
    return questionnaireResponse;
  }

  async getQuestionnaireResponse(sessionId: string, serviceType: string, stepName: string): Promise<QuestionnaireResponse | undefined> {
    const key = `${sessionId}-${serviceType}-${stepName}`;
    return this.questionnaireResponses.get(key);
  }

  async getQuestionnaireResponsesBySession(sessionId: string): Promise<QuestionnaireResponse[]> {
    return Array.from(this.questionnaireResponses.values()).filter(
      (response) => response.sessionId === sessionId,
    );
  }

  async updateQuestionnaireResponse(
    sessionId: string, 
    serviceType: string, 
    stepName: string, 
    responseData: any, 
    isCompleted?: boolean
  ): Promise<QuestionnaireResponse | undefined> {
    const key = `${sessionId}-${serviceType}-${stepName}`;
    const existing = this.questionnaireResponses.get(key);
    if (!existing) return undefined;
    
    const updated = { 
      ...existing, 
      responseData, 
      isCompleted: isCompleted ?? existing.isCompleted,
      updatedAt: new Date()
    };
    this.questionnaireResponses.set(key, updated);
    return updated;
  }
}

// Use DatabaseStorage for persistent storage with PostgreSQL
import { eq, and } from "drizzle-orm";
import { db } from "./db";

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const [submission] = await db
      .insert(submissions)
      .values(insertSubmission)
      .returning();
    return submission;
  }

  async getSubmission(id: number): Promise<Submission | undefined> {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    return submission || undefined;
  }

  async updateSubmissionStatus(id: number, status: string): Promise<Submission | undefined> {
    const [submission] = await db
      .update(submissions)
      .set({ status })
      .where(eq(submissions.id, id))
      .returning();
    return submission || undefined;
  }

  async getSubmissionsByUserId(userId: number): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.userId, userId));
  }

  async createIntegrationRequest(request: InsertIntegrationRequest): Promise<IntegrationRequest> {
    const [integrationRequest] = await db
      .insert(integrationRequests)
      .values(request)
      .returning();
    return integrationRequest;
  }

  async getIntegrationRequest(id: number): Promise<IntegrationRequest | undefined> {
    const [request] = await db
      .select()
      .from(integrationRequests)
      .where(eq(integrationRequests.id, id));
    return request || undefined;
  }

  async updateIntegrationRequest(
    id: number, 
    status: string, 
    responseData: any
  ): Promise<IntegrationRequest | undefined> {
    const [request] = await db
      .update(integrationRequests)
      .set({ status, responseData })
      .where(eq(integrationRequests.id, id))
      .returning();
    return request || undefined;
  }

  async getIntegrationRequestsBySubmissionId(submissionId: number): Promise<IntegrationRequest[]> {
    return await db
      .select()
      .from(integrationRequests)
      .where(eq(integrationRequests.submissionId, submissionId));
  }

  // Questionnaire response operations
  async saveQuestionnaireResponse(response: InsertQuestionnaireResponse): Promise<QuestionnaireResponse> {
    const [saved] = await db
      .insert(questionnaireResponses)
      .values(response)
      .onConflictDoUpdate({
        target: [questionnaireResponses.sessionId, questionnaireResponses.serviceType, questionnaireResponses.stepName],
        set: {
          responseData: response.responseData,
          isCompleted: response.isCompleted,
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved;
  }

  async getQuestionnaireResponse(sessionId: string, serviceType: string, stepName: string): Promise<QuestionnaireResponse | undefined> {
    const [result] = await db
      .select()
      .from(questionnaireResponses)
      .where(
        and(
          eq(questionnaireResponses.sessionId, sessionId),
          eq(questionnaireResponses.serviceType, serviceType),
          eq(questionnaireResponses.stepName, stepName)
        )
      );
    return result;
  }

  async getQuestionnaireResponsesBySession(sessionId: string): Promise<QuestionnaireResponse[]> {
    const results = await db
      .select()
      .from(questionnaireResponses)
      .where(eq(questionnaireResponses.sessionId, sessionId))
      .orderBy(questionnaireResponses.createdAt);
    return results;
  }

  async updateQuestionnaireResponse(sessionId: string, serviceType: string, stepName: string, responseData: any, isCompleted?: boolean): Promise<QuestionnaireResponse | undefined> {
    const [updated] = await db
      .update(questionnaireResponses)
      .set({
        responseData,
        isCompleted: isCompleted ?? false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(questionnaireResponses.sessionId, sessionId),
          eq(questionnaireResponses.serviceType, serviceType),
          eq(questionnaireResponses.stepName, stepName)
        )
      )
      .returning();
    return updated;
  }
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
