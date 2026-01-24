# Agent Service

A professional AI Agent microservice built with **NestJS**, **LangGraph**, **Vercel AI SDK**, and **Playwright**. This service provides intelligent agent capabilities with recursive sub-agent support, web browsing, news search, and real-time streaming responses.

## 🚀 Features

- **AI Agent Chat**: Intelligent conversational AI with tool-calling capabilities
- **Recursive Sub-Agents**: Complex tasks can be delegated to sub-agents for parallel processing
- **Web Browsing**: Browse and extract content from web pages using Playwright
- **News Search**: Search and fetch news articles via Google News
- **Real-time Streaming**: Server-Sent Events (SSE) for real-time agent status updates
- **MCP Server Support**: Extensible with Model Context Protocol servers
- **JWT Authentication**: Secure server-to-server authentication
- **Full CRUD APIs**: Users, Conversations, Settings, and MCP Servers

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Ollama (with qwen3 model by default)
- Docker & Docker Compose (optional)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
cd agent-service
npm install
```

### 2. Install Playwright Browsers

```bash
npx playwright install chromium
```

### 3. Configure Environment

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/agent_service

# JWT Configuration (Server-to-Server)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ISSUER=your-issuing-service
JWT_AUDIENCE=agent-service

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=qwen3

# Server Configuration
PORT=3001
```

### 4. Database Setup

```bash
# Push schema to database
npm run db:push
```

### 5. Start the Service

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## 🐳 Docker Deployment

```bash
# Start with Docker Compose
docker compose up -d

# View logs
docker compose logs -f agent-service
```

## 🔐 Authentication

This service uses JWT for server-to-server authentication. **No user login is required** - tokens are validated against the configured secret, issuer, and audience.

### Generating JWT Tokens

The consuming service should generate JWT tokens with the following structure:

```typescript
// Token payload
{
  "sub": "user-id-123",           // Required: User/service identifier
  "email": "service@example.com",  // Optional
  "name": "Service Name",          // Optional
  "iat": 1706112000,              // Issued at
  "exp": 1706198400,              // Expiration
  "iss": "your-issuing-service",  // Must match JWT_ISSUER
  "aud": "agent-service"          // Must match JWT_AUDIENCE
}
```

### Example Token Generation (Node.js)

```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  {
    sub: 'user-123',
    email: 'user@example.com',
    name: 'John Doe',
  },
  process.env.JWT_SECRET, // Same secret as agent service
  {
    expiresIn: '24h',
    issuer: 'your-issuing-service', // JWT_ISSUER
    audience: 'agent-service',       // JWT_AUDIENCE
  }
);

// Use in requests
headers: {
  'Authorization': `Bearer ${token}`
}
```

## 📡 API Reference

### Primary Endpoint: `/chat`

Start a conversation with the AI agent.

**POST /chat**

```bash
curl -X POST http://localhost:3001/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What are the latest technology news headlines?",
    "userId": "user-123",
    "conversationId": "optional-existing-conversation-id",
    "sseResponseIp": "optional-client-ip-for-sse"
  }'
```

**Response:**

```json
{
  "success": true,
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Agent processing started. Connect to SSE endpoint or poll for results.",
  "sseEndpoint": "/chat/550e8400-e29b-41d4-a716-446655440000/stream"
}
```

### SSE Stream: `/chat/:conversationId/stream`

Receive real-time updates from the agent.

**GET /chat/:conversationId/stream**

```bash
curl -X GET http://localhost:3001/chat/550e8400-e29b-41d4-a716-446655440000/stream \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Accept: text/event-stream"
```

**SSE Events:**

| Event Type    | Description                                          |
| ------------- | ---------------------------------------------------- |
| `connected`   | Connection established                               |
| `status`      | Agent status message (e.g., "Browsing: https://...") |
| `thinking`    | Agent thought process                                |
| `tool_start`  | Tool execution started                               |
| `tool_result` | Tool execution completed                             |
| `content`     | Response content chunk                               |
| `complete`    | Agent task completed                                 |
| `error`       | Error occurred                                       |

### Users API

| Method | Endpoint      | Description                            |
| ------ | ------------- | -------------------------------------- |
| GET    | `/users`      | List all users                         |
| GET    | `/users/:id`  | Get user by ID                         |
| POST   | `/users`      | Create user                            |
| PUT    | `/users/:id`  | Update user                            |
| DELETE | `/users/:id`  | Delete user                            |
| POST   | `/users/sync` | Sync/upsert user from external service |

### Conversations API

| Method | Endpoint                        | Description                                |
| ------ | ------------------------------- | ------------------------------------------ |
| GET    | `/conversations`                | List conversations (optional: ?userId=...) |
| GET    | `/conversations/:id`            | Get conversation                           |
| GET    | `/conversations/:id/messages`   | Get conversation messages                  |
| GET    | `/conversations/:id/executions` | Get agent executions                       |
| GET    | `/conversations/:id/summary`    | Get conversation summary                   |
| POST   | `/conversations`                | Create conversation                        |
| PUT    | `/conversations/:id`            | Update conversation                        |
| DELETE | `/conversations/:id`            | Delete conversation                        |
| POST   | `/conversations/:id/archive`    | Archive conversation                       |

