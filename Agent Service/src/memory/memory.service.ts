import { Injectable, Logger } from '@nestjs/common';
import { eq, and, lte, sql, desc } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { OllamaService } from '../llm/ollama.service';
import {
  memories,
  memoryTags,
  memoryTagAssignments,
  Memory,
  MemoryTag,
} from '../database/schema';

export interface CreateMemoryInput {
  content: string;
  summary?: string;
  tags: string[];
  eventDate?: string;      // ISO date string YYYY-MM-DD
  eventDateEnd?: string;
  expiryDate?: string;
  relevanceDaysBefore?: number;
  priority?: number;
  source?: 'agent' | 'user' | 'system';
  metadata?: Record<string, unknown>;
}

export interface UpdateMemoryInput {
  content?: string;
  summary?: string;
  tags?: string[];
  eventDate?: string | null;      // null to clear
  eventDateEnd?: string | null;
  expiryDate?: string | null;
  relevanceDaysBefore?: number;
  priority?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MemoryWithTags extends Memory {
  tags: MemoryTag[];
}

export interface SearchOptions {
  limit?: number;
  tags?: string[];
  minSimilarity?: number;
  includeExpired?: boolean;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly EMBEDDING_MODEL = 'nomic-embed-text';

  constructor(
    private databaseService: DatabaseService,
    private ollamaService: OllamaService,
  ) {}

  /**
   * Generate embedding for text using Ollama's nomic-embed-text model
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const baseUrl = (this.ollamaService as any).baseUrl || 'http://localhost:11434';
      
      const response = await fetch(`${baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.EMBEDDING_MODEL,
          input: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as { embeddings: number[][] };
      
      if (!data.embeddings || !data.embeddings[0]) {
        throw new Error('No embeddings returned from model');
      }

      return data.embeddings[0];
    } catch (error) {
      this.logger.error(`Error generating embedding: ${error}`);
      throw error;
    }
  }

  /**
   * Create a new memory with embedding
   */
  async createMemory(userId: string, input: CreateMemoryInput): Promise<MemoryWithTags> {
    const db = this.databaseService.getDb();
    
    // Generate embedding for the content
    const embeddingText = input.summary 
      ? `${input.summary}\n${input.content}`
      : input.content;
    
    let embedding: number[] | null = null;
    try {
      embedding = await this.generateEmbedding(embeddingText);
    } catch (error) {
      this.logger.warn(`Could not generate embedding: ${error}. Memory will be saved without embedding.`);
    }

    // Create the memory
    const [memory] = await db
      .insert(memories)
      .values({
        userId,
        content: input.content,
        summary: input.summary,
        embedding,
        eventDate: input.eventDate,
        eventDateEnd: input.eventDateEnd,
        expiryDate: input.expiryDate,
        relevanceDaysBefore: input.relevanceDaysBefore ?? 1,
        priority: input.priority ?? 5,
        source: input.source ?? 'agent',
        metadata: input.metadata,
      })
      .returning();

    // Assign tags
    const tags = await this.assignTags(memory.id, input.tags);

    this.logger.log(`Created memory ${memory.id} for user ${userId} with ${tags.length} tags`);
    
    return { ...memory, tags };
  }

  /**
   * Update an existing memory
   */
  async updateMemory(
    memoryId: string,
    userId: string,
    input: UpdateMemoryInput,
  ): Promise<MemoryWithTags | null> {
    const db = this.databaseService.getDb();

    // Verify ownership
    const existing = await db
      .select()
      .from(memories)
      .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return null;
    }

    // Build update object
    const updates: Partial<typeof memories.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.content !== undefined) {
      updates.content = input.content;
    }
    if (input.summary !== undefined) {
      updates.summary = input.summary;
    }
    if (input.eventDate !== undefined) {
      updates.eventDate = input.eventDate;
    }
    if (input.eventDateEnd !== undefined) {
      updates.eventDateEnd = input.eventDateEnd;
    }
    if (input.expiryDate !== undefined) {
      updates.expiryDate = input.expiryDate;
    }
    if (input.relevanceDaysBefore !== undefined) {
      updates.relevanceDaysBefore = input.relevanceDaysBefore;
    }
    if (input.priority !== undefined) {
      updates.priority = input.priority;
    }
    if (input.isActive !== undefined) {
      updates.isActive = input.isActive;
    }
    if (input.metadata !== undefined) {
      updates.metadata = input.metadata;
    }

