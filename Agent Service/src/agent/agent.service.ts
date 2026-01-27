import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { OllamaService } from '../llm/ollama.service';
import { ToolParserService } from '../tools/tool-parser.service';
import { ToolExecutorService, ToolExecutionContext, ToolExecutionResult } from '../tools/tool-executor.service';
import { DatabaseService } from '../database/database.service';
import { AnalyticsService } from '../settings/analytics.service';
import { SettingsService } from '../settings/settings.service';
import {
  AgentMessage,
  ChatRequest,
  SSEEvent,
} from './schemas';
import {
  conversations,
  messages,
  agentExecutions,
  users,
} from '../database/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * System prompt that instructs the LLM how to use tools via JSON output
 */
const SYSTEM_PROMPT = `You are an AI assistant that uses tools to help users.

TOOLS AVAILABLE:
{TOOL_DESCRIPTIONS}

HOW TO USE TOOLS:
Output exactly ONE tool call as JSON:
\`\`\`json
{"tool": "TOOL_NAME", "arguments": {"key": "value"}}
\`\`\`

IMPORTANT RULES:
1. Output ONLY ONE tool call per response
2. After each tool call, STOP and wait for results
3. When you have the data you need, use complete_task to finish

EXAMPLE:
User asks: "Check my email"
You respond with ONLY:
\`\`\`json
{"tool": "get_gmail_messages", "arguments": {"maxResults": 5}}
\`\`\`
Then STOP. Wait for results.

When you receive results, respond with:
\`\`\`json
{"tool": "complete_task", "arguments": {"summary": "Checked email", "result": "Here are your emails:\\n\\n[list actual emails from results]"}}
\`\`\`

NEVER:
- Call multiple tools in one response
- Make up or guess data
- Call complete_task before receiving tool results`;


// Helper to strip <think> tags from model output
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

interface AgentExecutionContext {
  conversationId: string;
  userId: string;
  parentExecutionId?: string;
  isSubAgent: boolean;
  maxIterations: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly eventEmitters: Map<string, EventEmitter> = new Map();

  constructor(
    private ollamaService: OllamaService,
    private toolParserService: ToolParserService,
    private toolExecutorService: ToolExecutorService,
    private databaseService: DatabaseService,
    private analyticsService: AnalyticsService,
    private settingsService: SettingsService,
  ) {}

