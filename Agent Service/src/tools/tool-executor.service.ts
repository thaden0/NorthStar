import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PlaywrightService } from './playwright.service';
import { GoogleNewsService } from './google-news.service';
import { GmailToolService } from './gmail-tool.service';
import { CronJobsService } from '../cron/cron-jobs.service';
import { ParsedToolCall } from './tool-parser.service';

/**
 * Result of executing a tool
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  summary: string;
  /** If true, this tool signals task completion */
  isComplete?: boolean;
  /** The final result to return to the user (for complete_task) */
  finalResult?: string;
}

/**
 * Context passed to tools during execution
 */
export interface ToolExecutionContext {
  userId: string;
  authToken?: string;
  onStatus?: (message: string) => void;
}

/**
 * Tool definition for registration
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}

/**
 * Service responsible for executing parsed tool calls.
 * 
 * This maintains a registry of available tools and handles
 * the execution of tool calls parsed from LLM output.
 */
@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);
  private readonly tools: Map<string, ToolDefinition> = new Map();

  constructor(
    private playwrightService: PlaywrightService,
    private googleNewsService: GoogleNewsService,
    private gmailToolService: GmailToolService,
    @Inject(forwardRef(() => CronJobsService))
    private cronJobsService: CronJobsService,
  ) {
    this.registerDefaultTools();
  }

  /**
   * Register all default tools
   */
  private registerDefaultTools(): void {
    // Status tool
    this.registerTool({
      name: 'send_status',
      description: 'Send a status message to the user about what you are doing',
      parameters: {
        message: { type: 'string', description: 'Status message to display', required: true },
      },
      execute: async (args, context) => {
        const message = args.message as string;
        context.onStatus?.(message);
        return { success: true, summary: `Status: ${message}` };
      },
    });

    // Complete task tool
    this.registerTool({
      name: 'complete_task',
      description: 'Mark the task as complete and provide the final result to the user',
      parameters: {
        summary: { type: 'string', description: 'Summary of what was accomplished', required: true },
        result: { type: 'string', description: 'The final result/answer for the user', required: true },
      },
      execute: async (args) => {
        const summary = args.summary as string || 'Task completed';
        const result = args.result as string || '';
        return {
          success: true,
          summary,
          isComplete: true,
          finalResult: result,
          data: { summary, result },
        };
      },
    });

    // Browse URL tool
    this.registerTool({
      name: 'browse_url',
      description: 'Browse a URL and extract its content',
      parameters: {
        url: { type: 'string', description: 'The URL to browse', required: true },
      },
      execute: async (args, context) => {
        const url = args.url as string;
        context.onStatus?.(`Browsing: ${url}`);
        
        const result = await this.playwrightService.browsePage(url);
        
        if (result.error) {
          return { success: false, error: result.error, summary: `Failed to browse: ${result.error}` };
        }
        
        return {
          success: true,
          data: {
            title: result.title,
            content: result.content.substring(0, 5000),
            linkCount: result.links.length,
            imageCount: result.images.length,
          },
          summary: `Browsed "${result.title}" - ${result.content.length} chars`,
        };
      },
    });

    // Search news tool
    this.registerTool({
      name: 'search_news',
      description: 'Search for news articles on a topic',
      parameters: {
        query: { type: 'string', description: 'Search query', required: true },
        language: { type: 'string', description: 'Language code (e.g., "en")' },
        country: { type: 'string', description: 'Country code (e.g., "US")' },
      },
      execute: async (args, context) => {
        const query = args.query as string;
        context.onStatus?.(`Searching news for: ${query}`);
        
        const result = await this.googleNewsService.searchNews(query, {
          language: args.language as string,
          country: args.country as string,
        });
        
        if (result.error) {
          return { success: false, error: result.error, summary: `Search failed: ${result.error}` };
        }
        
        return {
          success: true,
          data: {
            query: result.query,
            articleCount: result.articles.length,
            articles: result.articles.slice(0, 10).map(a => ({
              title: a.title,
              description: a.description?.substring(0, 200),
              url: a.url,
              source: a.source,
              publishedAt: a.publishedAt,
            })),
          },
          summary: `Found ${result.articles.length} articles for "${query}"`,
        };
      },
    });

    // Get top headlines tool
    this.registerTool({
      name: 'get_top_headlines',
      description: 'Get the latest top news headlines',
      parameters: {
        category: { type: 'string', description: 'Category (technology, business, sports, etc.)' },
        language: { type: 'string', description: 'Language code' },
        country: { type: 'string', description: 'Country code' },
      },
      execute: async (args, context) => {
        const category = args.category as string;
        context.onStatus?.(`Getting headlines${category ? ` for ${category}` : ''}`);
        
        const result = await this.googleNewsService.getTopHeadlines(category, {
          language: args.language as string,
          country: args.country as string,
        });
        
        if (result.error) {
          return { success: false, error: result.error, summary: `Failed: ${result.error}` };
        }
        
        return {
          success: true,
          data: {
            category: result.category,
            articleCount: result.articles.length,
            articles: result.articles.slice(0, 10),
          },
          summary: `Got ${result.articles.length} headlines`,
        };
      },
    });

    // Take screenshot tool
    this.registerTool({
      name: 'take_screenshot',
      description: 'Take a screenshot of a web page',
      parameters: {
        url: { type: 'string', description: 'URL to screenshot', required: true },
      },
      execute: async (args, context) => {
        const url = args.url as string;
        context.onStatus?.(`Taking screenshot: ${url}`);
        
        const result = await this.playwrightService.takeScreenshot(url);
        
        if (result.error) {
          return { success: false, error: result.error, summary: `Screenshot failed: ${result.error}` };
        }
        
        return {
          success: true,
          data: { screenshot: result.screenshot?.substring(0, 100) + '...' },
          summary: 'Screenshot captured',
        };
      },
    });

    // Gmail: Get messages
    this.registerTool({
      name: 'get_gmail_messages',
      description: "Get the user's latest Gmail messages from their inbox",
      parameters: {
        maxResults: { type: 'number', description: 'Maximum messages to retrieve (default: 10)' },
      },
      execute: async (args, context) => {
        if (!context.authToken) {
          return { success: false, error: 'No auth token - Gmail not available', summary: 'Gmail access denied' };
        }
        
        context.onStatus?.('Fetching Gmail messages...');
        
        const result = await this.gmailToolService.getMessages(
          context.userId,
          context.authToken,
          { maxResults: (args.maxResults as number) || 10 }
        );
        
        if (result.error) {
          return { success: false, error: result.error, summary: `Gmail error: ${result.error}` };
        }
        
        return {
          success: true,
          data: {
            messageCount: result.messages.length,
            messages: result.messages.map(m => ({
              id: m.id,
              from: m.from,
              subject: m.subject,
              snippet: m.snippet,
              date: m.date,
              isUnread: m.isUnread,
            })),
          },
          summary: `Found ${result.messages.length} Gmail messages`,
        };
      },
    });

    // Gmail: Search
    this.registerTool({
      name: 'search_gmail',
      description: 'Search Gmail using Gmail search syntax',
      parameters: {
        query: { type: 'string', description: 'Gmail search query', required: true },
      },
      execute: async (args, context) => {
        if (!context.authToken) {
          return { success: false, error: 'No auth token', summary: 'Gmail access denied' };
        }
        
        const query = args.query as string;
        context.onStatus?.(`Searching Gmail for: ${query}`);
        
        const result = await this.gmailToolService.searchMessages(
          context.userId,
          context.authToken,
          query
        );
        
        if (result.error) {
          return { success: false, error: result.error, summary: `Search error: ${result.error}` };
        }
        
        return {
          success: true,
          data: {
            query,
            messageCount: result.messages.length,
            messages: result.messages,
          },
          summary: `Found ${result.messages.length} matching emails`,
        };
      },
    });

    // Schedule task tool
    this.registerTool({
      name: 'schedule_task',
      description: 'Schedule a task to run at a specific time or on a recurring schedule. Use this when the user wants something done at a future time (e.g., "remind me tomorrow", "every Friday at 9am", "at 5pm today", "tell me X at Y time").',
      parameters: {
        name: { type: 'string', description: 'Short name for the scheduled task', required: true },
        prompt: { type: 'string', description: 'The full prompt/task to execute at the scheduled time', required: true },
        scheduleType: { type: 'string', description: '"once" for one-time tasks, "recurring" for repeating', required: true },
        scheduledAt: { type: 'string', description: 'For one-time: ISO datetime (e.g., "2026-01-27T23:25:00")' },
        recurringPattern: { type: 'string', description: 'For recurring: daily, weekly, biweekly, monthly, weekdays, weekends' },
        recurringDay: { type: 'number', description: 'For weekly: day 0-6 (0=Sun, 5=Fri). For monthly: day 1-31' },
        recurringTime: { type: 'string', description: 'Time in HH:MM format (e.g., "09:00", "23:25")' },
      },
      execute: async (args, context) => {
        context.onStatus?.('Scheduling task...');
        
        try {
          const job = await this.cronJobsService.create(context.userId, {
            name: args.name as string,
            prompt: args.prompt as string,
            scheduleType: args.scheduleType as 'once' | 'recurring' | 'cron',
            scheduledAt: args.scheduledAt as string,
            recurringPattern: args.recurringPattern as string,
            recurringDay: args.recurringDay as number,
            recurringTime: args.recurringTime as string,
            timezone: 'America/New_York',
            enabled: true,
          });

          const scheduleDesc = args.scheduleType === 'once' 
            ? `at ${args.scheduledAt}` 
            : `${args.recurringPattern} at ${args.recurringTime}`;

          return {
            success: true,
            data: { jobId: job.id, name: job.name, nextRunAt: job.nextRunAt },
            summary: `Scheduled "${job.name}" to run ${scheduleDesc}`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            summary: `Failed to schedule task`,
          };
        }
      },
    });

    this.logger.log(`Registered ${this.tools.size} tools`);
  }

  /**
   * Register a new tool
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    this.logger.debug(`Registered tool: ${tool.name}`);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool descriptions for the system prompt
   */
  getToolDescriptions(): string {
    const descriptions: string[] = [];
    
    for (const tool of this.tools.values()) {
      const params = Object.entries(tool.parameters)
        .map(([name, def]) => `${name}: ${def.description}${def.required ? ' (required)' : ''}`)
        .join(', ');
      
      descriptions.push(`- ${tool.name}: ${tool.description}. Parameters: {${params}}`);
    }
    
    return descriptions.join('\n');
  }

  /**
   * Execute a parsed tool call
   */
  async executeTool(
    toolCall: ParsedToolCall,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolCall.name);
    
    if (!tool) {
      this.logger.warn(`Unknown tool: ${toolCall.name}`);
      return {
        success: false,
        error: `Unknown tool: ${toolCall.name}`,
        summary: `Tool "${toolCall.name}" not found`,
      };
    }

    try {
      this.logger.debug(`Executing tool: ${toolCall.name} with args: ${JSON.stringify(toolCall.arguments)}`);
      const result = await tool.execute(toolCall.arguments, context);
      this.logger.debug(`Tool ${toolCall.name} result: ${result.summary}`);
      return result;
    } catch (error) {
      this.logger.error(`Tool execution error (${toolCall.name}): ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        summary: `Tool "${toolCall.name}" failed`,
      };
    }
  }

  /**
   * Execute multiple tool calls
   */
  async executeTools(
    toolCalls: ParsedToolCall[],
    context: ToolExecutionContext
  ): Promise<Array<{ call: ParsedToolCall; result: ToolExecutionResult }>> {
    const results: Array<{ call: ParsedToolCall; result: ToolExecutionResult }> = [];
    
    for (const call of toolCalls) {
      const result = await this.executeTool(call, context);
      results.push({ call, result });
      
      // Stop if task is complete
      if (result.isComplete) {
        break;
      }
    }
    
    return results;
  }
}
