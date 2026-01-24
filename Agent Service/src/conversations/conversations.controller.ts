import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard, CurrentUser, JwtPayload } from '../auth';
import {
  CreateConversationSchema,
  UpdateConversationSchema,
  CreateConversation,
  UpdateConversation,
} from '../agent/schemas';
import { ZodError } from 'zod';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all conversations' })
  @ApiQuery({ name: 'userId', required: false, type: 'string' })
  async findAll(@Query('userId') userId?: string) {
    const conversations = await this.conversationsService.findAll(userId);
    return { success: true, data: conversations };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  async findOne(@Param('id') id: string) {
    const conversation = await this.conversationsService.findOne(id);
    return { success: true, data: conversation };
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  async getMessages(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const { conversation, messages } = await this.conversationsService.findWithMessages(id);
    return {
      success: true,
      data: {
        conversation,
        messages,
      },
    };
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Get agent executions for a conversation' })
  @ApiParam({ name: 'id', type: 'string' })
  async getExecutions(@Param('id') id: string) {
    const { conversation, executions } = await this.conversationsService.findWithExecutions(id);
    return {
      success: true,
      data: {
        conversation,
        executions,
      },
    };
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get a summary of a conversation' })
  @ApiParam({ name: 'id', type: 'string' })
  async getSummary(@Param('id') id: string) {
    const summary = await this.conversationsService.summarizeConversation(id);
    return { success: true, data: { summary } };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  async create(@Body() body: CreateConversation) {
    try {
      const validated = CreateConversationSchema.parse(body);
      const conversation = await this.conversationsService.create(validated);
      return { success: true, data: conversation };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpException(
          { success: false, message: 'Validation error', errors: error.errors },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a conversation' })
  @ApiParam({ name: 'id', type: 'string' })
  async update(@Param('id') id: string, @Body() body: UpdateConversation) {
    try {
      const validated = UpdateConversationSchema.parse(body);
      const conversation = await this.conversationsService.update(id, validated);
      return { success: true, data: conversation };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpException(
          { success: false, message: 'Validation error', errors: error.errors },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'id', type: 'string' })
  async delete(@Param('id') id: string) {
    await this.conversationsService.delete(id);
    return { success: true, message: 'Conversation deleted' };
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a conversation' })
  @ApiParam({ name: 'id', type: 'string' })
  async archive(@Param('id') id: string) {
    const conversation = await this.conversationsService.archive(id);
    return { success: true, data: conversation };
  }
}
