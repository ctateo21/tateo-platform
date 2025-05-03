import { users, submissions, integrationRequests, type User, type InsertUser, type Submission, type InsertSubmission, type IntegrationRequest, type InsertIntegrationRequest } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private submissions: Map<number, Submission>;
  private integrationRequests: Map<number, IntegrationRequest>;
  private userIdCounter: number;
  private submissionIdCounter: number;
  private integrationRequestIdCounter: number;

  constructor() {
    this.users = new Map();
    this.submissions = new Map();
    this.integrationRequests = new Map();
    this.userIdCounter = 1;
    this.submissionIdCounter = 1;
    this.integrationRequestIdCounter = 1;
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
}

export const storage = new MemStorage();
