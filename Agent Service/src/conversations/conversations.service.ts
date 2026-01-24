import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  conversations,
  messages,
  agentExecutions,
  Conversation,
  Message,
  AgentExecution,
} from '../database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { CreateConversation, UpdateConversation } from '../agent/schemas';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private databaseService: DatabaseService) {}

  async findAll(userId?: string): Promise<Conversation[]> {
    const db = this.databaseService.getDb();

    if (userId) {
      return db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.updatedAt));
    }

    return db.select().from(conversations).orderBy(desc(conversations.updatedAt));
  }

  async findOne(id: string): Promise<Conversation> {
    const db = this.databaseService.getDb();
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    return conversation;
  }

  async findWithMessages(id: string): Promise<{
    conversation: Conversation;
    messages: Message[];
  }> {
    const conversation = await this.findOne(id);
    const db = this.databaseService.getDb();

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    return { conversation, messages: msgs };
  }

  async findWithExecutions(id: string): Promise<{
    conversation: Conversation;
    executions: AgentExecution[];
  }> {
    const conversation = await this.findOne(id);
    const db = this.databaseService.getDb();

    const execs = await db
      .select()
      .from(agentExecutions)
      .where(eq(agentExecutions.conversationId, id))
      .orderBy(agentExecutions.startedAt);

    return { conversation, executions: execs };
  }

  async create(data: CreateConversation): Promise<Conversation> {
    const db = this.databaseService.getDb();

    const [conversation] = await db
      .insert(conversations)
      .values({
        userId: data.userId,
        title: data.title,
        metadata: data.metadata,
      })
      .returning();

    this.logger.log(`Created conversation: ${conversation.id}`);
    return conversation;
  }

  async update(id: string, data: UpdateConversation): Promise<Conversation> {
    const db = this.databaseService.getDb();

    // Ensure conversation exists
    await this.findOne(id);

    const [updated] = await db
      .update(conversations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id))
      .returning();

    this.logger.log(`Updated conversation: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const db = this.databaseService.getDb();

    // Ensure conversation exists
    await this.findOne(id);

    // Delete cascade will handle messages and executions
    await db.delete(conversations).where(eq(conversations.id, id));
    this.logger.log(`Deleted conversation: ${id}`);
  }

  async archive(id: string): Promise<Conversation> {
    return this.update(id, { status: 'archived' });
  }

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    const db = this.databaseService.getDb();

    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  async addMessage(
    conversationId: string,
    role: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<Message> {
    const db = this.databaseService.getDb();

    // Ensure conversation exists
    await this.findOne(conversationId);

    const [message] = await db
      .insert(messages)
      .values({
        conversationId,
        role,
        content,
        metadata,
      })
      .returning();

    // Update conversation timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    return message;
  }

  async summarizeConversation(id: string): Promise<string> {
    const { messages: msgs } = await this.findWithMessages(id);

    if (msgs.length === 0) {
      return 'Empty conversation';
    }

    // Build a simple summary
    const userMessages = msgs.filter((m) => m.role === 'user');
    const assistantMessages = msgs.filter((m) => m.role === 'assistant');

    const summary = [
      `Conversation with ${msgs.length} messages.`,
      `User messages: ${userMessages.length}`,
      `Assistant responses: ${assistantMessages.length}`,
      `First user message: "${userMessages[0]?.content.substring(0, 100)}..."`,
      `Last assistant response: "${assistantMessages[assistantMessages.length - 1]?.content.substring(0, 100)}..."`,
    ].join('\n');

    return summary;
  }
}
