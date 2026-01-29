import { SignJWT } from 'jose';

// Agent Service configuration
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';
const JWT_SECRET = process.env.AGENT_SERVICE_JWT_SECRET || 'northstar-agent-service-secret-key-2026';
const JWT_ISSUER = process.env.AGENT_SERVICE_JWT_ISSUER || 'north-star';
const JWT_AUDIENCE = process.env.AGENT_SERVICE_JWT_AUDIENCE || 'agent-service';

export interface ChatRequest {
  prompt: string;
  userId: string;
  conversationId?: string;
}

export interface ChatResponse {
  success: boolean;
  conversationId: string;
  message: string;
  sseEndpoint: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolResult?: string;
  createdAt: string;
}

export interface AgentExecution {
  id: string;
  conversationId: string;
  prompt: string;
  status: string;
  result?: string;
  error?: string;
  toolCalls?: unknown[];
  startedAt: string;
  completedAt?: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface ModelStats {
  modelName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  totalTokens: number;
  lastUsed: string | null;
}

/**
 * Generate JWT token for Agent Service authentication
 */
async function generateToken(userId: string, email?: string, name?: string, aiInstructions?: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  
  const token = await new SignJWT({
    sub: userId,
    email: email || `user-${userId}@northstar.local`,
    name: name || 'North Star User',
    aiInstructions: aiInstructions || undefined,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .sign(secret);

  return token;
}

/**
 * Agent Service client for making authenticated requests
 */
export class AgentServiceClient {
  private userId: string;
  private userEmail?: string;
  private userName?: string;
  private aiInstructions?: string;

  constructor(userId: string, userEmail?: string, userName?: string, aiInstructions?: string) {
    this.userId = userId;
    this.userEmail = userEmail;
    this.userName = userName;
    this.aiInstructions = aiInstructions;
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await generateToken(this.userId, this.userEmail, this.userName, this.aiInstructions);
    
    const response = await fetch(`${AGENT_SERVICE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Agent Service error: ${response.status} - ${errorText}`);
    }

    const json = await response.json();
    
    // Agent Service wraps responses in { success, data } format
    // Unwrap if present, otherwise return as-is
    if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
      return json.data as T;
    }
    
    return json as T;
  }

  /**
   * Start a chat with the AI agent
   */
  async chat(prompt: string, conversationId?: string): Promise<ChatResponse> {
    return this.fetch<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        userId: this.userId,
        conversationId,
      }),
    });
  }

  /**
   * Get SSE stream URL for a conversation
   */
  async getStreamUrl(conversationId: string): Promise<string> {
    const token = await generateToken(this.userId, this.userEmail, this.userName);
    return `${AGENT_SERVICE_URL}/chat/${conversationId}/stream?token=${encodeURIComponent(token)}`;
  }

  /**
   * Get all conversations for the user
   */
  async getConversations(): Promise<Conversation[]> {
    return this.fetch<Conversation[]>(`/conversations?userId=${encodeURIComponent(this.userId)}`);
  }

  /**
   * Get a specific conversation
   */
  async getConversation(conversationId: string): Promise<Conversation> {
    return this.fetch<Conversation>(`/conversations/${conversationId}`);
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const result = await this.fetch<{ conversation: Conversation; messages: ConversationMessage[] }>(`/conversations/${conversationId}/messages`);
    return result.messages || [];
  }

  /**
   * Get agent executions for a conversation
   */
  async getExecutions(conversationId: string): Promise<AgentExecution[]> {
    const result = await this.fetch<{ conversation: Conversation; executions: AgentExecution[] }>(`/conversations/${conversationId}/executions`);
    return result.executions || [];
  }

  /**
   * Get conversation summary
   */
  async getSummary(conversationId: string): Promise<{ summary: string }> {
    const result = await this.fetch<{ summary: string }>(`/conversations/${conversationId}/summary`);
    return result;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.fetch(`/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string): Promise<void> {
    await this.fetch(`/conversations/${conversationId}/archive`, {
      method: 'POST',
    });
  }

  /**
   * Sync user to Agent Service
   */
  async syncUser(): Promise<void> {
    await this.fetch('/users/sync', {
      method: 'POST',
      body: JSON.stringify({
        externalId: this.userId,
        email: this.userEmail,
        name: this.userName,
      }),
    });
  }

  /**
   * Get available Ollama models
   */
  async getModels(): Promise<OllamaModel[]> {
    return this.fetch<OllamaModel[]>('/settings/ollama/models');
  }

  /**
   * Get the default model
   */
  async getDefaultModel(): Promise<string> {
    const result = await this.fetch<{ model: string }>('/settings/ollama/default-model');
    return result.model;
  }

  /**
   * Set the default model
   */
  async setDefaultModel(model: string): Promise<void> {
    await this.fetch('/settings/ollama/default-model', {
      method: 'PUT',
      body: JSON.stringify({ model }),
    });
  }

  /**
   * Get analytics for all models
   */
  async getAllModelStats(): Promise<ModelStats[]> {
    return this.fetch<ModelStats[]>('/settings/analytics/models');
  }

  /**
   * Get analytics for a specific model
   */
  async getModelStats(modelName: string): Promise<ModelStats | null> {
    return this.fetch<ModelStats | null>(`/settings/analytics/models/${encodeURIComponent(modelName)}`);
  }

  /**
   * Pull a new model from Ollama registry (sync - waits for completion)
   * Warning: Can timeout for large models
   */
  async pullModel(modelName: string): Promise<{ success: boolean; message: string }> {
    return this.fetch<{ success: boolean; message: string }>('/settings/ollama/pull', {
      method: 'POST',
      body: JSON.stringify({ model: modelName }),
    });
  }

  /**
   * Pull a new model asynchronously (returns immediately with jobId)
   */
  async pullModelAsync(modelName: string): Promise<{ success: boolean; jobId: string; message: string }> {
    return this.fetch<{ success: boolean; jobId: string; message: string }>('/settings/ollama/pull-async', {
      method: 'POST',
      body: JSON.stringify({ model: modelName }),
    });
  }

  /**
   * Get status of an async pull job
   */
  async getPullJobStatus(jobId: string): Promise<{ 
    success: boolean;
    status: 'pulling' | 'success' | 'error' | 'not_found';
    progress?: number;
    message?: string;
  }> {
    return this.fetch(`/settings/ollama/pull-status/${encodeURIComponent(jobId)}`);
  }

  /**
   * Get all active pull jobs
   */
  async getActivePullJobs(): Promise<Array<{ 
    jobId: string;
    status: string;
    progress?: number;
    message?: string;
  }>> {
    const result = await this.fetch<{ data: Array<{ jobId: string; status: string; progress?: number; message?: string }> }>('/settings/ollama/pull-jobs');
    return result.data || result;
  }

  /**
   * Debug health check
   */
  async debugHealth(): Promise<{ success: boolean; ollamaConnection: string; modelCount?: number; error?: string }> {
    return this.fetch('/settings/debug/health');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; service: string; timestamp: string }> {
    return this.fetch('/health');
  }
}

/**
 * Create an Agent Service client for a user
 */
export function createAgentClient(userId: string, email?: string, name?: string, aiInstructions?: string): AgentServiceClient {
  return new AgentServiceClient(userId, email, name, aiInstructions);
}

/**
 * Get the base URL for the Agent Service
 */
export function getAgentServiceUrl(): string {
  return AGENT_SERVICE_URL;
}

/**
 * Generate a token for client-side SSE connections
 */
export async function generateClientToken(userId: string, email?: string, name?: string, aiInstructions?: string): Promise<string> {
  return generateToken(userId, email, name, aiInstructions);
}
