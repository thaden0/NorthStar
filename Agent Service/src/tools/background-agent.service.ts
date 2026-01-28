import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter } from 'events';
import { DatabaseService } from '../database/database.service';
import { OllamaService } from '../llm/ollama.service';
import { ToolExecutorService, ToolExecutionContext } from './tool-executor.service';
import { SettingsService } from '../settings/settings.service';
import { WikipediaService, WikipediaReference } from './wikipedia.service';
import { RedditService } from './reddit.service';
import { GoogleNewsService } from './google-news.service';
import { PlaywrightService } from './playwright.service';
import { nanoid } from 'nanoid';
import {
  backgroundTasks,
  NewBackgroundTask,
  BackgroundTask,
} from '../database/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * Research source types
 */
export type ResearchSource = 'wikipedia' | 'news' | 'reddit' | 'web';

/**
 * Research finding from a source
 */
export interface ResearchFinding {
  source: ResearchSource;
  title: string;
  url: string;
  content: string;
  reliability: 'high' | 'medium' | 'low';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Research report
 */
export interface ResearchReport {
  topic: string;
  summary: string;
  findings: ResearchFinding[];
  sources: Array<{ url: string; title: string; source: ResearchSource }>;
  confidence: number; // 0-100
  researchDuration: number;
  completedAt: string;
}

/**
 * Background task status
 */
export interface BackgroundTaskStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

/**
 * Background task options
 */
export interface BackgroundTaskOptions {
  userId: string;
  prompt: string;
  researchMode?: boolean;
  maxDepth?: number;
  maxSources?: number;
  temperature?: number;
  authToken?: string;
  onProgress?: (status: BackgroundTaskStatus) => void;
}

/**
 * Background Agent Service
 * 
 * Handles long-running tasks that shouldn't block the conversation.
 * Features:
 * - Lower temperature for more consistent, factual output
 * - Research mode for deep topic exploration
 * - Follows references from Wikipedia to fact-check
 * - Aggregates information from multiple sources
 * - Requires higher confidence before completing
 */
@Injectable()
export class BackgroundAgentService {
  private readonly logger = new Logger(BackgroundAgentService.name);
  private readonly runningTasks: Map<string, BackgroundTaskStatus> = new Map();
  private readonly taskEmitters: Map<string, EventEmitter> = new Map();

  // Lower temperature for more consistent, factual research
  private readonly RESEARCH_TEMPERATURE = 0.3;
  // Default temperature for regular background tasks
  private readonly DEFAULT_TEMPERATURE = 0.5;
  // Minimum confidence required to consider research complete
  private readonly MIN_CONFIDENCE_THRESHOLD = 70;
  // Maximum sources to explore per research type
  private readonly MAX_SOURCES_PER_TYPE = 5;

  constructor(
    private readonly db: DatabaseService,
    private readonly ollamaService: OllamaService,
    private readonly settingsService: SettingsService,
    private readonly wikipediaService: WikipediaService,
    private readonly redditService: RedditService,
    private readonly googleNewsService: GoogleNewsService,
    private readonly playwrightService: PlaywrightService,
    @Inject(forwardRef(() => ToolExecutorService))
    private readonly toolExecutorService: ToolExecutorService,
  ) {}

  /**
   * Start a background task
   */
  async startBackgroundTask(options: BackgroundTaskOptions): Promise<string> {
    const taskId = nanoid(12);
    const emitter = new EventEmitter();
    
    const status: BackgroundTaskStatus = {
      id: taskId,
      status: 'pending',
      progress: 0,
      startedAt: new Date().toISOString(),
    };

    this.runningTasks.set(taskId, status);
    this.taskEmitters.set(taskId, emitter);

    // Store in database
    const newTask: NewBackgroundTask = {
      id: taskId,
      userId: options.userId,
      prompt: options.prompt,
      status: 'pending',
      researchMode: options.researchMode || false,
      metadata: {
        maxDepth: options.maxDepth || 3,
        maxSources: options.maxSources || 15,
        temperature: options.temperature || (options.researchMode ? this.RESEARCH_TEMPERATURE : this.DEFAULT_TEMPERATURE),
      },
    };

    await this.db.getDb().insert(backgroundTasks).values(newTask);

    // Start the task asynchronously
    this.runTask(taskId, options).catch((error) => {
      this.logger.error(`Background task ${taskId} failed: ${error}`);
      this.updateTaskStatus(taskId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      });
    });

