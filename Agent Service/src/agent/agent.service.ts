import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import { OllamaService } from '../llm/ollama.service';
import { AgentToolsService } from './agent-tools.service';
import { DatabaseService } from '../database/database.service';
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
import { CoreMessage, ToolResultPart } from 'ai';

const SYSTEM_PROMPT = `You are an autonomous AI agent. Your job is to COMPLETE user requests, not just provide partial information.

## YOUR MISSION
When a user asks for something, treat it as a GOAL to achieve. Work systematically to fully accomplish the goal.

## CRITICAL RULES

### Rule 0: IDENTIFY THE USER'S GOAL FIRST
Before taking ANY action, you MUST:
1. Analyze the user's prompt to understand their true intent
2. Define the goal explicitly in your status update
3. Only then proceed with the appropriate tools

For example:
- User: "What is the weather like in Toronto?" → Goal: "Find the current weather in Toronto and provide it to the user."
- User: "Tell me about recent crypto news" → Goal: "Research and summarize recent cryptocurrency news for the user."
- User: "How do I make pasta?" → Goal: "Provide step-by-step instructions for making pasta."

Your first send_status should reflect this identified goal, e.g., send_status("Goal: Find the current weather in Toronto. Starting research...")

### Rule 1: Send Status Updates IMMEDIATELY
When you start working on a task, IMMEDIATELY use the send_status tool to tell the user what you're doing:
- Call send_status BEFORE calling other tools
- Include the identified GOAL in your first status update
- Example: send_status("Goal: Find weather news for Tilbury. Searching news sources...") → then search_news(...)
- Keep the user informed at each major step

### Rule 2: NEVER Return Just Links
When the user asks for information (news, research, etc.), you must:
1. Search for relevant sources (search_news, get_top_headlines)
2. THEN use browse_url to actually READ the most relevant articles
3. THEN synthesize what you learned into a complete answer
4. DO NOT just hand the user a list of URLs - they asked YOU to find the information

### Rule 3: Complete the Goal
Your job is to FULLY COMPLETE the user's request:
- If they ask for news about a topic → Find articles, read them, summarize the actual news
- If they ask a question → Research it and provide the answer
- If they ask you to do something → Do it completely, don't stop halfway

### Rule 4: Output Quality
Your final response must be:
- Written in clean, attractive Markdown
- Well-organized with headers and bullet points where appropriate
- A complete answer that addresses what the user asked
- Professional and polished - like a research brief

## WORKFLOW FOR RESEARCH TASKS

1. Analyze the user's prompt and identify their GOAL
2. send_status("Goal: [explicit goal]. Starting research on [topic]...")
3. Use search_news or get_top_headlines to find relevant sources
4. send_status("Reading [X] articles...")
5. Use browse_url on the most relevant URLs (2-4 articles typically)
6. send_status("Synthesizing findings...")
7. Use complete_task to deliver a polished, comprehensive summary

## EXAMPLE WORKFLOW

User: "What's the weather news in Tilbury, Ontario?"

Your actions:
1. Identify goal: "Find current weather-related news for Tilbury, Ontario and summarize it for the user."
2. send_status("Goal: Find weather news for Tilbury, Ontario. Searching news sources...")
3. search_news("Tilbury Ontario weather")
4. send_status("Reading the top weather articles...")
5. browse_url(first_relevant_article_url)
6. browse_url(second_relevant_article_url)  
7. complete_task with synthesized weather news summary in Markdown

## WHAT NOT TO DO
- ❌ Don't return raw tool output to the user
- ❌ Don't give the user a list of links and tell them to read them
- ❌ Don't stop after searching - always read and synthesize
- ❌ Don't include <think> blocks in your final output

## AVAILABLE TOOLS
- send_status: Tell the user what you're doing RIGHT NOW (use frequently)
- search_news: Find news articles on a topic
- get_top_headlines: Get latest headlines
- browse_url: Read the content of a web page (USE THIS to actually read articles)
- take_screenshot: Capture a webpage image
- create_subtask: Delegate complex subtasks
- complete_task: Deliver the final result (use when DONE)

Remember: You are an agent that DOES things. Don't be passive. Complete the mission.`;

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

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly eventEmitters: Map<string, EventEmitter> = new Map();

  constructor(
    private ollamaService: OllamaService,
    private agentToolsService: AgentToolsService,
    private databaseService: DatabaseService,
  ) {}

  async processChat(request: ChatRequest): Promise<{ conversationId: string; emitter: EventEmitter }> {
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
    }, request.prompt, emitter).catch((error) => {
      this.logger.error(`Agent execution error: ${error}`);
      this.emitEvent(emitter, {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    });

    return { conversationId, emitter };
  }

  private async runAgent(
    context: AgentExecutionContext,
    prompt: string,
    emitter: EventEmitter,
  ): Promise<string> {
    const db = this.databaseService.getDb();
    const executionId = nanoid();

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

    // Setup tool callbacks
    this.agentToolsService.setStatusCallback((message) => {
      this.emitEvent(emitter, {
        type: 'status',
        message,
        timestamp: new Date().toISOString(),
      });
    });

    this.agentToolsService.setSubtaskCallback(async (task, taskContext) => {
      this.emitEvent(emitter, {
        type: 'status',
        message: `Starting subtask: ${task}`,
        timestamp: new Date().toISOString(),
      });

      // Run sub-agent
      const result = await this.runAgent(
        {
          ...context,
          parentExecutionId: execution.id,
          isSubAgent: true,
          maxIterations: 5,
        },
        `${task}${taskContext ? `\n\nContext: ${taskContext}` : ''}`,
        emitter,
      );

      return result;
    });

    const tools = this.agentToolsService.getTools();
    let iterations = 0;
    let finalResult = '';
    let isComplete = false;
    const toolCallHistory: Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
      duration: number;
    }> = [];

    // Build initial messages
    const coreMessages: CoreMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      { role: 'user', content: prompt },
    ];

    this.emitEvent(emitter, {
      type: 'status',
      message: 'Thinking...',
      timestamp: new Date().toISOString(),
    });

    try {
      while (!isComplete && iterations < context.maxIterations) {
        iterations++;

        // Generate response
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await this.ollamaService.generate({
          messages: coreMessages,
          tools: tools as any,
          temperature: 0.7,
        });

        // Process tool calls if any
        if (result.toolCalls && result.toolCalls.length > 0) {
          const toolResults: Array<{ toolCallId: string; result: unknown }> = [];

          for (const toolCall of result.toolCalls) {
            const startTime = Date.now();

            this.emitEvent(emitter, {
              type: 'tool_start',
              toolName: toolCall.toolName,
              toolArgs: toolCall.args as Record<string, unknown>,
              timestamp: new Date().toISOString(),
            });

            // Execute tool
            const tool = tools[toolCall.toolName as keyof typeof tools];
            let toolResult: unknown;

            if (tool) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                toolResult = await (tool as any).execute(toolCall.args);
              } catch (error) {
                toolResult = {
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            } else {
              toolResult = { success: false, error: `Unknown tool: ${toolCall.toolName}` };
            }

            const duration = Date.now() - startTime;

            toolCallHistory.push({
              name: toolCall.toolName,
              args: toolCall.args as Record<string, unknown>,
              result: toolResult,
              duration,
            });

            toolResults.push({
              toolCallId: toolCall.toolCallId,
              result: toolResult,
            });

            // Check if task is complete
            if (
              toolCall.toolName === 'complete_task' &&
              typeof toolResult === 'object' &&
              toolResult !== null &&
              'isComplete' in toolResult
            ) {
              isComplete = true;
              const completeResult = toolResult as { data?: { result?: string } };
              // Strip any think tags from the final result and emit as content
              finalResult = stripThinkTags(completeResult.data?.result || '');
              
              // Emit the final content so frontend displays it
              this.emitEvent(emitter, {
                type: 'content',
                content: finalResult,
                timestamp: new Date().toISOString(),
              });
            }

            const summary =
              typeof toolResult === 'object' && toolResult !== null && 'summary' in toolResult
                ? (toolResult as { summary: string }).summary
                : 'Tool executed';

            this.emitEvent(emitter, {
              type: 'tool_result',
              toolName: toolCall.toolName,
              result: toolResult,
              summary,
              timestamp: new Date().toISOString(),
            });
          }

          // Add assistant message with tool calls and tool results to conversation
          coreMessages.push({
            role: 'assistant',
            content: result.text || '',
            // Tool calls are handled by the AI SDK internally
          });

          // Add tool results as tool messages
          for (const tr of toolResults) {
            coreMessages.push({
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: tr.toolCallId,
                  toolName: toolCallHistory[toolCallHistory.length - 1]?.name || 'unknown',
                  result: tr.result,
                } as ToolResultPart,
              ],
            });
          }
        } else {
          // No tool calls, check if we have a final response
          if (result.text) {
            // Strip any think tags before emitting
            finalResult = stripThinkTags(result.text);

            this.emitEvent(emitter, {
              type: 'content',
              content: finalResult,
              timestamp: new Date().toISOString(),
            });
          }

          // If no tool calls for a while, consider it complete
          isComplete = true;
        }
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
    // Create a brief summary for sub-agent results
    const maxLength = 200;
    const summary = `Task: ${task.substring(0, 100)}. Result: ${result.substring(0, maxLength)}`;
    return summary.length > maxLength ? summary.substring(0, maxLength) + '...' : summary;
  }

  private emitEvent(emitter: EventEmitter, event: SSEEvent) {
    emitter.emit('event', event);
  }

  getEventEmitter(conversationId: string): EventEmitter | undefined {
    return this.eventEmitters.get(conversationId);
  }

  removeEventEmitter(conversationId: string): void {
    this.eventEmitters.delete(conversationId);
  }
}