### Settings API

| Method | Endpoint                         | Description                                 |
| ------ | -------------------------------- | ------------------------------------------- |
| GET    | `/settings`                      | List all settings (optional: ?category=...) |
| GET    | `/settings/key/:key`             | Get setting by key                          |
| POST   | `/settings`                      | Create setting                              |
| PUT    | `/settings/key/:key`             | Update setting                              |
| DELETE | `/settings/key/:key`             | Delete setting                              |
| GET    | `/settings/ollama/models`        | List available Ollama models                |
| GET    | `/settings/ollama/default-model` | Get default model                           |
| PUT    | `/settings/ollama/default-model` | Set default model                           |
| POST   | `/settings/ollama/pull`          | Pull an Ollama model                        |

### MCP Servers API

| Method | Endpoint                           | Description               |
| ------ | ---------------------------------- | ------------------------- |
| GET    | `/settings/mcp-servers`            | List MCP servers          |
| GET    | `/settings/mcp-servers/:id`        | Get MCP server            |
| POST   | `/settings/mcp-servers`            | Create MCP server         |
| PUT    | `/settings/mcp-servers/:id`        | Update MCP server         |
| DELETE | `/settings/mcp-servers/:id`        | Delete MCP server         |
| POST   | `/settings/mcp-servers/:id/toggle` | Toggle MCP server enabled |

## 🛠️ Agent Tools

The AI agent has access to the following tools:

| Tool                | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `browse_url`        | Browse a web page and extract content, links, and images |
| `search_news`       | Search for news articles on a topic                      |
| `get_top_headlines` | Get latest top news headlines                            |
| `take_screenshot`   | Capture a screenshot of a web page                       |
| `create_subtask`    | Delegate a task to a sub-agent                           |
| `complete_task`     | Mark the current task as complete                        |
| `send_status`       | Send a status message to the user                        |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Service                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   /chat     │  │   /users    │  │ /settings   │         │
│  │  Controller │  │  Controller │  │ Controller  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐         │
│  │   Agent     │  │    Users    │  │  Settings   │         │
│  │   Service   │  │   Service   │  │   Service   │         │
│  └──────┬──────┘  └─────────────┘  └──────┬──────┘         │
│         │                                  │                │
│  ┌──────▼──────┐                   ┌──────▼──────┐         │
│  │   Agent     │                   │   Ollama    │         │
│  │   Tools     │                   │   Service   │         │
│  └──────┬──────┘                   └──────┬──────┘         │
│         │                                  │                │
│  ┌──────▼──────┐  ┌─────────────┐  ┌──────▼──────┐         │
│  │ Playwright  │  │   Google    │  │   Vercel    │         │
│  │   Service   │  │   News      │  │   AI SDK    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                      PostgreSQL                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │
│  │   Users   │ │  Convos   │ │ Messages  │ │ Settings  │   │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Configuration Reference

| Variable               | Default                  | Description                       |
| ---------------------- | ------------------------ | --------------------------------- |
| `DATABASE_URL`         | -                        | PostgreSQL connection string      |
| `JWT_SECRET`           | -                        | JWT signing secret (min 32 chars) |
| `JWT_ISSUER`           | -                        | Expected JWT issuer claim         |
| `JWT_AUDIENCE`         | `agent-service`          | Expected JWT audience claim       |
| `OLLAMA_BASE_URL`      | `http://localhost:11434` | Ollama API URL                    |
| `OLLAMA_DEFAULT_MODEL` | `qwen3`                  | Default LLM model                 |
| `PORT`                 | `3001`                   | Server port                       |
| `PLAYWRIGHT_HEADLESS`  | `true`                   | Run browser headless              |
| `PLAYWRIGHT_TIMEOUT`   | `30000`                  | Browser operation timeout (ms)    |

## 📊 Swagger Documentation

API documentation is available at: `http://localhost:3001/api`

## 🧪 Client Integration Example

```typescript
// Example: TypeScript/Node.js client
import jwt from "jsonwebtoken";

const JWT_SECRET = "your-super-secret-jwt-key-min-32-chars";
const AGENT_SERVICE_URL = "http://localhost:3001";

// Generate token
function generateToken(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, {
    expiresIn: "24h",
    issuer: "your-issuing-service",
    audience: "agent-service",
  });
}

// Chat with agent
async function chatWithAgent(prompt: string, userId: string) {
  const token = generateToken(userId);

  const response = await fetch(`${AGENT_SERVICE_URL}/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, userId }),
  });

  const { conversationId, sseEndpoint } = await response.json();

  // Connect to SSE stream
  const eventSource = new EventSource(`${AGENT_SERVICE_URL}${sseEndpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Event:", data.type, data);

    if (data.type === "complete" || data.type === "error") {
      eventSource.close();
    }
  };

  return conversationId;
}

// Usage
chatWithAgent("What are the latest AI news?", "user-123");
```

## 📄 License

MIT License

## 🤝 Contributing

Contributions welcome! Please read the contributing guidelines before submitting PRs.
