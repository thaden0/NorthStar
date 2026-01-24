import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PlaywrightService, BrowseResult } from '../tools/playwright.service';
import { GoogleNewsService, NewsSearchResult, TopHeadlinesResult } from '../tools/google-news.service';
import { tool } from 'ai';

// Tool parameter schemas
const BrowseUrlParamsSchema = z.object({
  url: z.string().url().describe('The URL to browse and extract content from'),
});

const SearchNewsParamsSchema = z.object({
  query: z.string().describe('The search query for news articles'),
  language: z.string().optional().describe('Language code (e.g., "en")'),
  country: z.string().optional().describe('Country code (e.g., "US")'),
});

const GetTopHeadlinesParamsSchema = z.object({
  category: z.string().optional().describe('News category (e.g., "technology", "business", "sports")'),
  language: z.string().optional().describe('Language code (e.g., "en")'),
  country: z.string().optional().describe('Country code (e.g., "US")'),
});

const TakeScreenshotParamsSchema = z.object({
  url: z.string().url().describe('The URL to take a screenshot of'),
});

const CreateSubtaskParamsSchema = z.object({
  task: z.string().describe('The subtask description to delegate to a sub-agent'),
  context: z.string().optional().describe('Additional context for the sub-agent'),
});

const CompleteTaskParamsSchema = z.object({
  summary: z.string().describe('Summary of what was accomplished'),
  result: z.string().describe('The final result to return to the user'),
});

const SendStatusParamsSchema = z.object({
  message: z.string().describe('Status message to send to the user (e.g., "Reading document...", "Analyzing data...")'),
});

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  summary: string;
}

export type StatusCallback = (message: string) => void;
export type SubtaskCallback = (task: string, context?: string) => Promise<string>;

@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);
  private statusCallback?: StatusCallback;
  private subtaskCallback?: SubtaskCallback;

  constructor(
    private playwrightService: PlaywrightService,
    private googleNewsService: GoogleNewsService,
  ) {}

  setStatusCallback(callback: StatusCallback) {
    this.statusCallback = callback;
  }

  setSubtaskCallback(callback: SubtaskCallback) {
    this.subtaskCallback = callback;
  }

  private sendStatus(message: string) {
    if (this.statusCallback) {
      this.statusCallback(message);
    }
  }

  getTools() {
    return {
      browse_url: tool({
        description:
          'Browse a URL and extract its content, including text, links, and images. Use this to read web pages and gather information.',
        parameters: BrowseUrlParamsSchema,
        execute: async ({ url }) => {
          this.sendStatus(`Browsing: ${url}`);
          const result = await this.playwrightService.browsePage(url);
          return this.formatBrowseResult(result);
        },
      }),

      search_news: tool({
        description:
          'Search for news articles on a specific topic. Returns headlines, descriptions, and URLs.',
        parameters: SearchNewsParamsSchema,
        execute: async ({ query, language, country }) => {
          this.sendStatus(`Searching news for: ${query}`);
          const result = await this.googleNewsService.searchNews(query, {
            language,
            country,
          });
          return this.formatNewsResult(result);
        },
      }),

      get_top_headlines: tool({
        description:
          'Get the latest top news headlines. Optionally filter by category like technology, business, or sports.',
        parameters: GetTopHeadlinesParamsSchema,
        execute: async ({ category, language, country }) => {
          this.sendStatus(`Getting top headlines${category ? ` for ${category}` : ''}`);
          const result = await this.googleNewsService.getTopHeadlines(category, {
            language,
            country,
          });
          return this.formatHeadlinesResult(result);
        },
      }),

      take_screenshot: tool({
        description: 'Take a screenshot of a web page. Returns a base64 encoded image.',
        parameters: TakeScreenshotParamsSchema,
        execute: async ({ url }) => {
          this.sendStatus(`Taking screenshot of: ${url}`);
          const result = await this.playwrightService.takeScreenshot(url);
          if (result.error) {
            return {
              success: false,
              error: result.error,
              summary: `Failed to take screenshot: ${result.error}`,
            };
          }
          return {
            success: true,
            data: { screenshot: result.screenshot.substring(0, 100) + '...' },
            summary: `Screenshot taken successfully`,
          };
        },
      }),

      create_subtask: tool({
        description:
          'Create a subtask and delegate it to a sub-agent. Use this to break down complex tasks into smaller, manageable pieces.',
        parameters: CreateSubtaskParamsSchema,
        execute: async ({ task, context }) => {
          this.sendStatus(`Creating subtask: ${task}`);
          if (this.subtaskCallback) {
            try {
              const result = await this.subtaskCallback(task, context);
              return {
                success: true,
                data: { result },
                summary: `Subtask completed: ${task}`,
              };
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                summary: `Subtask failed: ${task}`,
              };
            }
          }
          return {
            success: false,
            error: 'Subtask execution not available',
            summary: 'Could not execute subtask',
          };
        },
      }),

      complete_task: tool({
        description:
          'Mark the current task as complete and provide the final result. Use this when you have finished addressing the user\'s request.',
        parameters: CompleteTaskParamsSchema,
        execute: async ({ summary, result }) => {
          this.sendStatus('Task completed');
          return {
            success: true,
            data: { summary, result },
            summary,
            isComplete: true,
          };
        },
      }),

      send_status: tool({
        description:
          'Send a status message to the user. Use this to keep the user informed about what you are doing.',
        parameters: SendStatusParamsSchema,
        execute: async ({ message }) => {
          this.sendStatus(message);
          return {
            success: true,
            summary: `Status sent: ${message}`,
          };
        },
      }),
    };
  }

  private formatBrowseResult(result: BrowseResult): ToolResult {
    if (result.error) {
      return {
        success: false,
        error: result.error,
        summary: `Failed to browse URL: ${result.error}`,
      };
    }

    const linksPreview = result.links.slice(0, 10).map((l) => `- ${l.text}: ${l.href}`).join('\n');

    return {
      success: true,
      data: {
        title: result.title,
        content: result.content.substring(0, 5000),
        linkCount: result.links.length,
        imageCount: result.images.length,
        sampleLinks: result.links.slice(0, 10),
      },
      summary: `Successfully browsed "${result.title}". Found ${result.content.length} characters of content, ${result.links.length} links, and ${result.images.length} images.`,
    };
  }

  private formatNewsResult(result: NewsSearchResult): ToolResult {
    if (result.error) {
      return {
        success: false,
        error: result.error,
        summary: `Failed to search news: ${result.error}`,
      };
    }

    return {
      success: true,
      data: {
        query: result.query,
        articleCount: result.articles.length,
        articles: result.articles.slice(0, 10).map((a) => ({
          title: a.title,
          description: a.description?.substring(0, 200),
          url: a.url,
          source: a.source,
          publishedAt: a.publishedAt,
        })),
      },
      summary: `Found ${result.articles.length} news articles for "${result.query}"`,
    };
  }

  private formatHeadlinesResult(result: TopHeadlinesResult): ToolResult {
    if (result.error) {
      return {
        success: false,
        error: result.error,
        summary: `Failed to get headlines: ${result.error}`,
      };
    }

    return {
      success: true,
      data: {
        category: result.category,
        articleCount: result.articles.length,
        articles: result.articles.slice(0, 10).map((a) => ({
          title: a.title,
          description: a.description?.substring(0, 200),
          url: a.url,
          source: a.source,
          publishedAt: a.publishedAt,
        })),
      },
      summary: `Found ${result.articles.length} top headlines for category "${result.category}"`,
    };
  }
}
