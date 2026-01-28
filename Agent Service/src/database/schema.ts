import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  uuid,
  date,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Custom pgvector type for embeddings (384 dimensions for nomic-embed-text)
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(384)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    // Handle postgres array format like "[0.1,0.2,...]"
    const cleaned = value.replace(/^\[/, '').replace(/]$/, '');
    return cleaned.split(',').map(Number);
  },
});

// Users table - synced from external service
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Conversations table
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  status: text('status').notNull().default('active'), // active, completed, archived
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Messages table - stores conversation messages
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // user, assistant, system, tool
  content: text('content').notNull(),
  toolName: text('tool_name'),
  toolCallId: text('tool_call_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Agent executions - tracks agent runs
export const agentExecutions = pgTable('agent_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  parentExecutionId: uuid('parent_execution_id'),
  agentType: text('agent_type').notNull(), // main, sub
  status: text('status').notNull().default('running'), // running, completed, failed
  prompt: text('prompt').notNull(),
  result: text('result'),
  summary: text('summary'), // Summary for sub-agents
  tokenUsage: jsonb('token_usage').$type<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>(),
  toolCalls: jsonb('tool_calls').$type<
    Array<{
      name: string;
      args: Record<string, unknown>;
      result: unknown;
      duration: number;
    }>
  >(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  errorMessage: text('error_message'),
});

// Service settings - configurable settings for the service
export const serviceSettings = pgTable('service_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  description: text('description'),
  category: text('category').notNull().default('general'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// MCP Server configurations
export const mcpServers = pgTable('mcp_servers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  url: text('url').notNull(),
  apiKey: text('api_key'),
  enabled: boolean('enabled').notNull().default(true),
  capabilities: jsonb('capabilities').$type<string[]>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Model analytics - tracks model performance and usage
export const modelAnalytics = pgTable('model_analytics', {
  id: uuid('id').defaultRandom().primaryKey(),
  modelName: text('model_name').notNull(),
  executionId: uuid('execution_id')
    .references(() => agentExecutions.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  responseTimeMs: integer('response_time_ms').notNull(),
  success: boolean('success').notNull().default(true),
  errorType: text('error_type'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    messages: many(messages),
    executions: many(agentExecutions),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const agentExecutionsRelations = relations(
  agentExecutions,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [agentExecutions.conversationId],
      references: [conversations.id],
    }),
    parentExecution: one(agentExecutions, {
      fields: [agentExecutions.parentExecutionId],
      references: [agentExecutions.id],
    }),
  }),
);

// Cron Jobs table - scheduled tasks
export const cronJobs = pgTable('cron_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  prompt: text('prompt').notNull(),
  
  // Schedule Configuration
  scheduleType: text('schedule_type').notNull(), // 'cron' | 'once' | 'recurring'
  cronExpression: text('cron_expression'), // For cron type: "0 9 * * 5"
  scheduledAt: timestamp('scheduled_at'), // For 'once' type
  recurringPattern: text('recurring_pattern'), // 'daily', 'weekly', 'monthly', etc.
  recurringDay: integer('recurring_day'), // Day of week (0-6) or day of month (1-31)
  recurringTime: text('recurring_time'), // Time in HH:MM format
  timezone: text('timezone').default('UTC'),
  
  // Status
  enabled: boolean('enabled').default(true),
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at'),
  runCount: integer('run_count').default(0),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Job Executions table - execution history
export const jobExecutions = pgTable('job_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => cronJobs.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  status: text('status').notNull().default('running'), // 'running', 'completed', 'failed'
  result: text('result'),
  error: text('error'),
  executionTimeMs: integer('execution_time_ms'),
});

// Cron Jobs Relations
export const cronJobsRelations = relations(cronJobs, ({ one, many }) => ({
  user: one(users, {
    fields: [cronJobs.userId],
    references: [users.id],
  }),
  executions: many(jobExecutions),
}));

export const jobExecutionsRelations = relations(jobExecutions, ({ one }) => ({
  job: one(cronJobs, {
    fields: [jobExecutions.jobId],
    references: [cronJobs.id],
  }),
  user: one(users, {
    fields: [jobExecutions.userId],
    references: [users.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type AgentExecution = typeof agentExecutions.$inferSelect;
export type NewAgentExecution = typeof agentExecutions.$inferInsert;
export type ServiceSetting = typeof serviceSettings.$inferSelect;
export type NewServiceSetting = typeof serviceSettings.$inferInsert;
export type McpServer = typeof mcpServers.$inferSelect;
export type NewMcpServer = typeof mcpServers.$inferInsert;
export type ModelAnalytic = typeof modelAnalytics.$inferSelect;
export type NewModelAnalytic = typeof modelAnalytics.$inferInsert;
export type CronJob = typeof cronJobs.$inferSelect;
export type NewCronJob = typeof cronJobs.$inferInsert;
export type JobExecution = typeof jobExecutions.$inferSelect;
export type NewJobExecution = typeof jobExecutions.$inferInsert;

// ============================================================================
// MEMORY SYSTEM TABLES
// ============================================================================

// Memory Tags - categories for organizing memories
export const memoryTags = pgTable('memory_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  color: text('color'),  // Hex color for UI (#4CAF50)
  icon: text('icon'),    // Icon identifier
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Memories - core memory storage with vector embeddings
export const memories = pgTable('memories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Content
  content: text('content').notNull(),
  summary: text('summary'),  // Brief summary for context injection

  // Vector embedding for semantic search (384 dims for nomic-embed-text)
  embedding: vector('embedding'),

  // Date handling
  eventDate: date('event_date'),           // When the event occurs
  eventDateEnd: date('event_date_end'),    // End of date range (optional)
  expiryDate: date('expiry_date'),         // Auto-archive after this date
  relevanceDaysBefore: integer('relevance_days_before').default(1),

  // Status & priority
  isActive: boolean('is_active').default(true).notNull(),
  priority: integer('priority').default(5),  // 1-10 scale

  // Metadata
  source: text('source').default('agent').notNull(),  // 'agent', 'user', 'system'
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Memory Tag Assignments - many-to-many junction table
export const memoryTagAssignments = pgTable('memory_tag_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  memoryId: uuid('memory_id')
    .notNull()
    .references(() => memories.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id')
    .notNull()
    .references(() => memoryTags.id, { onDelete: 'cascade' }),
});

// Memory Relations
export const memoryTagsRelations = relations(memoryTags, ({ many }) => ({
  assignments: many(memoryTagAssignments),
}));

export const memoriesRelations = relations(memories, ({ one, many }) => ({
  user: one(users, {
    fields: [memories.userId],
    references: [users.id],
  }),
  tagAssignments: many(memoryTagAssignments),
}));

export const memoryTagAssignmentsRelations = relations(
  memoryTagAssignments,
  ({ one }) => ({
    memory: one(memories, {
      fields: [memoryTagAssignments.memoryId],
      references: [memories.id],
    }),
    tag: one(memoryTags, {
      fields: [memoryTagAssignments.tagId],
      references: [memoryTags.id],
    }),
  }),
);

// Add memories relation to users
export const usersMemoriesRelation = relations(users, ({ many }) => ({
  memories: many(memories),
}));

// Memory Type Exports
export type MemoryTag = typeof memoryTags.$inferSelect;
export type NewMemoryTag = typeof memoryTags.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type MemoryTagAssignment = typeof memoryTagAssignments.$inferSelect;
export type NewMemoryTagAssignment = typeof memoryTagAssignments.$inferInsert;
