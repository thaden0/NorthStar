import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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
