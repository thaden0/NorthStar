import { z } from 'zod';

// ============ Chat Request/Response Schemas ============

export const ChatRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  userId: z.string().min(1, 'User ID is required'),
  conversationId: z.string().uuid().optional(),
  sseResponseIp: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  // RAG options (for future extension)
  ragOptions: z
    .object({
      enabled: z.boolean().optional(),
      sourceGroupIds: z.array(z.string()).optional(),
      maxChunks: z.number().optional(),
    })
    .optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  content: z.string(),
  status: z.enum(['complete', 'streaming', 'error']),
  toolCalls: z
    .array(
      z.object({
        name: z.string(),
        args: z.record(z.unknown()),
        result: z.unknown().optional(),
      }),
    )
    .optional(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ============ SSE Event Schemas ============

export const SSEEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('status'),
    message: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('thinking'),
    thought: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('tool_start'),
    toolName: z.string(),
    toolArgs: z.record(z.unknown()),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('tool_result'),
    toolName: z.string(),
    result: z.unknown(),
    summary: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('content'),
    content: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('complete'),
    conversationId: z.string(),
    messageId: z.string(),
    finalContent: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('error'),
    error: z.string(),
    timestamp: z.string(),
  }),
  // Widget events
  z.object({
    type: z.literal('widget_open'),
    widgetId: z.string(),
    widgetType: z.enum(['email_send', 'email_read', 'calendar', 'contacts']),
    widgetData: z.record(z.unknown()),
    canCancel: z.boolean().optional(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('widget_update'),
    widgetId: z.string(),
    widgetData: z.record(z.unknown()),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal('widget_close'),
    widgetId: z.string(),
    timestamp: z.string(),
  }),
]);

export type SSEEvent = z.infer<typeof SSEEventSchema>;

// ============ Agent State Schemas ============

export const AgentMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  toolName: z.string().optional(),
  toolCallId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const AgentStateSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string(),
  messages: z.array(AgentMessageSchema),
  currentPrompt: z.string(),
  status: z.enum(['thinking', 'executing', 'waiting', 'complete', 'error']),
  pendingToolCalls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        args: z.record(z.unknown()),
      }),
    )
    .optional(),
  subAgentResults: z
    .array(
      z.object({
        task: z.string(),
        result: z.string(),
        summary: z.string(),
      }),
    )
    .optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

// ============ Tool Definition Schemas ============

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// ============ User/Conversation CRUD Schemas ============

export const CreateUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export const CreateConversationSchema = z.object({
  userId: z.string().min(1),
  title: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateConversation = z.infer<typeof CreateConversationSchema>;

export const UpdateConversationSchema = z.object({
  title: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateConversation = z.infer<typeof UpdateConversationSchema>;

// ============ Settings Schemas ============

export const ServiceSettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  description: z.string().optional(),
  category: z.string().optional(),
});

export type ServiceSettingInput = z.infer<typeof ServiceSettingSchema>;

export const UpdateServiceSettingSchema = z.object({
  value: z.unknown(),
  description: z.string().optional(),
  category: z.string().optional(),
});

export type UpdateServiceSettingInput = z.infer<typeof UpdateServiceSettingSchema>;

// ============ MCP Server Schemas ============

export const CreateMcpServerSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  apiKey: z.string().optional(),
  enabled: z.boolean().optional(),
  capabilities: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateMcpServer = z.infer<typeof CreateMcpServerSchema>;

export const UpdateMcpServerSchema = z.object({
  url: z.string().url().optional(),
  apiKey: z.string().optional(),
  enabled: z.boolean().optional(),
  capabilities: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateMcpServer = z.infer<typeof UpdateMcpServerSchema>;
