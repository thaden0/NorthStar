import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { OllamaService } from '../llm/ollama.service';
import { ToolParserService } from '../tools/tool-parser.service';
import { ToolExecutorService, ToolExecutionContext } from '../tools/tool-executor.service';
import { DatabaseService } from '../database/database.service';
import { AnalyticsService } from '../settings/analytics.service';
import { SettingsService } from '../settings/settings.service';
import { MemoryToolsService } from '../memory/memory-tools.service';
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
 * System prompt for native tool calling
 * Ollama handles the tool call format, we just guide the decision-making
 */
const SYSTEM_PROMPT = `You are an AI assistant with access to tools. Current time: {CURRENT_TIME}
{USER_AI_INSTRUCTIONS}
CRITICAL RULES:
1. If the user mentions ANY future time like "at 5pm", "tomorrow", "at 12:25am", "every Friday", "remind me" - you MUST use schedule_task. Do NOT answer directly.
2. After successfully using schedule_task, immediately use complete_task to confirm the scheduling to the user.
3. For scheduling, use ISO datetime format: YYYY-MM-DDTHH:MM:SS (e.g., {EXAMPLE_DATE}T14:30:00)
4. "today at X" means today's date ({EXAMPLE_DATE}) with that time
5. For questions without a time reference, use complete_task with your answer
6. Use ONE tool per response

=== MEMORY SYSTEM ===
You have a PERSISTENT MEMORY system. Use it actively to provide personalized assistance!

AVAILABLE MEMORY TOOLS:
- save_memory: Store important information (preferences, events, goals, people)
- search_memories: Find relevant past information semantically
- update_memory: Modify existing memories
- delete_memory: Remove outdated memories

WHEN TO SAVE MEMORIES:
- User mentions future events → save_memory with eventDate + relevanceDaysBefore
- User shares preferences/habits → save_memory to remember later
- User sets goals or intentions → save_memory with tags: [goals]
- User mentions people → save_memory with tags: [people]
- Important dates (birthdays, deadlines) → save_memory with eventDate

MEMORY EXAMPLES:
1. User: "My mom's birthday is March 15th"
   → save_memory(content: "User's mother's birthday is March 15th", tags: ["people", "events"], eventDate: "2026-03-15", relevanceDaysBefore: 7)

2. User: "I have a job interview next Tuesday at 2pm"
   → save_memory(content: "Job interview scheduled", tags: ["events", "work"], eventDate: "2026-01-28", relevanceDaysBefore: 1, priority: 9)

3. User: "I'm trying to eat less sugar"
   → save_memory(content: "User is trying to reduce sugar intake", tags: ["health", "goals", "food"])

IMPORTANT: Memory operations are processed but NOT shown in your response. Just use the tool and respond naturally.

=== GOOGLE INTEGRATION ===
{GOOGLE_STATUS}

WHEN GOOGLE TOOLS ARE AVAILABLE:
- send_email: Compose and send emails (user sees a preview widget to confirm/cancel)
- read_email: Read emails (displays beautifully in widget)
- search_emails: Search inbox by query
- create_calendar_event: Add calendar events (shows widget with surrounding events)
- update_calendar_event: Modify existing events
- delete_calendar_event: Remove events
- lookup_contact: Search Google Contacts by name or email

PEOPLE LOOKUP BEHAVIOR:
When users mention people by name:
1. Use lookup_contact to check if they're in the user's Google Contacts
2. If found, use their contact info to personalize your response
3. If someone is mentioned positively and frequently, and they're NOT already a contact, you may politely offer:
   "I notice you mention [Name] often. Would you like me to add them to your contacts?"
4. Never be pushy about adding contacts - only suggest once and only if contextually appropriate

WIDGET CONFIRMATION:
For emails, calendar events, and contact operations, the user will see a preview widget where they can:
- Review the details before the action completes
- Cancel if they change their mind
- Make edits before confirming

If a user cancels an action, acknowledge it gracefully and offer to help make changes.

{PROACTIVE_MEMORIES}`;



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
  aiInstructions?: string;
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
    private memoryToolsService: MemoryToolsService,
  ) {}

  async processChat(request: ChatRequest, authToken?: string, aiInstructions?: string): Promise<{ conversationId: string; emitter: EventEmitter }> {
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
      aiInstructions,
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

    // Build system prompt with current time context
    const now = new Date();
    const currentTime = now.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
    const todayDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Get proactive memories for context injection
    let proactiveMemoriesContext = '';
    try {
      proactiveMemoriesContext = await this.memoryToolsService.getProactiveContext(context.userId);
      if (proactiveMemoriesContext) {
        this.logger.debug(`Injecting ${proactiveMemoriesContext.split('\n').length} lines of proactive memory context`);
      }
    } catch (error) {
      this.logger.warn(`Could not fetch proactive memories: ${error}`);
    }
    
    // Check Google connection status (via authToken - if present, Google may be available)
    let googleStatus = 'Google services: NOT CONNECTED. Gmail, Calendar, and Contacts tools are unavailable.';
    if (authToken) {
      // User has an auth token, which means they may have Google OAuth connected
      googleStatus = `Google services: CONNECTED. You have access to Gmail, Calendar, and Contacts tools.

When using these tools:
- Email and calendar operations will show a preview widget to the user
- The user can CANCEL before the action completes
- Always include all required fields`;
    }
    
    // Build user AI instructions section
    let userAiInstructionsSection = '';
    if (context.aiInstructions) {
      userAiInstructionsSection = `\n=== USER CUSTOM INSTRUCTIONS ===\nThe user has provided the following custom instructions that you should follow:\n${context.aiInstructions}\n`;
    }
    
    const systemPrompt = SYSTEM_PROMPT
      .replace('{CURRENT_TIME}', currentTime)
      .replace(new RegExp('\\{EXAMPLE_DATE\\}', 'g'), todayDate)
      .replace('{GOOGLE_STATUS}', googleStatus)
      .replace('{PROACTIVE_MEMORIES}', proactiveMemoriesContext)
      .replace('{USER_AI_INSTRUCTIONS}', userAiInstructionsSection);

    // Get tools in Ollama format for native tool calling
    const ollamaTools = this.toolExecutorService.getToolsForOllama();

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
      onWidgetOpen: (data) => {
        this.emitEvent(emitter, {
          type: 'widget_open',
          widgetId: data.widgetId,
          widgetType: data.widgetType,
          widgetData: data.widgetData,
          canCancel: data.canCancel ?? true,
          timestamp: new Date().toISOString(),
        });
      },
      onWidgetUpdate: (widgetId, widgetData) => {
        this.emitEvent(emitter, {
          type: 'widget_update',
          widgetId,
          widgetData,
          timestamp: new Date().toISOString(),
        });
      },
      onWidgetClose: (widgetId) => {
        this.emitEvent(emitter, {
          type: 'widget_close',
          widgetId,
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

        // Generate response using native tool calling
        const llmStartTime = Date.now();
        const response = await this.ollamaService.chatWithTools({
          model: modelName,
          messages: chatMessages,
          tools: ollamaTools,
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
        this.logger.debug(`LLM response: ${llmContent.substring(0, 100)}... toolCalls: ${response.toolCalls?.length || 0}`);

        // Check for native tool calls from Ollama
        if (response.toolCalls && response.toolCalls.length > 0) {
          // Use the first tool call (enforce one at a time)
          const nativeToolCall = response.toolCalls[0];
          const toolCall = {
            name: nativeToolCall.name,
            arguments: nativeToolCall.arguments as Record<string, unknown>,
          };
          
          this.logger.debug(`Executing native tool call: ${toolCall.name}`);
          
          // Emit content if any
          if (llmContent) {
            this.emitEvent(emitter, {
              type: 'content',
              content: llmContent,
              timestamp: new Date().toISOString(),
            });
          }
        
          // Emit tool start event
          this.emitEvent(emitter, {
            type: 'tool_start',
            toolName: toolCall.name,
            toolArgs: toolCall.arguments,
            timestamp: new Date().toISOString(),
          });

          const toolStartTime = Date.now();
          const result = await this.toolExecutorService.executeNativeToolCall(toolCall.name, toolCall.arguments, toolContext);
          const toolDuration = Date.now() - toolStartTime;
          
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
          }
          if (!isComplete) {
            // Add assistant's response (include tool call info)
            chatMessages.push({
              role: 'assistant',
              content: llmContent || `Called tool: ${toolCall.name}`,
            });

            // Build tool result context
            const resultJson = JSON.stringify(result.data || result.summary, null, 2);
            const toolResultText = `Tool: ${toolCall.name}\nResult:\n\`\`\`json\n${resultJson}\n\`\`\``;

            // Add context message
            chatMessages.push({
              role: 'user',
              content: `TOOL EXECUTION RESULT:\n\n${toolResultText}\n\nContinue working toward the user's goal. Use more tools if needed, or provide the final answer using complete_task.`,
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
