import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GmailService, SendEmailDto, EmailMessage } from './gmail.service';

@ApiTags('Gmail')
@Controller('gmail')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GmailController {
  constructor(private gmailService: GmailService) {}

  @Get('messages')
  @ApiOperation({ summary: 'List emails' })
  @ApiQuery({ name: 'query', required: false, description: 'Gmail search query' })
  @ApiQuery({ name: 'maxResults', required: false, type: Number })
  @ApiQuery({ name: 'pageToken', required: false })
  @ApiResponse({ status: 200, description: 'List of emails' })
  async listEmails(
    @Req() req: any,
    @Query('query') query?: string,
    @Query('maxResults') maxResults?: number,
    @Query('pageToken') pageToken?: string,
  ) {
    return this.gmailService.listEmails(req.user.userId, {
      query,
      maxResults: maxResults ? parseInt(String(maxResults)) : undefined,
      pageToken,
    });
  }

  @Get('messages/:id')
  @ApiOperation({ summary: 'Get a single email' })
  @ApiResponse({ status: 200, description: 'Email details' })
  async getEmail(@Req() req: any, @Param('id') messageId: string) {
    return this.gmailService.getEmail(req.user.userId, messageId);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send an email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', example: 'recipient@example.com' },
        subject: { type: 'string', example: 'Hello' },
        body: { type: 'string', example: 'Email body content' },
        replyToMessageId: { type: 'string', required: ['false'] },
      },
      required: ['to', 'subject', 'body'],
    },
  })
  @ApiResponse({ status: 201, description: 'Email sent' })
  async sendEmail(@Req() req: any, @Body() dto: SendEmailDto) {
    return this.gmailService.sendEmail(req.user.userId, dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search emails' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'maxResults', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchEmails(
    @Req() req: any,
    @Query('q') query: string,
    @Query('maxResults') maxResults?: number,
  ) {
    const messages = await this.gmailService.searchEmails(
      req.user.userId,
      query,
      maxResults ? parseInt(String(maxResults)) : 20,
    );
    return { messages };
  }

  @Patch('messages/:id/read')
  @ApiOperation({ summary: 'Mark email as read' })
  async markAsRead(@Req() req: any, @Param('id') messageId: string) {
    await this.gmailService.markAsRead(req.user.userId, messageId);
    return { success: true };
  }

  @Patch('messages/:id/unread')
  @ApiOperation({ summary: 'Mark email as unread' })
  async markAsUnread(@Req() req: any, @Param('id') messageId: string) {
    await this.gmailService.markAsUnread(req.user.userId, messageId);
    return { success: true };
  }

  @Patch('messages/:id/star')
  @ApiOperation({ summary: 'Toggle star on email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { starred: { type: 'boolean' } },
    },
  })
  async toggleStar(
    @Req() req: any,
    @Param('id') messageId: string,
    @Body('starred') starred: boolean,
  ) {
    await this.gmailService.toggleStar(req.user.userId, messageId, starred);
    return { success: true };
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Trash email' })
  async trashEmail(@Req() req: any, @Param('id') messageId: string) {
    await this.gmailService.trashEmail(req.user.userId, messageId);
    return { success: true };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread email count' })
  async getUnreadCount(@Req() req: any) {
    const count = await this.gmailService.getUnreadCount(req.user.userId);
    return { count };
  }
}
