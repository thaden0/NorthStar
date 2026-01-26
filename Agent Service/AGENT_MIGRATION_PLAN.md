# Agent Tool System Migration Plan

## Overview

Migrate the Agent Service from Vercel AI SDK structured tool calling to a text-based tool parsing system (like TrackingAgent) for better compatibility with local Ollama models.

## Goals

1. ✅ Full compatibility with smaller Ollama models (llama3.2, etc.)
2. ✅ Professional, production-quality architecture
3. ✅ Extensible design for adding new tools and providers
4. ✅ Backward compatible - can still use structured tools for API providers (OpenAI, Anthropic)
5. ✅ Clear separation of concerns

## Architecture Components

### 1. ToolParser Service (`src/tools/tool-parser.service.ts`)

Responsible for extracting tool calls from LLM text output.

**Features:**

- Parse JSON from markdown code blocks
- Parse raw JSON from text (fallback)
- Validate tool call structure
- Return list of parsed tool calls with confidence scores

### 2. ToolExecutor Service (`src/tools/tool-executor.service.ts`)

Responsible for executing parsed tool calls.

**Features:**

- Registry of available tools
- Execute tool by name with arguments
- Return consistent result format
- Handle execution errors gracefully

### 3. Updated System Prompt

Tell the model exactly how to output tool calls.

**Format:**

```
To use a tool, output a JSON block like this:
{"tool": "tool_name", "arguments": {"arg1": "value1"}}
```

### 4. AgentService Loop Refactor

Use TrackingAgent's proven pattern:

1. Stream LLM response
2. Parse tool calls from text
3. Execute tools
4. Build context with results
5. Continue conversation until complete

### 5. LLM Provider Abstraction (`src/llm/provider.interface.ts`)

Abstract the LLM interaction for future provider support.

**Providers:**

- Ollama (local, text-based tools)
- OpenAI (structured tools)
- Anthropic (structured tools)

## File Changes

### New Files:

1. `src/tools/tool-parser.service.ts` - Parse tool calls from text
2. `src/tools/tool-executor.service.ts` - Execute tools by name
3. `src/tools/tool-registry.ts` - Tool definitions and metadata

### Modified Files:

1. `src/tools/tools.module.ts` - Add new services
2. `src/llm/ollama.service.ts` - Add rawChat methods ✅ DONE
3. `src/agent/agent.service.ts` - New agentic loop
4. `src/agent/agent-tools.service.ts` - Adapt for new system

## Implementation Order

1. Create ToolParser service
2. Create ToolExecutor service
3. Update system prompt with tool format instructions
4. Refactor AgentService.runAgent() to use new pattern
5. Test with llama3.2
6. Clean up old code

## Risk Mitigation

- Keep old generate() method for potential API provider support
- Add logging throughout for debugging
- Graceful error handling at each layer
- Unit tests for tool parsing
