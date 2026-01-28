# Agent Memory System Implementation Plan

## ✅ IMPLEMENTATION STATUS: COMPLETE

All core components have been implemented:

- [x] Database schema with pgvector support (`src/database/schema.ts`)
- [x] MemoryService with CRUD + RAG search (`src/memory/memory.service.ts`)
- [x] Memory tools for agent use (`src/memory/memory-tools.service.ts`)
- [x] Tool registration in ToolExecutorService
- [x] Proactive memory injection in AgentService system prompt
- [x] Docker Compose updated to use pgvector image
- [x] Seed script for default tags (`scripts/seed-memory.ts`)

### Setup Instructions

```bash
# 1. Pull embedding model
ollama pull nomic-embed-text

# 2. Restart postgres with pgvector (if running)
docker compose down && docker compose up -d

# 3. Apply schema and seed tags
npm run setup
```

---

## Overview

A 3-part memory system that provides the AI agent with persistent, searchable memory capabilities:

1. **Proactive Date-Relevant Memories** - Automatically included based on event dates
2. **RAG Semantic Search** - Agent can search memories by meaning
3. **Agent Memory Tools** - Create, edit, delete memories (hidden from users)

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Memory System                                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │   Memory Tags   │  │    Memories     │  │   Embeddings    │        │
│  │  (PostgreSQL)   │  │  (PostgreSQL)   │  │  (pgvector)     │        │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘        │
│           │                    │                    │                  │
│           └────────────────────┼────────────────────┘                  │
│                                │                                        │
│  ┌─────────────────────────────▼─────────────────────────────┐        │
│  │                     MemoryService                          │        │
│  │  - createMemory()     - searchMemories()                   │        │
│  │  - updateMemory()     - getDateRelevantMemories()         │        │
│  │  - deleteMemory()     - generateEmbedding()               │        │
│  └────────────────────────────┬──────────────────────────────┘        │
│                               │                                        │
│  ┌────────────────────────────▼──────────────────────────────┐        │
│  │                      Memory Tools                          │        │
│  │  - save_memory      - search_memories                      │        │
│  │  - update_memory    - delete_memory                        │        │
│  └────────────────────────────────────────────────────────────┘        │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### 1. Memory Tags Table

```sql
CREATE TABLE memory_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,         -- 'health', 'goals', 'food', 'events', etc.
  description TEXT,
  color TEXT,                         -- For UI display (#4CAF50)
  icon TEXT,                          -- Icon identifier
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Memories Table

```sql
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Core content
  content TEXT NOT NULL,              -- The memory description
  summary TEXT,                       -- Short summary for context injection

  -- Embeddings for RAG (using pgvector)
  embedding VECTOR(384),              -- nomic-embed-text produces 384 dimensions

  -- Tags (many-to-many via junction table)

  -- Date handling
  event_date DATE,                    -- When the event occurs/occurred
  event_date_end DATE,                -- For date ranges
  expiry_date DATE,                   -- When to auto-delete/archive
  relevance_days_before INTEGER DEFAULT 0,  -- Days before event to start mentioning

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 5,         -- 1-10 scale for context ordering

  -- Metadata
  source TEXT,                        -- 'agent', 'user', 'system'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX memories_user_idx ON memories(user_id);
CREATE INDEX memories_event_date_idx ON memories(event_date);
CREATE INDEX memories_expiry_idx ON memories(expiry_date);
CREATE INDEX memories_active_idx ON memories(is_active);
CREATE INDEX memories_embedding_idx ON memories USING ivfflat (embedding vector_cosine_ops);
```

### 3. Memory Tags Junction Table

```sql
CREATE TABLE memory_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES memory_tags(id) ON DELETE CASCADE,
  UNIQUE(memory_id, tag_id)
);

CREATE INDEX memory_tags_memory_idx ON memory_tag_assignments(memory_id);
CREATE INDEX memory_tags_tag_idx ON memory_tag_assignments(tag_id);
```

---

## Default Tags (Seeded)

| Tag      | Description                                                   | Color   |
| -------- | ------------------------------------------------------------- | ------- |
| health   | Health-related memories (appointments, symptoms, medications) | #4CAF50 |
| goals    | Personal goals, aspirations, targets                          | #2196F3 |
| food     | Dietary preferences, recipes, meal plans                      | #FF9800 |
| events   | Calendar events, meetings, deadlines                          | #9C27B0 |
| people   | Information about contacts, relationships                     | #E91E63 |
| work     | Work-related tasks, projects, notes                           | #607D8B |
| finance  | Financial goals, expenses, reminders                          | #795548 |
| learning | Things to learn, courses, skills                              | #00BCD4 |
| personal | General personal notes                                        | #9E9E9E |
| reminder | Time-sensitive reminders                                      | #F44336 |

---

## Memory Service Methods

### Core CRUD

```typescript
// Create a memory with embedding generation
createMemory(userId: string, data: {
  content: string;
  summary?: string;
  tags: string[];              // Tag names
  eventDate?: Date;
  eventDateEnd?: Date;
  expiryDate?: Date;
  relevanceDaysBefore?: number;
  priority?: number;
  source: 'agent' | 'user' | 'system';
}): Promise<Memory>