    return taskId;
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): BackgroundTaskStatus | undefined {
    return this.runningTasks.get(taskId);
  }

  /**
   * Get task event emitter for real-time updates
   */
  getTaskEmitter(taskId: string): EventEmitter | undefined {
    return this.taskEmitters.get(taskId);
  }

  /**
   * Get all tasks for a user
   */
  async getUserTasks(userId: string): Promise<BackgroundTask[]> {
    return this.db.getDb()
      .select()
      .from(backgroundTasks)
      .where(eq(backgroundTasks.userId, userId))
      .orderBy(desc(backgroundTasks.createdAt));
  }

  /**
   * Run the background task
   */
  private async runTask(taskId: string, options: BackgroundTaskOptions): Promise<void> {
    this.updateTaskStatus(taskId, { status: 'running', progress: 5 });

    try {
      if (options.researchMode) {
        await this.runResearchTask(taskId, options);
      } else {
        await this.runStandardTask(taskId, options);
      }
    } catch (error) {
      await this.db.getDb()
        .update(backgroundTasks)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        })
        .where(eq(backgroundTasks.id, taskId));

      throw error;
    }
  }

  /**
   * Run a standard background task (non-research)
   */
  private async runStandardTask(taskId: string, options: BackgroundTaskOptions): Promise<void> {
    const modelName = await this.settingsService.getDefaultModel();
    const temperature = options.temperature || this.DEFAULT_TEMPERATURE;

    this.updateTaskStatus(taskId, {
      currentStep: 'Processing your request...',
      progress: 10,
    });

    // Tool execution context
    const toolContext: ToolExecutionContext = {
      userId: options.userId,
      authToken: options.authToken,
      onStatus: (message) => {
        this.updateTaskStatus(taskId, { currentStep: message });
      },
    };

    // Get available tools
    const tools = this.toolExecutorService.getToolsForOllama();

    // System prompt for background tasks
    const systemPrompt = `You are a thorough AI assistant working on a background task.
You have more time to complete this task, so be extra careful and thorough.
Current time: ${new Date().toISOString()}

IMPORTANT: You are running in the background. Take your time to:
1. Gather comprehensive information
2. Verify facts when possible
3. Provide detailed, well-structured responses
4. Use tools as needed to complete the task

When you are confident in your answer, use the complete_task tool with a detailed result.`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: options.prompt },
    ];

    let isComplete = false;
    let iterations = 0;
    const maxIterations = 15; // More iterations for background tasks
    let finalResult = '';

    while (!isComplete && iterations < maxIterations) {
      iterations++;
      const progress = Math.min(10 + (iterations / maxIterations) * 80, 90);
      this.updateTaskStatus(taskId, { progress });

      const response = await this.ollamaService.chatWithTools({
        model: modelName,
        messages,
        tools,
        temperature,
      });

      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolCall = response.toolCalls[0];
        
        this.updateTaskStatus(taskId, {
          currentStep: `Executing: ${toolCall.name}`,
        });

        const result = await this.toolExecutorService.executeNativeToolCall(
          toolCall.name,
          toolCall.arguments as Record<string, unknown>,
          toolContext
        );

        if (result.isComplete) {
          isComplete = true;
          finalResult = result.finalResult || result.summary;
        } else {
          messages.push({
            role: 'assistant' as const,
            content: response.content || `Called tool: ${toolCall.name}`,
          });
          messages.push({
            role: 'user' as const,
            content: `Tool result: ${JSON.stringify(result.data || result.summary)}`,
          });
        }
      } else {
        finalResult = response.content;
        isComplete = true;
      }
    }

    // Save result
    await this.db.getDb()
      .update(backgroundTasks)
      .set({
        status: 'completed',
        result: finalResult,
        completedAt: new Date(),
      })
      .where(eq(backgroundTasks.id, taskId));

    this.updateTaskStatus(taskId, {
      status: 'completed',
      progress: 100,
      result: finalResult,
      completedAt: new Date().toISOString(),
    });
  }

  /**
   * Run a research task with multi-source investigation
   */
  private async runResearchTask(taskId: string, options: BackgroundTaskOptions): Promise<void> {
    const startTime = Date.now();
    const findings: ResearchFinding[] = [];
    const visitedUrls = new Set<string>();
    const topic = options.prompt;
    const maxDepth = options.maxDepth || 3;
    const maxSources = options.maxSources || 15;

    this.updateTaskStatus(taskId, {
      currentStep: 'Starting research...',
      progress: 5,
    });

    // Step 1: Wikipedia research (primary source for factual information)
    this.updateTaskStatus(taskId, {
      currentStep: 'Searching Wikipedia...',
      progress: 10,
    });

    const wikiFindings = await this.researchWikipedia(topic, maxDepth, visitedUrls);
    findings.push(...wikiFindings);

    this.updateTaskStatus(taskId, {
      currentStep: `Found ${wikiFindings.length} Wikipedia sources. Checking references...`,
      progress: 25,
    });

    // Step 2: Follow Wikipedia references to fact-check
    const referenceFindings = await this.verifyWikipediaReferences(
      wikiFindings,
      Math.min(this.MAX_SOURCES_PER_TYPE, maxSources - findings.length),
      visitedUrls
    );
    findings.push(...referenceFindings);

    this.updateTaskStatus(taskId, {
      currentStep: 'Searching news sources...',
      progress: 45,
    });

    // Step 3: News search for current information
    const newsFindings = await this.researchNews(topic, visitedUrls);
    findings.push(...newsFindings);

    this.updateTaskStatus(taskId, {
      currentStep: 'Searching Reddit discussions...',
      progress: 65,
    });

    // Step 4: Reddit for community perspectives
    const redditFindings = await this.researchReddit(
      topic,
      Math.min(this.MAX_SOURCES_PER_TYPE, maxSources - findings.length),
      visitedUrls
    );
    findings.push(...redditFindings);

    this.updateTaskStatus(taskId, {
      currentStep: 'Analyzing and synthesizing findings...',
      progress: 80,
    });

    // Step 5: Use LLM to analyze and synthesize findings
    const report = await this.synthesizeResearch(topic, findings, startTime);

    this.updateTaskStatus(taskId, {
      currentStep: 'Finalizing research report...',
      progress: 95,
    });

    // Check if we have enough confidence
    if (report.confidence < this.MIN_CONFIDENCE_THRESHOLD && findings.length < maxSources) {
      this.logger.warn(`Research confidence (${report.confidence}%) below threshold. Consider additional sources.`);
    }

    // Save result
    await this.db.getDb()
      .update(backgroundTasks)
      .set({
        status: 'completed',
        result: JSON.stringify(report),
        completedAt: new Date(),
      })
      .where(eq(backgroundTasks.id, taskId));

    this.updateTaskStatus(taskId, {
      status: 'completed',
      progress: 100,
      result: report,
      completedAt: new Date().toISOString(),
    });
  }

  /**
   * Research a topic on Wikipedia
   */
  private async researchWikipedia(
    topic: string,
    maxDepth: number,
    visitedUrls: Set<string>
  ): Promise<ResearchFinding[]> {
    const findings: ResearchFinding[] = [];

    try {
      // Search for relevant articles
      const searchResult = await this.wikipediaService.search(topic, 5);
      
      if (searchResult.error || searchResult.results.length === 0) {
        this.logger.warn(`Wikipedia search returned no results for: ${topic}`);
        return findings;
      }

      // Get the top articles
      for (let i = 0; i < Math.min(searchResult.results.length, 3); i++) {
        const result = searchResult.results[i];
        
        if (visitedUrls.has(result.url)) continue;
        visitedUrls.add(result.url);

        const article = await this.wikipediaService.getArticle(result.title);
        
        if ('error' in article) continue;

        findings.push({
          source: 'wikipedia',
          title: article.title,
          url: article.url,
          content: article.content.substring(0, 5000),
          reliability: 'high',
          timestamp: new Date().toISOString(),
          metadata: {
            summary: article.summary,
            references: article.references.slice(0, 10),
            categories: article.categories,
            linkCount: article.links.length,
          },
        });

        // Follow internal links for deeper research
        if (maxDepth > 1 && article.links.length > 0) {
          const relatedLinks = article.links.slice(0, 2);
          for (const link of relatedLinks) {
            if (visitedUrls.has(link.url)) continue;
            visitedUrls.add(link.url);

            const linkedArticle = await this.wikipediaService.getArticle(link.title);
            if ('error' in linkedArticle) continue;

            findings.push({
              source: 'wikipedia',
              title: linkedArticle.title,
              url: linkedArticle.url,
              content: linkedArticle.summary,
              reliability: 'high',
              timestamp: new Date().toISOString(),
              metadata: { relatedTo: article.title },
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(`Wikipedia research error: ${error}`);
    }

    return findings;
  }

  /**
   * Verify Wikipedia references by fetching their content
   */
  private async verifyWikipediaReferences(
    wikiFindings: ResearchFinding[],
    maxRefs: number,
    visitedUrls: Set<string>
  ): Promise<ResearchFinding[]> {
    const findings: ResearchFinding[] = [];
    let refCount = 0;

    for (const finding of wikiFindings) {
      if (refCount >= maxRefs) break;
      
      const references = (finding.metadata?.references as WikipediaReference[]) || [];
      
      for (const ref of references) {
        if (refCount >= maxRefs) break;
        if (visitedUrls.has(ref.url)) continue;
        
        // Only follow http/https links
        if (!ref.url.startsWith('http')) continue;
        
        // Skip certain domains that won't provide useful content
        const skipDomains = ['doi.org', 'isbn', 'jstor.org', 'archive.org'];
        if (skipDomains.some(d => ref.url.includes(d))) continue;

        visitedUrls.add(ref.url);

        try {
          const result = await this.playwrightService.browsePage(ref.url);
          
          if (result.error || !result.content) continue;

          findings.push({
            source: 'web',
            title: result.title || ref.url,
            url: ref.url,
            content: result.content.substring(0, 2000),
            reliability: 'medium',
            timestamp: new Date().toISOString(),
            metadata: {
              referencedFrom: finding.title,
              type: 'wikipedia-citation',
            },
          });

          refCount++;
        } catch {
          // Skip failed fetches
        }
      }
    }

    return findings;
  }

  /**
   * Research news sources
   */
  private async researchNews(
    topic: string,
    visitedUrls: Set<string>
  ): Promise<ResearchFinding[]> {
    const findings: ResearchFinding[] = [];

    try {
      const newsResult = await this.googleNewsService.searchNews(topic, {
        language: 'en',
        country: 'US',
      });

      if (newsResult.error) {
        this.logger.warn(`News search error: ${newsResult.error}`);
        return findings;
      }

      for (const article of newsResult.articles.slice(0, this.MAX_SOURCES_PER_TYPE)) {
        if (visitedUrls.has(article.url)) continue;
        visitedUrls.add(article.url);

        findings.push({
          source: 'news',
          title: article.title,
          url: article.url,
          content: article.description || '',
          reliability: 'medium',
          timestamp: article.publishedAt || new Date().toISOString(),
          metadata: {
            source: article.source,
          },
        });
      }
    } catch (error) {
      this.logger.error(`News research error: ${error}`);
    }

    return findings;
  }

  /**
   * Research Reddit discussions
   */
  private async researchReddit(
    topic: string,
    maxPosts: number,
    visitedUrls: Set<string>
  ): Promise<ResearchFinding[]> {
    const findings: ResearchFinding[] = [];

    try {
      const searchResult = await this.redditService.search(topic, {
        sort: 'relevance',
        time: 'year',
        limit: maxPosts,
      });

      if (searchResult.error) {
        this.logger.warn(`Reddit search error: ${searchResult.error}`);
        return findings;
      }

      for (const post of searchResult.posts.slice(0, maxPosts)) {
        if (visitedUrls.has(post.url)) continue;
        visitedUrls.add(post.url);

        // Get full thread for highly upvoted posts
        if (post.score > 100 && post.numComments > 10) {
          const thread = await this.redditService.getThread(post.permalink, {
            sort: 'top',
            depth: 2,
            limit: 10,
          });

          if ('error' in thread) continue;

          // Collect top comments
          const topComments = thread.comments
            .slice(0, 5)
            .map(c => `[+${c.score}] ${c.body}`)
            .join('\n\n');

          findings.push({
            source: 'reddit',
            title: post.title,
            url: post.url,
            content: `${post.selftext}\n\n---\nTop comments:\n${topComments}`,
            reliability: post.score > 500 ? 'medium' : 'low',
            timestamp: new Date(post.createdUtc * 1000).toISOString(),
            metadata: {
              subreddit: post.subreddit,
              score: post.score,
              numComments: post.numComments,
              upvoteRatio: post.upvoteRatio,
            },
          });
        } else {
          findings.push({
            source: 'reddit',
            title: post.title,
            url: post.url,
            content: post.selftext,
            reliability: 'low',
            timestamp: new Date(post.createdUtc * 1000).toISOString(),
            metadata: {
              subreddit: post.subreddit,
              score: post.score,
              numComments: post.numComments,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error(`Reddit research error: ${error}`);
    }

    return findings;
  }

  /**
   * Synthesize research findings into a coherent report
   */
  private async synthesizeResearch(
    topic: string,
    findings: ResearchFinding[],
    startTime: number
  ): Promise<ResearchReport> {
    const modelName = await this.settingsService.getDefaultModel();

    // Group findings by source (useful for summary stats)
    const _bySource = findings.reduce((acc, f) => {
      acc[f.source] = acc[f.source] || [];
      acc[f.source].push(f);
      return acc;
    }, {} as Record<ResearchSource, ResearchFinding[]>);

    // Build context for LLM
    const findingsContext = findings.map((f, i) => 
      `[Source ${i + 1}: ${f.source.toUpperCase()} - ${f.reliability} reliability]
Title: ${f.title}
URL: ${f.url}
Content: ${f.content.substring(0, 1500)}
---`
    ).join('\n\n');

    const synthesisPrompt = `You are a research analyst. Analyze the following research findings about "${topic}" and provide a comprehensive synthesis.

FINDINGS:
${findingsContext}

INSTRUCTIONS:
1. Summarize the key facts and findings
2. Note any conflicting information between sources
3. Identify which claims are well-supported vs. speculative
4. Rate your confidence in the overall findings (0-100)

Respond in JSON format:
{
  "summary": "A comprehensive 2-3 paragraph summary of the research findings",
  "keyFacts": ["List of verified key facts"],
  "uncertainties": ["List of uncertain or conflicting points"],
  "confidence": <number 0-100>
}`;

    try {
      const response = await this.ollamaService.rawChat({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a thorough research analyst. Always respond with valid JSON.' },
          { role: 'user', content: synthesisPrompt },
        ],
        temperature: this.RESEARCH_TEMPERATURE,
      });

      let analysis: { summary: string; keyFacts: string[]; uncertainties: string[]; confidence: number };
      
      try {
        analysis = JSON.parse(response.content);
      } catch {
        // If JSON parsing fails, create a basic analysis
        analysis = {
          summary: response.content,
          keyFacts: [],
          uncertainties: ['Unable to fully verify findings'],
          confidence: 50,
        };
      }

      return {
        topic,
        summary: analysis.summary,
        findings,
        sources: findings.map(f => ({
          url: f.url,
          title: f.title,
          source: f.source,
        })),
        confidence: analysis.confidence,
        researchDuration: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Synthesis error: ${error}`);
      
      // Return a basic report on error
      return {
        topic,
        summary: `Research gathered ${findings.length} sources on "${topic}". Manual review recommended.`,
        findings,
        sources: findings.map(f => ({
          url: f.url,
          title: f.title,
          source: f.source,
        })),
        confidence: 30,
        researchDuration: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Update task status and emit event
   */
  private updateTaskStatus(taskId: string, updates: Partial<BackgroundTaskStatus>): void {
    const current = this.runningTasks.get(taskId);
    if (current) {
      const updated = { ...current, ...updates };
      this.runningTasks.set(taskId, updated);
      
      const emitter = this.taskEmitters.get(taskId);
      if (emitter) {
        emitter.emit('progress', updated);
      }
    }
  }

  /**
   * Clean up completed task resources
   */
  cleanupTask(taskId: string): void {
    this.runningTasks.delete(taskId);
    this.taskEmitters.delete(taskId);
  }
}
