import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PlaywrightService } from './playwright.service';
import { GoogleNewsService } from './google-news.service';
import { GmailToolService } from './gmail-tool.service';
import { CronJobsService } from '../cron/cron-jobs.service';
import { MemoryToolsService } from '../memory/memory-tools.service';
import { WikipediaService } from './wikipedia.service';
import { RedditService } from './reddit.service';
import { BackgroundAgentService } from './background-agent.service';
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
 * Widget event data types
 */
export interface WidgetEventData {
  widgetId: string;
  widgetType: 'email_send' | 'email_read' | 'calendar' | 'contacts';
  widgetData: Record<string, unknown>;
  canCancel?: boolean;
}

/**
 * Context passed to tools during execution
 */
export interface ToolExecutionContext {
  userId: string;
  authToken?: string;
  onStatus?: (message: string) => void;
  onWidgetOpen?: (data: WidgetEventData) => void;
  onWidgetUpdate?: (widgetId: string, data: Record<string, unknown>) => void;
  onWidgetClose?: (widgetId: string) => void;
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
    private memoryToolsService: MemoryToolsService,
    private wikipediaService: WikipediaService,
    private redditService: RedditService,
    @Inject(forwardRef(() => BackgroundAgentService))
    private backgroundAgentService: BackgroundAgentService,
  ) {
    this.registerDefaultTools();
    this.registerMemoryTools();
    this.registerWikipediaTools();
    this.registerRedditTools();
    this.registerBackgroundTools();
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
            isComplete: true,
            finalResult: `✅ I've scheduled your task "${job.name}" to run ${scheduleDesc}. You'll receive the results when it executes.`,
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
   * Register memory tools from MemoryToolsService
   */
  private registerMemoryTools(): void {
    const memoryTools = this.memoryToolsService.getToolDefinitions();
    
    for (const tool of memoryTools) {
      this.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: async (args, context) => {
          return tool.execute(args, context);
        },
      });
    }
    
    this.logger.log(`Registered ${memoryTools.length} memory tools`);
  }

  /**
   * Register Wikipedia tools
   */
  private registerWikipediaTools(): void {
    // Wikipedia search tool
    this.registerTool({
      name: 'search_wikipedia',
      description: 'Search Wikipedia for articles matching a query. Returns article titles, snippets, and URLs.',
      parameters: {
        query: { type: 'string', description: 'Search query for Wikipedia', required: true },
        limit: { type: 'number', description: 'Maximum number of results to return (default: 10)' },
      },
      execute: async (args, context) => {
        const query = args.query as string;
        const limit = (args.limit as number) || 10;
        context.onStatus?.(`Searching Wikipedia for: ${query}`);
        
        const result = await this.wikipediaService.search(query, limit);
        
        if (result.error) {
          return { success: false, error: result.error, summary: `Search failed: ${result.error}` };
        }
        
        return {
          success: true,
          data: {
            query: result.query,
            resultCount: result.results.length,
            results: result.results,
          },
          summary: `Found ${result.results.length} Wikipedia articles for "${query}"`,
        };
      },
    });

    // Get Wikipedia article tool
    this.registerTool({
      name: 'get_wikipedia_article',
      description: 'Get the full content of a Wikipedia article including text, links, references, and categories.',
      parameters: {
        title: { type: 'string', description: 'Title of the Wikipedia article', required: true },
      },
      execute: async (args, context) => {
        const title = args.title as string;
        context.onStatus?.(`Fetching Wikipedia article: ${title}`);
        
        const result = await this.wikipediaService.getArticle(title);
        
        if ('error' in result) {
          return { success: false, error: result.error, summary: `Failed to get article: ${result.error}` };
        }
        
        return {
          success: true,
          data: {
            title: result.title,
            summary: result.summary,
            content: result.content.substring(0, 8000), // Limit content size
            url: result.url,
            linkCount: result.links.length,
            referenceCount: result.references.length,
            categories: result.categories,
            sampleLinks: result.links.slice(0, 15),
            sampleReferences: result.references.slice(0, 10),
          },
          summary: `Retrieved "${result.title}" - ${result.content.length} chars, ${result.links.length} links, ${result.references.length} references`,
        };
      },
    });

    this.logger.log('Registered Wikipedia tools');
  }

  /**
   * Register Reddit tools
   */
  private registerRedditTools(): void {
    // Reddit search tool
    this.registerTool({
      name: 'search_reddit',
      description: 'Search Reddit for posts on a topic. Can optionally filter by subreddit.',
      parameters: {
        query: { type: 'string', description: 'Search query', required: true },
        subreddit: { type: 'string', description: 'Subreddit to search in (optional, searches all of Reddit if not specified)' },
        sort: { type: 'string', description: 'Sort order: relevance, hot, top, new, comments (default: relevance)' },
        time: { type: 'string', description: 'Time filter: hour, day, week, month, year, all (default: all)' },
        limit: { type: 'number', description: 'Maximum number of results (default: 25, max: 100)' },
      },
      execute: async (args, context) => {
        const query = args.query as string;
        const subreddit = args.subreddit as string | undefined;
        context.onStatus?.(`Searching Reddit for: ${query}${subreddit ? ` in r/${subreddit}` : ''}`);
        
        const result = await this.redditService.search(query, {
          subreddit,
          sort: args.sort as 'relevance' | 'hot' | 'top' | 'new' | 'comments',
          time: args.time as 'hour' | 'day' | 'week' | 'month' | 'year' | 'all',
          limit: (args.limit as number) || 25,
        });
        
        if (result.error) {
          return { success: false, error: result.error, summary: `Search failed: ${result.error}` };
        }
        
        return {
          success: true,
          data: {
            query: result.query,
            subreddit: result.subreddit,
            postCount: result.posts.length,
            posts: result.posts.map(p => ({
              id: p.id,
              title: p.title,
              subreddit: p.subreddit,
              author: p.author,
              score: p.score,
              numComments: p.numComments,
              url: p.url,
              selftext: p.selftext?.substring(0, 500),
              createdAt: new Date(p.createdUtc * 1000).toISOString(),
            })),
          },
          summary: `Found ${result.posts.length} Reddit posts for "${query}"`,
        };
      },
    });

    // Read Reddit thread tool
    this.registerTool({
      name: 'read_reddit_thread',
      description: 'Read a Reddit thread including the post content and top comments.',
      parameters: {
        permalink: { type: 'string', description: 'Reddit permalink or full URL to the thread', required: true },
        sort: { type: 'string', description: 'Comment sort order: confidence, top, new, controversial, old, qa (default: top)' },
        commentLimit: { type: 'number', description: 'Maximum number of comments to retrieve (default: 50)' },
      },
      execute: async (args, context) => {
        const permalink = args.permalink as string;
        context.onStatus?.(`Reading Reddit thread...`);
        
        const result = await this.redditService.getThread(permalink, {
          sort: (args.sort as 'confidence' | 'top' | 'new' | 'controversial' | 'old' | 'qa') || 'top',
          limit: (args.commentLimit as number) || 50,
          depth: 3,
        });
        
        if ('error' in result) {
          return { success: false, error: result.error, summary: `Failed to read thread: ${result.error}` };
        }
        
        // Flatten comments for easier reading
        const flattenComments = (comments: typeof result.comments, maxDepth = 3): Array<{ author: string; body: string; score: number; depth: number }> => {
          const flat: Array<{ author: string; body: string; score: number; depth: number }> = [];
          for (const c of comments) {
            flat.push({ author: c.author, body: c.body.substring(0, 1000), score: c.score, depth: c.depth });
            if (c.depth < maxDepth && c.replies.length > 0) {
              flat.push(...flattenComments(c.replies, maxDepth));
            }
          }
          return flat;
        };
        
        return {
          success: true,
          data: {
            post: {
              title: result.post.title,
              author: result.post.author,
              subreddit: result.post.subreddit,
              score: result.post.score,
              upvoteRatio: result.post.upvoteRatio,
              numComments: result.post.numComments,
              selftext: result.post.selftext,
              url: result.post.url,
              linkUrl: result.post.linkUrl,
              createdAt: new Date(result.post.createdUtc * 1000).toISOString(),
            },
            comments: flattenComments(result.comments).slice(0, 30),
            totalComments: result.totalComments,
          },
          summary: `Read thread "${result.post.title.substring(0, 50)}..." with ${result.comments.length} top-level comments`,
        };
      },
    });

    // Get hot posts tool
    this.registerTool({
      name: 'get_reddit_hot',
      description: 'Get hot/trending posts from Reddit or a specific subreddit.',
      parameters: {
        subreddit: { type: 'string', description: 'Subreddit name (optional, gets front page if not specified)' },
        limit: { type: 'number', description: 'Maximum number of posts (default: 25)' },
      },
      execute: async (args, context) => {
        const subreddit = args.subreddit as string | undefined;
        context.onStatus?.(`Getting hot posts${subreddit ? ` from r/${subreddit}` : ''}...`);
        
        const result = await this.redditService.getHot(subreddit, (args.limit as number) || 25);
        
        if (result.error) {
          return { success: false, error: result.error, summary: `Failed: ${result.error}` };
        }
        
        return {
          success: true,
          data: {
            subreddit: subreddit || 'front page',
            postCount: result.posts.length,
            posts: result.posts.map(p => ({
              title: p.title,
              subreddit: p.subreddit,
              score: p.score,
              numComments: p.numComments,
              url: p.url,
            })),
          },
          summary: `Got ${result.posts.length} hot posts${subreddit ? ` from r/${subreddit}` : ''}`,
        };
      },
    });

    this.logger.log('Registered Reddit tools');
  }

  /**
   * Register background agent tools
   */
  private registerBackgroundTools(): void {
    // Start background task tool
    this.registerTool({
      name: 'start_background_task',
      description: 'Start a long-running task in the background. The task will complete without blocking the conversation. Use this for complex research, data gathering, or any task that might take a long time.',
      parameters: {
        prompt: { type: 'string', description: 'The task to complete in the background', required: true },
        researchMode: { type: 'boolean', description: 'Enable research mode to gather information from Wikipedia, news, and Reddit (default: false)' },
      },
      execute: async (args, context) => {
        const prompt = args.prompt as string;
        const researchMode = args.researchMode as boolean || false;
        
        context.onStatus?.(`Starting background ${researchMode ? 'research' : 'task'}...`);
        
        try {
          const taskId = await this.backgroundAgentService.startBackgroundTask({
            userId: context.userId,
            prompt,
            researchMode,
            authToken: context.authToken,
          });
          
          return {
            success: true,
            data: { taskId, researchMode },
            summary: `Background ${researchMode ? 'research' : 'task'} started with ID: ${taskId}`,
            isComplete: true,
            finalResult: `✅ I've started a background ${researchMode ? 'research task' : 'task'} for you. Task ID: ${taskId}\n\nThe task will run in the background and you'll be notified when it's complete. You can check the status anytime.`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            summary: 'Failed to start background task',
          };
        }
      },
    });

    // Check background task status
    this.registerTool({
      name: 'check_background_task',
      description: 'Check the status of a background task.',
      parameters: {
        taskId: { type: 'string', description: 'The task ID to check', required: true },
      },
      execute: async (args, context) => {
        const taskId = args.taskId as string;
        context.onStatus?.('Checking task status...');
        
        const status = this.backgroundAgentService.getTaskStatus(taskId);
        
        if (!status) {
          return {
            success: false,
            error: `Task ${taskId} not found or has been cleaned up`,
            summary: 'Task not found',
          };
        }
        
        return {
          success: true,
          data: status,
          summary: `Task ${taskId}: ${status.status} (${status.progress}%)${status.currentStep ? ` - ${status.currentStep}` : ''}`,
        };
      },
    });

    this.logger.log('Registered background agent tools');
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
   * Get tools in Ollama's JSON Schema format for native tool calling
   */
  getToolsForOllama(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, { type: string; description: string; enum?: string[] }>;
        required: string[];
      };
    };
  }> {
    const ollamaTools: Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: {
          type: 'object';
          properties: Record<string, { type: string; description: string; enum?: string[] }>;
          required: string[];
        };
      };
    }> = [];

    for (const tool of this.tools.values()) {
      const properties: Record<string, { type: string; description: string; enum?: string[] }> = {};
      const required: string[] = [];

      for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
        properties[paramName] = {
          type: paramDef.type,
          description: paramDef.description,
        };
        if (paramDef.required) {
          required.push(paramName);
        }
      }

      ollamaTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object',
            properties,
            required,
          },
        },
      });
    }

    return ollamaTools;
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
   * Execute a native tool call from Ollama (simpler interface)
   */
  async executeNativeToolCall(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      this.logger.warn(`Unknown tool: ${name}`);
      return {
        success: false,
        error: `Unknown tool: ${name}`,
        summary: `Tool "${name}" not found`,
      };
    }

    try {
      this.logger.debug(`Executing native tool: ${name} with args: ${JSON.stringify(args)}`);
      const result = await tool.execute(args, context);
      this.logger.debug(`Tool ${name} result: ${result.summary}`);
      return result;
    } catch (error) {
      this.logger.error(`Tool execution error (${name}): ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        summary: `Tool "${name}" failed`,
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
