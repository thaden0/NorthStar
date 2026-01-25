import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { serviceSettings, mcpServers, ServiceSetting, McpServer } from '../database/schema';
import { eq } from 'drizzle-orm';
import { OllamaService, OllamaModel } from '../llm/ollama.service';
import {
  ServiceSettingInput,
  UpdateServiceSettingInput,
  CreateMcpServer,
  UpdateMcpServer,
} from '../agent/schemas';

// Default settings
const DEFAULT_SETTINGS = [
  {
    key: 'ollama.defaultModel',
    value: 'llama3.2',
    description: 'Default Ollama model for agent inference',
    category: 'llm',
  },
  {
    key: 'ollama.temperature',
    value: 0.7,
    description: 'Default temperature for LLM generation',
    category: 'llm',
  },
  {
    key: 'agent.maxIterations',
    value: 10,
    description: 'Maximum iterations for main agent execution',
    category: 'agent',
  },
  {
    key: 'agent.subAgentMaxIterations',
    value: 5,
    description: 'Maximum iterations for sub-agent execution',
    category: 'agent',
  },
  {
    key: 'playwright.timeout',
    value: 30000,
    description: 'Timeout for Playwright browser operations in milliseconds',
    category: 'tools',
  },
  {
    key: 'playwright.headless',
    value: true,
    description: 'Run Playwright in headless mode',
    category: 'tools',
  },
];

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private databaseService: DatabaseService,
    private ollamaService: OllamaService,
  ) {}

  async initializeDefaults(): Promise<void> {
    try {
      const db = this.databaseService.getDb();
      if (!db) {
        this.logger.warn('Database not yet initialized, skipping default settings initialization');
        return;
      }

      for (const setting of DEFAULT_SETTINGS) {
        const existing = await db
          .select()
          .from(serviceSettings)
          .where(eq(serviceSettings.key, setting.key))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(serviceSettings).values({
            key: setting.key,
            value: setting.value,
            description: setting.description,
            category: setting.category,
          });
          this.logger.log(`Initialized default setting: ${setting.key}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to initialize default settings: ${error}`);
    }
  }

  // ============ Service Settings CRUD ============

  async getAllSettings(): Promise<ServiceSetting[]> {
    const db = this.databaseService.getDb();
    return db.select().from(serviceSettings);
  }

  async getSettingsByCategory(category: string): Promise<ServiceSetting[]> {
    const db = this.databaseService.getDb();
    return db
      .select()
      .from(serviceSettings)
      .where(eq(serviceSettings.category, category));
  }

  async getSetting(key: string): Promise<ServiceSetting> {
    const db = this.databaseService.getDb();
    const [setting] = await db
      .select()
      .from(serviceSettings)
      .where(eq(serviceSettings.key, key))
      .limit(1);

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    return setting;
  }

  async getSettingValue<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    try {
      const setting = await this.getSetting(key);
      return setting.value as T;
    } catch (error) {
      if (error instanceof NotFoundException && defaultValue !== undefined) {
        return defaultValue;
      }
      throw error;
    }
  }

  async createSetting(data: ServiceSettingInput): Promise<ServiceSetting> {
    const db = this.databaseService.getDb();

    // Check if setting already exists
    const existing = await db
      .select()
      .from(serviceSettings)
      .where(eq(serviceSettings.key, data.key))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(`Setting with key "${data.key}" already exists`);
    }

    const [setting] = await db
      .insert(serviceSettings)
      .values({
        key: data.key,
        value: data.value,
        description: data.description,
        category: data.category || 'general',
      })
      .returning();

    this.logger.log(`Created setting: ${setting.key}`);
    return setting;
  }

  async updateSetting(key: string, data: UpdateServiceSettingInput): Promise<ServiceSetting> {
    const db = this.databaseService.getDb();

    // Ensure setting exists
    await this.getSetting(key);

    const [updated] = await db
      .update(serviceSettings)
      .set({
        value: data.value,
        description: data.description,
        category: data.category,
        updatedAt: new Date(),
      })
      .where(eq(serviceSettings.key, key))
      .returning();

    this.logger.log(`Updated setting: ${key}`);
    return updated;
  }

  async deleteSetting(key: string): Promise<void> {
    const db = this.databaseService.getDb();

    // Ensure setting exists
    await this.getSetting(key);

    await db.delete(serviceSettings).where(eq(serviceSettings.key, key));
    this.logger.log(`Deleted setting: ${key}`);
  }

  // ============ Ollama Model Management ============

  async listOllamaModels(): Promise<OllamaModel[]> {
    return this.ollamaService.listModels();
  }

  async getDefaultModel(): Promise<string> {
    return this.getSettingValue('ollama.defaultModel', this.ollamaService.getDefaultModel());
  }

  async setDefaultModel(modelName: string): Promise<ServiceSetting> {
    // Verify model exists
    const exists = await this.ollamaService.checkModelExists(modelName);
    if (!exists) {
      throw new NotFoundException(`Model "${modelName}" not found in Ollama`);
    }

    return this.updateSetting('ollama.defaultModel', { value: modelName });
  }

  async pullOllamaModel(modelName: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.ollamaService.pullModel(modelName);
      return { success: true, message: `Model ${modelName} pulled successfully` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============ MCP Server CRUD ============

  async getAllMcpServers(): Promise<McpServer[]> {
    const db = this.databaseService.getDb();
    return db.select().from(mcpServers);
  }

  async getMcpServer(id: string): Promise<McpServer> {
    const db = this.databaseService.getDb();
    const [server] = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);

    if (!server) {
      throw new NotFoundException(`MCP Server with ID ${id} not found`);
    }

    return server;
  }

  async createMcpServer(data: CreateMcpServer): Promise<McpServer> {
    const db = this.databaseService.getDb();

    const [server] = await db
      .insert(mcpServers)
      .values({
        name: data.name,
        url: data.url,
        apiKey: data.apiKey,
        enabled: data.enabled ?? true,
        capabilities: data.capabilities,
        metadata: data.metadata,
      })
      .returning();

    this.logger.log(`Created MCP server: ${server.name}`);
    return server;
  }

  async updateMcpServer(id: string, data: UpdateMcpServer): Promise<McpServer> {
    const db = this.databaseService.getDb();

    // Ensure server exists
    await this.getMcpServer(id);

    const [updated] = await db
      .update(mcpServers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(mcpServers.id, id))
      .returning();

    this.logger.log(`Updated MCP server: ${id}`);
    return updated;
  }

  async deleteMcpServer(id: string): Promise<void> {
    const db = this.databaseService.getDb();

    // Ensure server exists
    await this.getMcpServer(id);

    await db.delete(mcpServers).where(eq(mcpServers.id, id));
    this.logger.log(`Deleted MCP server: ${id}`);
  }

  async toggleMcpServer(id: string, enabled: boolean): Promise<McpServer> {
    return this.updateMcpServer(id, { enabled });
  }
}