// Update memory (re-generates embedding if content changed)
updateMemory(memoryId: string, userId: string, updates: Partial<Memory>): Promise<Memory>

// Soft delete (sets is_active = false)
deleteMemory(memoryId: string, userId: string): Promise<void>

// Hard delete expired memories (scheduled job)
purgeExpiredMemories(): Promise<number>
```

### Search & Retrieval

```typescript
// RAG semantic search using embeddings
searchMemories(userId: string, query: string, options?: {
  limit?: number;           // Default 10
  tags?: string[];          // Filter by tags
  minSimilarity?: number;   // Default 0.7
  includeExpired?: boolean; // Default false
}): Promise<Memory[]>

// Get date-relevant memories (for proactive inclusion)
getDateRelevantMemories(userId: string, referenceDate?: Date): Promise<Memory[]>
// Returns memories where:
// - event_date - relevance_days_before <= referenceDate <= event_date (or event_date_end)
// - is_active = true
// - expiry_date is null or > referenceDate

// Get all memories for a user (with pagination)
listMemories(userId: string, options?: {
  limit?: number;
  offset?: number;
  tags?: string[];
  sortBy?: 'created_at' | 'event_date' | 'priority';
}): Promise<Memory[]>
```

### Embedding Generation

```typescript
// Generate embedding using Ollama's nomic-embed-text model
generateEmbedding(text: string): Promise<number[]>
// Uses: POST /api/embed with model "nomic-embed-text"
```

---

## Agent Tools

### 1. `save_memory`

```typescript
{
  name: 'save_memory',
  description: `Save important information to your long-term memory. Use this to remember:
- User preferences, habits, and personal details
- Future intentions (meetings, tasks, goals with deadlines)
- Important dates (birthdays, appointments, deadlines)
- Context that would be useful in future conversations
ALWAYS set event_date for time-sensitive memories!`,
  parameters: {
    content: { type: 'string', description: 'Detailed memory content', required: true },
    summary: { type: 'string', description: 'Brief 1-line summary for quick reference' },
    tags: { type: 'array', description: 'Tags: health, goals, food, events, people, work, finance, learning, personal, reminder', required: true },
    eventDate: { type: 'string', description: 'ISO date for when this event occurs (YYYY-MM-DD)' },
    eventDateEnd: { type: 'string', description: 'ISO date for end of date range' },
    expiryDate: { type: 'string', description: 'ISO date when this memory should be deleted' },
    relevanceDaysBefore: { type: 'number', description: 'Days before event_date to start proactively mentioning (default: 1)' },
    priority: { type: 'number', description: 'Priority 1-10 (10 = most important)' },
  }
}
```

### 2. `search_memories`

```typescript
{
  name: 'search_memories',
  description: 'Search your memory for relevant past information. Use semantic search to find memories by meaning.',
  parameters: {
    query: { type: 'string', description: 'What to search for', required: true },
    tags: { type: 'array', description: 'Filter by specific tags (optional)' },
    limit: { type: 'number', description: 'Max results (default: 5)' },
  }
}
```

### 3. `update_memory`

```typescript
{
  name: 'update_memory',
  description: 'Update an existing memory. Use to correct information or update expiry/dates.',
  parameters: {
    memoryId: { type: 'string', description: 'The memory ID to update', required: true },
    content: { type: 'string', description: 'New content (optional)' },
    summary: { type: 'string', description: 'New summary (optional)' },
    tags: { type: 'array', description: 'New tags (optional, replaces all)' },
    eventDate: { type: 'string', description: 'New event date' },
    expiryDate: { type: 'string', description: 'New expiry date (set to "clear" to remove)' },
    isActive: { type: 'boolean', description: 'Set to false to deactivate' },
  }
}
```

### 4. `delete_memory`

```typescript
{
  name: 'delete_memory',
  description: 'Delete a memory that is no longer relevant or is incorrect.',
  parameters: {
    memoryId: { type: 'string', description: 'The memory ID to delete', required: true },
    reason: { type: 'string', description: 'Why this memory is being deleted' },
  }
}
```

---

## Context Injection Flow

When a prompt comes in, the agent receives context in this order:

```
1. SYSTEM PROMPT (existing)
2. PROACTIVE MEMORIES (date-relevant)
   ┌─────────────────────────────────────────────────────┐
   │ 📌 UPCOMING EVENTS & REMINDERS:                     │
   │                                                     │
   │ [ID: abc123] Event Date: 2026-01-28                │
   │ Tags: #events #health                               │
   │ Doctor appointment at 3pm tomorrow                  │
   │                                                     │
   │ [ID: def456] Event Date: 2026-02-01                │
   │ Tags: #goals #personal                              │
   │ New Year resolution check-in due                    │
   └─────────────────────────────────────────────────────┘
