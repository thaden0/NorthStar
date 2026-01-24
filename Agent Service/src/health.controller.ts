import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  health() {
    return {
      status: 'ok',
      service: 'agent-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Service info' })
  info() {
    return {
      name: 'Agent Service',
      version: '1.0.0',
      description: 'AI Agent Microservice with LangGraph, Vercel AI SDK, and Multi-Agent Support',
      endpoints: {
        chat: 'POST /chat - Start a conversation with the AI agent',
        stream: 'GET /chat/:conversationId/stream - SSE stream for agent updates',
        users: '/users - User management CRUD',
        conversations: '/conversations - Conversation management CRUD',
        settings: '/settings - Service settings and Ollama model management',
        health: 'GET /health - Health check',
      },
    };
  }
}
