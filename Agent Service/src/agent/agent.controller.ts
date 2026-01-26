import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Headers,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { JwtAuthGuard, CurrentUser, JwtPayload } from '../auth';
import { ChatRequestSchema, ChatRequest, SSEEvent } from './schemas';
import { ZodError } from 'zod';

@ApiTags('Agent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(private agentService: AgentService) {}

  @Post('chat')
  @ApiOperation({
    summary: 'Start a chat with the AI agent',
    description:
      'Initiates an agent conversation. Returns immediately with conversation ID. Use the SSE endpoint to receive updates.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['prompt', 'userId'],
      properties: {
        prompt: { type: 'string', description: 'The user prompt' },
        userId: { type: 'string', description: 'External user ID' },
        conversationId: {
          type: 'string',
          format: 'uuid',
          description: 'Existing conversation ID to continue',
        },
        sseResponseIp: {
          type: 'string',
          description: 'IP address for SSE response delivery',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata',
        },
        ragOptions: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            sourceGroupIds: { type: 'array', items: { type: 'string' } },
            maxChunks: { type: 'number' },
          },
        },
      },
    },
  })
  async chat(
    @Body() body: ChatRequest,
    @CurrentUser() user: JwtPayload,
    @Headers('authorization') authHeader?: string,
  ) {
    try {
      // Validate request
      const validated = ChatRequestSchema.parse(body);

      this.logger.log(`Chat request from user ${validated.userId}`);

      // Extract token from header (remove "Bearer " prefix if present)
      const token = authHeader?.replace(/^Bearer\s+/i, '') || '';

      const { conversationId } = await this.agentService.processChat(validated, token);

      // If SSE endpoint is specified, client will connect there
      // Otherwise, return conversation ID for polling
      return {
        success: true,
        conversationId,
        message: 'Agent processing started. Connect to SSE endpoint or poll for results.',
        sseEndpoint: `/chat/${conversationId}/stream`,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpException(
          {
            success: false,
            message: 'Validation error',
            errors: error.errors,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  @Get('chat/:conversationId/stream')
  @ApiOperation({
    summary: 'SSE stream for agent updates',
    description:
      'Server-Sent Events stream for receiving real-time agent updates including status messages, tool executions, and final responses.',
  })
  @ApiParam({
    name: 'conversationId',
    type: 'string',
    description: 'The conversation ID to stream',
  })
  async streamChat(
    @Param('conversationId') conversationId: string,
    @Res() res: Response,
    @CurrentUser() user: JwtPayload,
  ) {
    this.logger.log(`SSE stream requested for conversation ${conversationId}`);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emitter = this.agentService.getEventEmitter(conversationId);

    if (!emitter) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Conversation not found or completed', timestamp: new Date().toISOString() })}\n\n`);
      res.end();
      return;
    }

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', conversationId, timestamp: new Date().toISOString() })}\n\n`);

    // Setup heartbeat
    const heartbeatInterval = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 15000);

    // Event handler
    const eventHandler = (event: SSEEvent) => {
      this.logger.debug(`SSE writing event: ${event.type}`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // Clean up on completion or error
      if (event.type === 'complete' || event.type === 'error') {
        this.logger.log(`SSE stream complete for: ${conversationId}`);
        clearInterval(heartbeatInterval);
        emitter.removeListener('event', eventHandler);
        this.agentService.removeEventEmitter(conversationId);
        res.end();
      }
    };

    emitter.on('event', eventHandler);

    // Handle client disconnect
    res.on('close', () => {
      clearInterval(heartbeatInterval);
      emitter.removeListener('event', eventHandler);
      this.logger.log(`Client disconnected from SSE stream: ${conversationId}`);
    });
  }
}
