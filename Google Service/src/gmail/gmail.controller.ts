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
import { GmailService, SendEmailDto } from './gmail.service';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email?: string;
  };
}

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
  @ApiQuery({ name: 'accountEmail', required: false, description: 'Specific account email to use' })
  @ApiResponse({ status: 200, description: 'List of emails' })
  async listEmails(
    @Req() req: AuthenticatedRequest,
    @Query('query') query?: string,
    @Query('maxResults') maxResults?: number,
    @Query('pageToken') pageToken?: string,
    @Query('accountEmail') accountEmail?: string,
  ) {
    return this.gmailService.listEmails(req.user.userId, {
      query,
      maxResults: maxResults ? parseInt(String(maxResults)) : undefined,
      pageToken,
      accountEmail,
    });
  }

  @Get('messages/:id')
  @ApiOperation({ summary: 'Get a single email' })
  @ApiQuery({ name: 'accountEmail', required: false, description: 'Account email the message belongs to' })
  @ApiResponse({ status: 200, description: 'Email details' })
  async getEmail(
    @Req() req: AuthenticatedRequest, 
    @Param('id') messageId: string,
    @Query('accountEmail') accountEmail?: string,
  ) {
    return this.gmailService.getEmail(req.user.userId, messageId, accountEmail);
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
        replyToMessageId: { type: 'string' },
        accountEmail: { type: 'string', description: 'Account to send from' },
      },
      required: ['to', 'subject', 'body'],
    },
  })
  @ApiResponse({ status: 201, description: 'Email sent' })
  async sendEmail(@Req() req: AuthenticatedRequest, @Body() dto: SendEmailDto) {
    return this.gmailService.sendEmail(req.user.userId, dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search emails' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'maxResults', required: false, type: Number })
  @ApiQuery({ name: 'accountEmail', required: false, description: 'Account to search in' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchEmails(
    @Req() req: AuthenticatedRequest,
    @Query('q') query: string,
    @Query('maxResults') maxResults?: number,
    @Query('accountEmail') accountEmail?: string,
  ) {
    const messages = await this.gmailService.searchEmails(
      req.user.userId,
      query,
      maxResults ? parseInt(String(maxResults)) : 20,
      accountEmail,
    );
    return { messages, accountEmail };
  }

  @Patch('messages/:id/read')
  @ApiOperation({ summary: 'Mark email as read' })
  @ApiQuery({ name: 'accountEmail', required: false })
  async markAsRead(
    @Req() req: AuthenticatedRequest, 
    @Param('id') messageId: string,
    @Query('accountEmail') accountEmail?: string,
  ) {
    await this.gmailService.markAsRead(req.user.userId, messageId, accountEmail);
    return { success: true };
  }

  @Patch('messages/:id/unread')
  @ApiOperation({ summary: 'Mark email as unread' })
  @ApiQuery({ name: 'accountEmail', required: false })
  async markAsUnread(
    @Req() req: AuthenticatedRequest, 
    @Param('id') messageId: string,
    @Query('accountEmail') accountEmail?: string,
  ) {
    await this.gmailService.markAsUnread(req.user.userId, messageId, accountEmail);
    return { success: true };
  }

  @Patch('messages/:id/star')
  @ApiOperation({ summary: 'Toggle star on email' })
  @ApiQuery({ name: 'accountEmail', required: false })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { starred: { type: 'boolean' } },
    },
  })
  async toggleStar(
    @Req() req: AuthenticatedRequest,
    @Param('id') messageId: string,
    @Body('starred') starred: boolean,
    @Query('accountEmail') accountEmail?: string,
  ) {
    await this.gmailService.toggleStar(req.user.userId, messageId, starred, accountEmail);
    return { success: true };
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Trash email' })
  @ApiQuery({ name: 'accountEmail', required: false })
  async trashEmail(
    @Req() req: AuthenticatedRequest, 
    @Param('id') messageId: string,
    @Query('accountEmail') accountEmail?: string,
  ) {
    await this.gmailService.trashEmail(req.user.userId, messageId, accountEmail);
    return { success: true };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread email count' })
  @ApiQuery({ name: 'accountEmail', required: false })
  async getUnreadCount(
    @Req() req: AuthenticatedRequest,
    @Query('accountEmail') accountEmail?: string,
  ) {
    const count = await this.gmailService.getUnreadCount(req.user.userId, accountEmail);
    return { count, accountEmail };
  }
}
