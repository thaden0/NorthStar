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

      // Stream the response to completion
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }

      this.logger.log(`Model ${modelName} pulled successfully`);
    } catch (error) {
      this.logger.error(`Error pulling model ${modelName}: ${error}`);
      throw error;
    }
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
}
