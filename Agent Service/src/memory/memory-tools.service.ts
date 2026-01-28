import { Injectable, Logger } from '@nestjs/common';
import { MemoryService, CreateMemoryInput, UpdateMemoryInput } from './memory.service';

/**
 * Memory Tools Service
 * Provides tool definitions and execution for the agent's memory system
 */
@Injectable()
export class MemoryToolsService {
  private readonly logger = new Logger(MemoryToolsService.name);

  constructor(private memoryService: MemoryService) {}

  /**
   * Get all memory tool definitions for registration with the tool executor
   */
  getToolDefinitions() {
    return [
      this.getSaveMemoryTool(),
      this.getSearchMemoriesTool(),
      this.getUpdateMemoryTool(),
      this.getDeleteMemoryTool(),
    ];
  }

  private getSaveMemoryTool() {
    return {
      name: 'save_memory',
      description: `Save important information to your long-term memory. Use this proactively to remember:
- User preferences, habits, and personal details
- Future intentions with dates (meetings, tasks, goals with deadlines)  
- Important dates (birthdays, appointments, anniversaries)
- Context that would be useful in future conversations
ALWAYS set eventDate for time-sensitive memories! Set relevanceDaysBefore to control when you start proactively mentioning it.`,
      parameters: {
        content: { 
          type: 'string', 
          description: 'Detailed memory content - what to remember', 
          required: true 
        },
        summary: { 
          type: 'string', 
          description: 'Brief 1-line summary for quick context injection' 
        },
        tags: { 
          type: 'array', 
          description: 'Tags to categorize: health, goals, food, events, people, work, finance, learning, personal, reminder', 
          required: true 
        },
        eventDate: { 
          type: 'string', 
          description: 'ISO date (YYYY-MM-DD) for when this event occurs. IMPORTANT for time-sensitive memories!' 
        },
        eventDateEnd: { 
          type: 'string', 
          description: 'ISO date for end of date range (optional)' 
        },
        expiryDate: { 
          type: 'string', 
          description: 'ISO date when this memory should be auto-deleted (optional)' 
        },
        relevanceDaysBefore: { 
          type: 'number', 
          description: 'Days before eventDate to start proactively mentioning this (default: 1)' 
        },
        priority: { 
          type: 'number', 
          description: 'Priority 1-10 where 10 is most important (default: 5)' 
        },
      },
      execute: async (
        args: Record<string, unknown>,
        context: { userId: string; onStatus?: (msg: string) => void },
      ) => {
        context.onStatus?.('Saving to memory...');

        try {
          const input: CreateMemoryInput = {
            content: args.content as string,
            summary: args.summary as string | undefined,
            tags: (args.tags as string[]) || ['personal'],
            eventDate: args.eventDate as string | undefined,
            eventDateEnd: args.eventDateEnd as string | undefined,
            expiryDate: args.expiryDate as string | undefined,
            relevanceDaysBefore: args.relevanceDaysBefore as number | undefined,
            priority: args.priority as number | undefined,
            source: 'agent',
          };

          const memory = await this.memoryService.createMemory(context.userId, input);
          
          const tagStr = memory.tags.map(t => t.name).join(', ');
          
          return {
            success: true,
            data: {
              memoryId: memory.id,
              tags: memory.tags.map(t => t.name),
              eventDate: memory.eventDate,
              relevanceDaysBefore: memory.relevanceDaysBefore,
            },
            summary: `Memory saved with tags: [${tagStr}]${memory.eventDate ? `, event: ${memory.eventDate}` : ''}`,
            // Memory operations are silent - don't show in final response
            isComplete: false,
          };
        } catch (error) {
          this.logger.error(`Error saving memory: ${error}`);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            summary: 'Failed to save memory',
          };
        }
      },
    };
  }

  private getSearchMemoriesTool() {
    return {
      name: 'search_memories',
      description: 'Search your memory for relevant past information using semantic search. Use when you need to recall something the user mentioned before.',
      parameters: {
        query: { 
          type: 'string', 
          description: 'What to search for - describe what you want to find', 
          required: true 
        },
        tags: { 
          type: 'array', 
          description: 'Filter by specific tags (optional): health, goals, food, events, people, work, finance, learning, personal, reminder' 
        },
        limit: { 
          type: 'number', 
          description: 'Maximum results to return (default: 5)' 
        },
      },
      execute: async (
        args: Record<string, unknown>,
        context: { userId: string; onStatus?: (msg: string) => void },
      ) => {
        context.onStatus?.('Searching memories...');

        try {
          const memories = await this.memoryService.searchMemories(
            context.userId,
            args.query as string,
            {
              tags: args.tags as string[] | undefined,
              limit: (args.limit as number) || 5,
            },
          );

          if (memories.length === 0) {
            return {
              success: true,
              data: { memories: [], count: 0 },
              summary: 'No relevant memories found',
            };
          }

          const memorySummaries = memories.map(m => ({
            id: m.id.substring(0, 8),
            summary: m.summary || m.content.substring(0, 100),
            tags: m.tags.map(t => t.name),
            eventDate: m.eventDate,
            createdAt: m.createdAt,
          }));

          return {
            success: true,
            data: { 
              memories: memorySummaries,
              count: memories.length,
            },
            summary: `Found ${memories.length} relevant memories`,
          };
        } catch (error) {
          this.logger.error(`Error searching memories: ${error}`);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            summary: 'Failed to search memories',
          };
        }
      },
    };
  }

  private getUpdateMemoryTool() {
    return {
      name: 'update_memory',
      description: 'Update an existing memory. Use to correct information, update dates, or mark as completed.',
      parameters: {
        memoryId: { 
          type: 'string', 
          description: 'The memory ID (first 8 chars shown in memory lists)', 
          required: true 
        },
        content: { 
          type: 'string', 
          description: 'New content (optional, replaces old content)' 
        },
        summary: { 
          type: 'string', 
          description: 'New summary (optional)' 
        },
        tags: { 
          type: 'array', 
          description: 'New tags to replace existing (optional)' 
        },
        eventDate: { 
          type: 'string', 
          description: 'New event date, or "clear" to remove' 
        },
        expiryDate: { 
          type: 'string', 
          description: 'New expiry date, or "clear" to remove' 
        },
        isActive: { 
          type: 'boolean', 
          description: 'Set to false to deactivate/archive the memory' 
        },
      },
      execute: async (
        args: Record<string, unknown>,
        context: { userId: string; onStatus?: (msg: string) => void },
      ) => {
        context.onStatus?.('Updating memory...');

        try {
          // Handle partial IDs - search for matching memory
          const memoryId = args.memoryId as string;
          let fullMemoryId = memoryId;
          
          if (memoryId.length < 36) {
            // It's a partial ID, find the full one
            const memories = await this.memoryService.listMemories(context.userId, { limit: 100 });
            const match = memories.find(m => m.id.startsWith(memoryId));
            if (!match) {
              return {
                success: false,
                error: `No memory found starting with ID: ${memoryId}`,
                summary: 'Memory not found',
              };
            }
            fullMemoryId = match.id;
          }

          const input: UpdateMemoryInput = {};
          
          if (args.content) input.content = args.content as string;
          if (args.summary) input.summary = args.summary as string;
          if (args.tags) input.tags = args.tags as string[];
          if (args.eventDate === 'clear') {
            input.eventDate = null;
          } else if (args.eventDate) {
            input.eventDate = args.eventDate as string;
          }
          if (args.expiryDate === 'clear') {
            input.expiryDate = null;
          } else if (args.expiryDate) {
            input.expiryDate = args.expiryDate as string;
          }
          if (typeof args.isActive === 'boolean') {
            input.isActive = args.isActive;
          }

          const updated = await this.memoryService.updateMemory(fullMemoryId, context.userId, input);
          
          if (!updated) {
            return {
              success: false,
              error: 'Memory not found or access denied',
              summary: 'Failed to update memory',
            };
          }

          return {
            success: true,
            data: { memoryId: updated.id.substring(0, 8) },
            summary: `Memory ${updated.id.substring(0, 8)} updated`,
          };
        } catch (error) {
          this.logger.error(`Error updating memory: ${error}`);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            summary: 'Failed to update memory',
          };
        }
      },
    };
  }

  private getDeleteMemoryTool() {
    return {
      name: 'delete_memory',
      description: 'Delete a memory that is no longer relevant, outdated, or incorrect.',
      parameters: {
        memoryId: { 
          type: 'string', 
          description: 'The memory ID to delete (first 8 chars shown in lists)', 
          required: true 
        },
        reason: { 
          type: 'string', 
          description: 'Brief reason for deletion (for logging)' 
        },
      },
      execute: async (
        args: Record<string, unknown>,
        context: { userId: string; onStatus?: (msg: string) => void },
      ) => {
        context.onStatus?.('Deleting memory...');

        try {
          const memoryId = args.memoryId as string;
          let fullMemoryId = memoryId;
          
          if (memoryId.length < 36) {
            const memories = await this.memoryService.listMemories(context.userId, { limit: 100 });
            const match = memories.find(m => m.id.startsWith(memoryId));
            if (!match) {
              return {
                success: false,
                error: `No memory found starting with ID: ${memoryId}`,
                summary: 'Memory not found',
              };
            }
            fullMemoryId = match.id;
          }

          const deleted = await this.memoryService.deleteMemory(fullMemoryId, context.userId);
          
          if (!deleted) {
            return {
              success: false,
              error: 'Memory not found or already deleted',
              summary: 'Failed to delete memory',
            };
          }

          const reason = args.reason ? ` Reason: ${args.reason}` : '';
          this.logger.log(`Memory ${memoryId} deleted by user ${context.userId}.${reason}`);

          return {
            success: true,
            data: { memoryId: memoryId.substring(0, 8) },
            summary: `Memory ${memoryId.substring(0, 8)} deleted`,
          };
        } catch (error) {
          this.logger.error(`Error deleting memory: ${error}`);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            summary: 'Failed to delete memory',
          };
        }
      },
    };
  }

  /**
   * Get proactive memories to inject into agent context
   */
  async getProactiveContext(userId: string): Promise<string> {
    try {
      const dateRelevantMemories = await this.memoryService.getDateRelevantMemories(userId);
      return this.memoryService.formatMemoriesForContext(dateRelevantMemories);
    } catch (error) {
      this.logger.error(`Error getting proactive context: ${error}`);
      return '';
    }
  }
}