3. CONVERSATION HISTORY (existing - last 20 messages)
4. USER PROMPT
```

---

## System Prompt Additions

```
MEMORY SYSTEM:
You have access to a persistent memory system. USE IT ACTIVELY!

WHEN TO SAVE MEMORIES:
- User mentions future events → Save with event_date + relevance_days_before
- User shares preferences → Save to remember for later
- User sets goals or intentions → Save with tags: [goals]
- User mentions people → Save details with tags: [people]
- Important dates mentioned → Save with event_date

MEMORY EXAMPLES:
1. User: "My mom's birthday is March 15th"
   → save_memory(content: "User's mother's birthday is March 15th",
                 tags: ["people", "events"],
                 eventDate: "2026-03-15",
                 relevanceDaysBefore: 7)

2. User: "I have a job interview next Tuesday at 2pm"
   → save_memory(content: "Job interview scheduled for Tuesday Jan 28 at 2pm",
                 summary: "Job interview 2pm",
                 tags: ["events", "work"],
                 eventDate: "2026-01-28",
                 relevanceDaysBefore: 1,
                 priority: 9)

3. User: "I'm trying to eat less sugar"
   → save_memory(content: "User is trying to reduce sugar intake as a health goal",
                 tags: ["health", "goals", "food"])

REVIEWING MEMORIES:
- If proactive memories are provided, acknowledge relevant ones naturally
- Search memories when user asks about past discussions
- Delete outdated memories when you notice they're no longer relevant

IMPORTANT: Memory operations are INVISIBLE to the user. They are processed but
NOT displayed in your response. Just include the tool call and proceed normally.
```

---

## Implementation Files

```
Agent Service/src/
├── memory/
│   ├── memory.module.ts          # NestJS module
│   ├── memory.service.ts         # Core memory operations
│   ├── memory.controller.ts      # REST API (optional, for admin)
│   └── memory-tools.service.ts   # Agent tool implementations
├── database/
│   └── schema.ts                 # + memory tables (pgvector)
└── tools/
    └── tool-executor.service.ts  # + memory tools registration
```

---

## pgvector Setup

### 1. Enable Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Docker Compose Update

```yaml
postgres:
  image: pgvector/pgvector:pg16 # Use pgvector image instead of postgres:16-alpine
```

### 3. Drizzle Custom Type

```typescript
import { customType } from "drizzle-orm/pg-core";

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(384)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value.replace(/^\[/, "[").replace(/]$/, "]"));
  },
});
```

---

## Ollama Embedding Model

Add embedding generation to OllamaService:

```typescript
async generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${this.baseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      input: text,
    }),
  });

  const data = await response.json();
  return data.embeddings[0]; // Returns 384-dimension vector
}
```

### Pull the embedding model

```bash
ollama pull nomic-embed-text
```

---

## Migration Steps

1. **Update Docker Compose** - Use pgvector image
2. **Add pgvector extension** - Run CREATE EXTENSION
3. **Update schema.ts** - Add memory tables with vector type
4. **Run db:push** - Apply schema changes
5. **Seed tags** - Insert default memory tags
6. **Create memory module** - Service + tools
7. **Register memory tools** - In tool-executor
8. **Update agent service** - Inject proactive memories
9. **Update system prompt** - Add memory instructions

---

## Phase 2 Considerations (Future)

- Memory importance decay over time
- Automatic memory consolidation (merge similar memories)
- Memory categories (episodic vs semantic)
- User-facing memory management UI
- Memory export/import
- Cross-user shared memories (for team contexts)

---

## Testing Checklist

- [ ] Create memory with all fields
- [ ] Semantic search finds relevant memories
- [ ] Date-relevant memories appear in context
- [ ] Update memory re-generates embedding
- [ ] Delete memory removes from search
- [ ] Expired memories are purged
- [ ] Agent uses memory tools naturally
- [ ] Memory operations are hidden from user output