    // Regenerate embedding if content changed
    if (input.content || input.summary) {
      const newContent = input.content ?? existing[0].content;
      const newSummary = input.summary ?? existing[0].summary;
      const embeddingText = newSummary ? `${newSummary}\n${newContent}` : newContent;
      
      try {
        updates.embedding = await this.generateEmbedding(embeddingText);
      } catch (error) {
        this.logger.warn(`Could not regenerate embedding: ${error}`);
      }
    }

    // Update memory
    const [updated] = await db
      .update(memories)
      .set(updates)
      .where(eq(memories.id, memoryId))
      .returning();

    // Update tags if provided
    let tags: MemoryTag[];
    if (input.tags !== undefined) {
      // Clear existing tags
      await db.delete(memoryTagAssignments).where(eq(memoryTagAssignments.memoryId, memoryId));
      tags = await this.assignTags(memoryId, input.tags);
    } else {
      tags = await this.getMemoryTags(memoryId);
    }

    this.logger.log(`Updated memory ${memoryId}`);
    
    return { ...updated, tags };
  }

  /**
   * Delete a memory (soft delete by default)
   */
  async deleteMemory(memoryId: string, userId: string, hard = false): Promise<boolean> {
    const db = this.databaseService.getDb();

    if (hard) {
      const result = await db
        .delete(memories)
        .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)));
      return true;
    } else {
      const [updated] = await db
        .update(memories)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
        .returning();
      return !!updated;
    }
  }

  /**
   * Search memories using semantic similarity
   */
  async searchMemories(
    userId: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<MemoryWithTags[]> {
    const db = this.databaseService.getDb();
    const limit = options.limit ?? 10;
    const minSimilarity = options.minSimilarity ?? 0.5;

    // Generate query embedding
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.generateEmbedding(query);
    } catch (error) {
      this.logger.error(`Could not generate query embedding: ${error}`);
      // Fall back to basic text search
      return this.searchMemoriesText(userId, query, options);
    }

    // Build the vector similarity query
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    // Query with cosine similarity
    const results = await db.execute(sql`
      SELECT 
        m.*,
        1 - (m.embedding <=> ${embeddingStr}::vector) as similarity
      FROM memories m
      WHERE m.user_id = ${userId}
        AND m.is_active = true
        AND m.embedding IS NOT NULL
        ${options.includeExpired ? sql`` : sql`AND (m.expiry_date IS NULL OR m.expiry_date > CURRENT_DATE)`}
      ORDER BY m.embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    // Filter by similarity threshold and enrich with tags
    const memoriesWithTags: MemoryWithTags[] = [];
    for (const row of results.rows as any[]) {
      if (row.similarity >= minSimilarity) {
        const tags = await this.getMemoryTags(row.id);
        
        // Filter by tags if specified
        if (options.tags && options.tags.length > 0) {
          const tagNames = tags.map(t => t.name.toLowerCase());
          const hasMatchingTag = options.tags.some(t => tagNames.includes(t.toLowerCase()));
          if (!hasMatchingTag) continue;
        }

        memoriesWithTags.push({
          id: row.id,
          userId: row.user_id,
          content: row.content,
          summary: row.summary,
          embedding: row.embedding ? JSON.parse(row.embedding.replace(/^\[/, '[').replace(/]$/, ']')) : null,
          eventDate: row.event_date,
          eventDateEnd: row.event_date_end,
          expiryDate: row.expiry_date,
          relevanceDaysBefore: row.relevance_days_before,
          isActive: row.is_active,
          priority: row.priority,
          source: row.source,
          metadata: row.metadata,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          tags,
        });
      }
    }

    this.logger.debug(`Found ${memoriesWithTags.length} memories for query "${query}"`);
    return memoriesWithTags;
  }

  /**
   * Fallback text search when embeddings aren't available
   */
  private async searchMemoriesText(
    userId: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<MemoryWithTags[]> {
    const db = this.databaseService.getDb();
    const limit = options.limit ?? 10;

    // Simple ILIKE search
    const results = await db.execute(sql`
      SELECT * FROM memories
      WHERE user_id = ${userId}
        AND is_active = true
        AND (content ILIKE ${'%' + query + '%'} OR summary ILIKE ${'%' + query + '%'})
        ${options.includeExpired ? sql`` : sql`AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)`}
      ORDER BY priority DESC, created_at DESC
      LIMIT ${limit}
    `);

    const memoriesWithTags: MemoryWithTags[] = [];
    for (const row of results.rows as any[]) {
      const tags = await this.getMemoryTags(row.id);
      
      if (options.tags && options.tags.length > 0) {
        const tagNames = tags.map(t => t.name.toLowerCase());
        const hasMatchingTag = options.tags.some(t => tagNames.includes(t.toLowerCase()));
        if (!hasMatchingTag) continue;
      }

      memoriesWithTags.push({
        id: row.id,
        userId: row.user_id,
        content: row.content,
        summary: row.summary,
        embedding: null,
        eventDate: row.event_date,
        eventDateEnd: row.event_date_end,
        expiryDate: row.expiry_date,
        relevanceDaysBefore: row.relevance_days_before,
        isActive: row.is_active,
        priority: row.priority,
        source: row.source,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        tags,
      });
    }

    return memoriesWithTags;
  }

  /**
   * Get memories that are relevant based on their event dates
   * (i.e., we're within the relevance window before the event)
   */
  async getDateRelevantMemories(
    userId: string,
    referenceDate: Date = new Date(),
  ): Promise<MemoryWithTags[]> {
    const db = this.databaseService.getDb();
    const dateStr = referenceDate.toISOString().split('T')[0];

    // Find memories where:
    // 1. event_date is not null
    // 2. is_active = true
    // 3. not expired
    // 4. We're within the relevance window: 
    //    event_date - relevance_days_before <= today <= event_date (or event_date_end)
    const results = await db.execute(sql`
      SELECT * FROM memories
      WHERE user_id = ${userId}
        AND is_active = true
        AND event_date IS NOT NULL
        AND (expiry_date IS NULL OR expiry_date > ${dateStr}::date)
        AND ${dateStr}::date >= (event_date - relevance_days_before * INTERVAL '1 day')::date
        AND ${dateStr}::date <= COALESCE(event_date_end, event_date)
      ORDER BY event_date ASC, priority DESC
    `);

    const memoriesWithTags: MemoryWithTags[] = [];
    for (const row of results.rows as any[]) {
      const tags = await this.getMemoryTags(row.id);
      memoriesWithTags.push({
        id: row.id,
        userId: row.user_id,
        content: row.content,
        summary: row.summary,
        embedding: null, // Don't need embeddings for context injection
        eventDate: row.event_date,
        eventDateEnd: row.event_date_end,
        expiryDate: row.expiry_date,
        relevanceDaysBefore: row.relevance_days_before,
        isActive: row.is_active,
        priority: row.priority,
        source: row.source,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        tags,
      });
    }

    this.logger.debug(`Found ${memoriesWithTags.length} date-relevant memories for user ${userId}`);
    return memoriesWithTags;
  }

  /**
   * List all memories for a user with pagination
   */
  async listMemories(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      tags?: string[];
      includeInactive?: boolean;
    } = {},
  ): Promise<MemoryWithTags[]> {
    const db = this.databaseService.getDb();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    let results;
    if (options.includeInactive) {
      results = await db
        .select()
        .from(memories)
        .where(eq(memories.userId, userId))
        .orderBy(desc(memories.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      results = await db
        .select()
        .from(memories)
        .where(and(eq(memories.userId, userId), eq(memories.isActive, true)))
        .orderBy(desc(memories.createdAt))
        .limit(limit)
        .offset(offset);
    }

    const memoriesWithTags: MemoryWithTags[] = [];
    for (const memory of results) {
      const tags = await this.getMemoryTags(memory.id);
      
      if (options.tags && options.tags.length > 0) {
        const tagNames = tags.map(t => t.name.toLowerCase());
        const hasMatchingTag = options.tags.some(t => tagNames.includes(t.toLowerCase()));
        if (!hasMatchingTag) continue;
      }

      memoriesWithTags.push({ ...memory, tags });
    }

    return memoriesWithTags;
  }

  /**
   * Get a single memory by ID
   */
  async getMemory(memoryId: string, userId: string): Promise<MemoryWithTags | null> {
    const db = this.databaseService.getDb();
    
    const [memory] = await db
      .select()
      .from(memories)
      .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
      .limit(1);

    if (!memory) return null;

    const tags = await this.getMemoryTags(memoryId);
    return { ...memory, tags };
  }

  /**
   * Get all available tags
   */
  async getAllTags(): Promise<MemoryTag[]> {
    const db = this.databaseService.getDb();
    return db.select().from(memoryTags);
  }

  /**
   * Get or create a tag by name
   */
  async getOrCreateTag(name: string): Promise<MemoryTag> {
    const db = this.databaseService.getDb();
    const normalizedName = name.toLowerCase().trim();

    const [existing] = await db
      .select()
      .from(memoryTags)
      .where(eq(memoryTags.name, normalizedName))
      .limit(1);

    if (existing) return existing;

    const [created] = await db
      .insert(memoryTags)
      .values({ name: normalizedName })
      .returning();

    return created;
  }

  /**
   * Assign tags to a memory
   */
  private async assignTags(memoryId: string, tagNames: string[]): Promise<MemoryTag[]> {
    const db = this.databaseService.getDb();
    const tags: MemoryTag[] = [];

    for (const tagName of tagNames) {
      const tag = await this.getOrCreateTag(tagName);
      tags.push(tag);

      // Create assignment (ignore if already exists)
      try {
        await db.insert(memoryTagAssignments).values({
          memoryId,
          tagId: tag.id,
        });
      } catch (error) {
        // Likely duplicate, ignore
      }
    }

    return tags;
  }

  /**
   * Get tags for a memory
   */
  private async getMemoryTags(memoryId: string): Promise<MemoryTag[]> {
    const db = this.databaseService.getDb();
    
    const assignments = await db
      .select({ tag: memoryTags })
      .from(memoryTagAssignments)
      .innerJoin(memoryTags, eq(memoryTagAssignments.tagId, memoryTags.id))
      .where(eq(memoryTagAssignments.memoryId, memoryId));

    return assignments.map(a => a.tag);
  }

  /**
   * Purge expired memories (for scheduled cleanup)
   */
  async purgeExpiredMemories(): Promise<number> {
    const db = this.databaseService.getDb();
    const today = new Date().toISOString().split('T')[0];

    const result = await db
      .delete(memories)
      .where(and(
        lte(memories.expiryDate, today),
        eq(memories.isActive, false), // Only delete inactive expired memories
      ));

    this.logger.log(`Purged expired memories`);
    return 0; // Drizzle doesn't return count easily
  }

  /**
   * Seed default memory tags
   */
  async seedDefaultTags(): Promise<void> {
    const defaultTags = [
      { name: 'health', description: 'Health-related memories', color: '#4CAF50' },
      { name: 'goals', description: 'Personal goals and aspirations', color: '#2196F3' },
      { name: 'food', description: 'Dietary preferences and meal plans', color: '#FF9800' },
      { name: 'events', description: 'Calendar events and meetings', color: '#9C27B0' },
      { name: 'people', description: 'Information about contacts', color: '#E91E63' },
      { name: 'work', description: 'Work-related tasks and projects', color: '#607D8B' },
      { name: 'finance', description: 'Financial goals and expenses', color: '#795548' },
      { name: 'learning', description: 'Things to learn and skills', color: '#00BCD4' },
      { name: 'personal', description: 'General personal notes', color: '#9E9E9E' },
      { name: 'reminder', description: 'Time-sensitive reminders', color: '#F44336' },
    ];

    for (const tag of defaultTags) {
      try {
        await this.getOrCreateTag(tag.name);
        // Update with description and color if exists
        const db = this.databaseService.getDb();
        await db
          .update(memoryTags)
          .set({ description: tag.description, color: tag.color })
          .where(eq(memoryTags.name, tag.name));
      } catch (error) {
        // Ignore
      }
    }

    this.logger.log('Seeded default memory tags');
  }

  /**
   * Format memories for context injection
   */
  formatMemoriesForContext(memoriesData: MemoryWithTags[]): string {
    if (memoriesData.length === 0) return '';

    const lines: string[] = ['📌 UPCOMING EVENTS & RELEVANT MEMORIES:'];
    lines.push('');

    for (const memory of memoriesData) {
      const tagStr = memory.tags.map(t => `#${t.name}`).join(' ');
      const dateStr = memory.eventDate 
        ? `Event Date: ${memory.eventDate}${memory.eventDateEnd ? ` to ${memory.eventDateEnd}` : ''}`
        : '';
      
      lines.push(`[ID: ${memory.id.substring(0, 8)}] ${dateStr}`);
      lines.push(`Tags: ${tagStr}`);
      lines.push(memory.summary || memory.content.substring(0, 200));
      lines.push('');
    }

    return lines.join('\n');
  }
}