  async processChat(request: ChatRequest, authToken?: string): Promise<{ conversationId: string; emitter: EventEmitter }> {
    const db = this.databaseService.getDb();
    const emitter = new EventEmitter();

    // Ensure user exists or create
    await this.ensureUserExists(request.userId);

    // Get or create conversation
    let conversationId = request.conversationId;
    if (!conversationId) {
      const [newConversation] = await db
        .insert(conversations)
        .values({
          userId: request.userId,
          title: request.prompt.substring(0, 100),
          status: 'active',
        })
        .returning();
      conversationId = newConversation.id;
    }

    this.eventEmitters.set(conversationId, emitter);

    // Store user message
    await db.insert(messages).values({
      conversationId,
      role: 'user',
      content: request.prompt,
    });

    // Start agent execution asynchronously
    this.runAgent({
      conversationId,
      userId: request.userId,
      isSubAgent: false,
      maxIterations: 10,
    }, request.prompt, emitter, authToken).catch((error) => {
      this.logger.error(`Agent execution error: ${error}`);
      this.emitEvent(emitter, {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    });

    return { conversationId, emitter };
  }

  /**
   * Main agent loop using text-based tool parsing (like TrackingAgent)
   */
  private async runAgent(
    context: AgentExecutionContext,
    prompt: string,
    emitter: EventEmitter,
    authToken?: string,
  ): Promise<string> {
    const db = this.databaseService.getDb();

    // Create execution record
    const [execution] = await db
      .insert(agentExecutions)
      .values({
        conversationId: context.conversationId,
        parentExecutionId: context.parentExecutionId,
        agentType: context.isSubAgent ? 'sub' : 'main',
        status: 'running',
        prompt,
      })
      .returning();

    // Get conversation history
    const history = await this.getConversationHistory(context.conversationId);

    // Build system prompt with tool descriptions
    const toolDescriptions = this.toolExecutorService.getToolDescriptions();
    const systemPrompt = SYSTEM_PROMPT.replace('{TOOL_DESCRIPTIONS}', toolDescriptions);

    // Build initial messages
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      { role: 'user', content: prompt },
    ];

    // Tool execution context
    const toolContext: ToolExecutionContext = {
      userId: context.userId,
      authToken,
      onStatus: (message) => {
        this.emitEvent(emitter, {
          type: 'status',
          message,
          timestamp: new Date().toISOString(),
        });
      },
    };

    this.emitEvent(emitter, {
      type: 'status',
      message: 'Thinking...',
      timestamp: new Date().toISOString(),
    });

    // Get the current model from settings
    const modelName = await this.settingsService.getDefaultModel();
    let totalLlmTimeMs = 0;
    let iterations = 0;
    let finalResult = '';
    let isComplete = false;
    const toolCallHistory: Array<{ name: string; args: Record<string, unknown>; result: unknown; duration: number }> = [];

    try {
      while (!isComplete && iterations < context.maxIterations) {
        iterations++;
        this.logger.debug(`Agent iteration ${iterations}/${context.maxIterations}`);

        // Generate response using raw chat
        const llmStartTime = Date.now();
        const response = await this.ollamaService.rawChat({
          model: modelName,
          messages: chatMessages,
          temperature: 0.7,
        });
        const llmDuration = Date.now() - llmStartTime;
        totalLlmTimeMs += llmDuration;

        // Record analytics
        await this.analyticsService.recordAnalytics({
          modelName,
          executionId: execution.id,
          userId: context.userId,
          responseTimeMs: llmDuration,
          success: true,
        });

        const llmContent = stripThinkTags(response.content);
        this.logger.debug(`LLM response (${llmContent.length} chars): ${llmContent.substring(0, 200)}...`);

        // Parse tool calls from the response
        const parseResult = this.toolParserService.parseToolCalls(llmContent);
        
        if (parseResult.toolCalls.length > 0) {
          // STRICT: Only execute the FIRST tool call, ignore the rest
          // This enforces the "one tool at a time" rule
          const toolsToExecute = [parseResult.toolCalls[0]];
          
          if (parseResult.toolCalls.length > 1) {
            this.logger.debug(`Model output ${parseResult.toolCalls.length} tools, executing only first: ${toolsToExecute[0].name}`);
          }
          
          this.logger.debug(`Executing tool: ${toolsToExecute[0].name}`);
          
          // Emit any text before tools
          if (parseResult.textBeforeTools) {
            this.emitEvent(emitter, {
              type: 'content',
              content: parseResult.textBeforeTools,
              timestamp: new Date().toISOString(),
            });
          }

          // Execute tool calls in order
          const toolResults: Array<{ call: typeof parseResult.toolCalls[0]; result: ToolExecutionResult }> = [];
          
          for (const toolCall of toolsToExecute) {
            this.emitEvent(emitter, {
              type: 'tool_start',
              toolName: toolCall.name,
              toolArgs: toolCall.arguments,
              timestamp: new Date().toISOString(),
            });

            const toolStartTime = Date.now();
            const result = await this.toolExecutorService.executeTool(toolCall, toolContext);
            const toolDuration = Date.now() - toolStartTime;
            
            toolResults.push({ call: toolCall, result });
            toolCallHistory.push({
              name: toolCall.name,
              args: toolCall.arguments,
              result: result.data || result.summary,
              duration: toolDuration,
            });

            this.emitEvent(emitter, {
              type: 'tool_result',
              toolName: toolCall.name,
              result,
              summary: result.summary,
              timestamp: new Date().toISOString(),
            });

            // Check if task is complete
            if (result.isComplete) {
              isComplete = true;
              finalResult = result.finalResult || result.summary;
              
              // Emit the final content
              this.emitEvent(emitter, {
                type: 'content',
                content: finalResult,
                timestamp: new Date().toISOString(),
              });
              break;
            }
          }

          // If not complete, build context message with tool results and continue
          if (!isComplete) {
            // Add assistant's response
            chatMessages.push({
              role: 'assistant',
              content: llmContent,
            });

            // Build tool results context
            const toolResultsText = toolResults.map((tr, i) => {
              const resultJson = JSON.stringify(tr.result.data || tr.result.summary, null, 2);
              return `[Tool ${i + 1}] ${tr.call.name}\nResult:\n\`\`\`json\n${resultJson}\n\`\`\``;
            }).join('\n\n');

            // Add context message
            chatMessages.push({
              role: 'user',
              content: `TOOL EXECUTION RESULTS:\n\n${toolResultsText}\n\nContinue working toward the user's goal. Use more tools if needed, or provide the final answer using complete_task.`,
            });
          }
        } else {
          // No tool calls - this is the final response
          this.logger.debug('No tool calls found, treating as final response');
          finalResult = llmContent;
          
          this.emitEvent(emitter, {
            type: 'content',
            content: finalResult,
            timestamp: new Date().toISOString(),
          });
          
          isComplete = true;
        }
      }

      if (!isComplete) {
        finalResult = 'Agent reached maximum iterations without completing the task.';
        this.emitEvent(emitter, {
          type: 'content',
          content: finalResult,
          timestamp: new Date().toISOString(),
        });
      }

      // Store assistant message
      const [savedMessage] = await db
        .insert(messages)
        .values({
          conversationId: context.conversationId,
          role: 'assistant',
          content: finalResult,
          metadata: { toolCalls: toolCallHistory },
        })
        .returning();

      // Update execution record
      await db
        .update(agentExecutions)
        .set({
          status: 'completed',
          result: finalResult,
          summary: context.isSubAgent
            ? this.summarizeExecution(prompt, finalResult)
            : undefined,
          toolCalls: toolCallHistory,
          completedAt: new Date(),
        })
        .where(eq(agentExecutions.id, execution.id));

      // Emit completion
      this.emitEvent(emitter, {
        type: 'complete',
        conversationId: context.conversationId,
        messageId: savedMessage.id,
        finalContent: finalResult,
        timestamp: new Date().toISOString(),
      });

      return finalResult;
    } catch (error) {
      // Record failed analytics
      await this.analyticsService.recordAnalytics({
        modelName,
        executionId: execution.id,
        userId: context.userId,
        responseTimeMs: totalLlmTimeMs,
        success: false,
        errorType: error instanceof Error ? error.name : 'Unknown',
      });

      // Update execution as failed
      await db
        .update(agentExecutions)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        })
        .where(eq(agentExecutions.id, execution.id));

      throw error;
    }
  }

  /**
   * Create a new conversation (for scheduled tasks)
   */
  async createConversation(userId: string, title: string): Promise<{ id: string }> {
    await this.ensureUserExists(userId);
    const db = this.databaseService.getDb();
    
    const [conversation] = await db
      .insert(conversations)
      .values({
        userId,
        title,
        status: 'active',
      })
      .returning();
    
    return { id: conversation.id };
  }

  /**
   * Run agent with a prompt synchronously (for scheduled tasks)
   * Returns the result directly instead of streaming
   */
  async runAgentTask(
    conversationId: string,
    prompt: string,
    userId: string,
  ): Promise<{ response: string; conversationId: string }> {
    const db = this.databaseService.getDb();
    const emitter = new EventEmitter();
    
    // Store user message
    await db.insert(messages).values({
      conversationId,
      role: 'user',
      content: prompt,
    });

    // Run agent and wait for completion
    const result = await this.runAgent(
      {
        conversationId,
        userId,
        isSubAgent: false,
        maxIterations: 10,
      },
      prompt,
      emitter,
    );

    return {
      response: result,
      conversationId,
    };
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const db = this.databaseService.getDb();
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(users).values({
        id: userId,
        email: `${userId}@external.service`,
      });
    }
  }

  private async getConversationHistory(
    conversationId: string,
  ): Promise<AgentMessage[]> {
    const db = this.databaseService.getDb();
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(20);

    return history.reverse().map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system' | 'tool',
      content: m.content,
      toolName: m.toolName || undefined,
      toolCallId: m.toolCallId || undefined,
      metadata: m.metadata || undefined,
    }));
  }

  private summarizeExecution(task: string, result: string): string {
    const maxLength = 200;
    const summary = `Task: ${task.substring(0, 100)}. Result: ${result.substring(0, maxLength)}`;
    return summary.length > maxLength ? summary.substring(0, maxLength) + '...' : summary;
  }

  private emitEvent(emitter: EventEmitter, event: SSEEvent) {
    this.logger.debug(`Emitting event: ${event.type}`);
    emitter.emit('event', event);
  }

  getEventEmitter(conversationId: string): EventEmitter | undefined {
    return this.eventEmitters.get(conversationId);
  }

  removeEventEmitter(conversationId: string): void {
    this.eventEmitters.delete(conversationId);
  }
}
