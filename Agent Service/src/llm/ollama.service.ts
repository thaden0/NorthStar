import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOllama } from 'ollama-ai-provider';
import { generateText, streamText, CoreMessage, CoreTool } from 'ai';

export interface OllamaModel {
  name: string;
  modifiedAt: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameterSize?: string;
    quantizationLevel?: string;
  };
}

export interface GenerateOptions {
  model?: string;
  messages: CoreMessage[];
  tools?: Record<string, CoreTool>;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamOptions extends GenerateOptions {
  onText?: (text: string) => void;
  onToolCall?: (toolCall: { name: string; args: Record<string, unknown> }) => void;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private ollama: ReturnType<typeof createOllama>;

  constructor(private configService: ConfigService) {
    this.baseUrl = configService.get('OLLAMA_BASE_URL', 'http://localhost:11434');
    this.defaultModel = configService.get('OLLAMA_DEFAULT_MODEL', 'qwen3');
    // ollama-ai-provider expects /chat, but Ollama serves at /api/chat
    // So we pass /api as the baseURL for the provider
    this.ollama = createOllama({ baseURL: `${this.baseUrl}/api` });
    this.logger.log(`Ollama service initialized with base URL: ${this.baseUrl}`);
  }

  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }
      const data = (await response.json()) as { models: OllamaModel[] };
      return data.models || [];
    } catch (error) {
      this.logger.error(`Error listing Ollama models: ${error}`);
      throw error;
    }
  }

  async checkModelExists(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some((m) => m.name === modelName || m.name.startsWith(modelName + ':'));
    } catch {
      return false;
    }
  }

  // Track ongoing pull operations
  private pullJobs = new Map<string, { 
    status: 'pulling' | 'success' | 'error';
    progress?: number;
    message?: string;
    startedAt: Date;
    completedAt?: Date;
  }>();

  /**
   * Pull a model synchronously (waits for completion)
   * Warning: This can take several minutes for large models
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      this.logger.log(`Pulling model: ${modelName}`);
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      // Stream the response to completion, tracking progress
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Parse progress from Ollama's NDJSON response
          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n').filter(line => line.trim());
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.status) {
                this.logger.debug(`Pull progress for ${modelName}: ${data.status}`);
              }
            } catch {
              // Ignore parse errors for partial lines
            }
          }
        }
      }

      this.logger.log(`Model ${modelName} pulled successfully`);
    } catch (error) {
      this.logger.error(`Error pulling model ${modelName}: ${error}`);
      throw error;
    }
  }

  /**
   * Pull a model asynchronously (returns immediately with job ID)
   * Use getPullJobStatus to check progress
   */
  async pullModelAsync(modelName: string): Promise<{ jobId: string }> {
    const jobId = `pull-${modelName}-${Date.now()}`;
    
    this.pullJobs.set(jobId, {
      status: 'pulling',
      startedAt: new Date(),
      message: `Starting pull for ${modelName}...`,
    });

    // Start pull in background
    this.pullModelBackground(jobId, modelName);

    return { jobId };
  }

  private async pullModelBackground(jobId: string, modelName: string): Promise<void> {
    try {
      this.logger.log(`[${jobId}] Starting background pull for: ${modelName}`);
      
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let lastProgress = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              
              // Calculate progress percentage
              if (data.completed && data.total) {
                lastProgress = Math.round((data.completed / data.total) * 100);
              }
              
              this.pullJobs.set(jobId, {
                status: 'pulling',
                progress: lastProgress,
                message: data.status || `Downloading ${modelName}...`,
                startedAt: this.pullJobs.get(jobId)?.startedAt || new Date(),
              });
              
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      this.pullJobs.set(jobId, {
        status: 'success',
        progress: 100,
        message: `Model ${modelName} pulled successfully`,
        startedAt: this.pullJobs.get(jobId)?.startedAt || new Date(),
        completedAt: new Date(),
      });
      
      this.logger.log(`[${jobId}] Model ${modelName} pulled successfully`);
      
      // Clean up job after 5 minutes
      setTimeout(() => this.pullJobs.delete(jobId), 5 * 60 * 1000);
      
    } catch (error) {
      this.logger.error(`[${jobId}] Error pulling model ${modelName}: ${error}`);
      
      this.pullJobs.set(jobId, {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        startedAt: this.pullJobs.get(jobId)?.startedAt || new Date(),
        completedAt: new Date(),
      });
      
      // Clean up job after 5 minutes
      setTimeout(() => this.pullJobs.delete(jobId), 5 * 60 * 1000);
    }
  }

  /**
   * Get the status of a pull job
   */
  getPullJobStatus(jobId: string): { 
    status: 'pulling' | 'success' | 'error' | 'not_found';
    progress?: number;
    message?: string;
  } {
    const job = this.pullJobs.get(jobId);
    if (!job) {
      return { status: 'not_found', message: 'Job not found' };
    }
    return {
      status: job.status,
      progress: job.progress,
      message: job.message,
    };
  }

  /**
   * Get all active pull jobs
   */
  getActivePullJobs(): Array<{ 
    jobId: string;
    status: string;
    progress?: number;
    message?: string;
  }> {
    return Array.from(this.pullJobs.entries()).map(([jobId, job]) => ({
      jobId,
      status: job.status,
      progress: job.progress,
      message: job.message,
    }));
  }


  getModel(modelName?: string) {
    return this.ollama(modelName || this.defaultModel);
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async generate(options: GenerateOptions) {
    const model = this.getModel(options.model);

    try {
      const result = await generateText({
        model,
        messages: options.messages,
        tools: options.tools,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens,
      });

      return result;
    } catch (error) {
      this.logger.error(`Error generating text: ${error}`);
      throw error;
    }
  }

  async *stream(options: StreamOptions) {
    const model = this.getModel(options.model);

    try {
      const result = streamText({
        model,
        messages: options.messages,
        tools: options.tools,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens,
      });

      for await (const event of (await result).fullStream) {
        yield event;
      }
    } catch (error) {
      this.logger.error(`Error streaming text: ${error}`);
      throw error;
    }
  }

  /**
   * Raw chat method using direct Ollama API (like TrackingAgent)
   * Better compatibility with smaller models that struggle with structured tool calling
   */
  async rawChat(options: {
    model?: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
  }): Promise<{ content: string }> {
    const modelName = options.model || this.defaultModel;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: options.messages,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${text}`);
      }

      const data = await response.json() as { message: { content: string } };
      return { content: data.message?.content || '' };
    } catch (error) {
      this.logger.error(`Error in rawChat: ${error}`);
      throw error;
    }
  }

  /**
   * Chat with native tool calling support
   * Uses Ollama's /api/chat with tools parameter for proper function calling
   */
  async chatWithTools(options: {
    model?: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    tools: Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: {
          type: 'object';
          properties: Record<string, { type: string; description: string; enum?: string[] }>;
          required?: string[];
        };
      };
    }>;
    temperature?: number;
  }): Promise<{
    content: string;
    toolCalls?: Array<{
      name: string;
      arguments: Record<string, unknown>;
    }>;
  }> {
    const modelName = options.model || this.defaultModel;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: options.messages,
          tools: options.tools,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${text}`);
      }

      const data = await response.json() as { 
        message: { 
          content: string;
          tool_calls?: Array<{
            function: {
              name: string;
              arguments: Record<string, unknown>;
            };
          }>;
        };
      };
      
      const toolCalls = data.message?.tool_calls?.map(tc => ({
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      return { 
        content: data.message?.content || '',
        toolCalls,
      };
    } catch (error) {
      this.logger.error(`Error in chatWithTools: ${error}`);
      throw error;
    }
  }


  /**
   * Raw streaming chat using direct Ollama API
   */
  async *rawChatStream(options: {
    model?: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
  }): AsyncGenerator<{ content: string; done: boolean }, void, unknown> {
    const modelName = options.model || this.defaultModel;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: options.messages,
          stream: true,
          options: {
            temperature: options.temperature ?? 0.7,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${text}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
              if (parsed.message?.content) {
                yield { content: parsed.message.content, done: parsed.done || false };
              }
              if (parsed.done) return;
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error in rawChatStream: ${error}`);
      throw error;
    }
  }
}
