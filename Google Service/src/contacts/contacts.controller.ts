import {
  Controller,
  Get,
  Query,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactsService } from './contacts.service';

@ApiTags('Contacts')
@Controller('contacts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List contacts' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'pageToken', required: false })
  @ApiResponse({ status: 200, description: 'List of contacts' })
  async listContacts(
    @Req() req: any,
    @Query('pageSize') pageSize?: number,
    @Query('pageToken') pageToken?: string,
  ) {
    return this.contactsService.listContacts(req.user.userId, {
      pageSize: pageSize ? parseInt(String(pageSize)) : undefined,
      pageToken,
    });
  }

  @Get('search')
  @ApiOperation({ summary: 'Search contacts' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchContacts(@Req() req: any, @Query('q') query: string) {
    const contacts = await this.contactsService.searchContacts(
      req.user.userId,
      query,
    );
    return { contacts };
  }

  @Get('frequent')
  @ApiOperation({ summary: 'Get frequently contacted people' })
  @ApiQuery({ name: 'maxResults', required: false, type: Number })
  async getFrequentContacts(
    @Req() req: any,
    @Query('maxResults') maxResults?: number,
  ) {
    const contacts = await this.contactsService.getFrequentContacts(
      req.user.userId,
      maxResults ? parseInt(String(maxResults)) : 10,
    );
    return { contacts };
  }

  @Get('count')
  @ApiOperation({ summary: 'Get total contact count' })
  async getContactCount(@Req() req: any) {
    const count = await this.contactsService.getContactCount(req.user.userId);
    return { count };
  }

  @Get('by-email/:email')
  @ApiOperation({ summary: 'Get contact by email' })
  async getContactByEmail(@Req() req: any, @Param('email') email: string) {
    const contact = await this.contactsService.getContactByEmail(
      req.user.userId,
      email,
    );
    return { contact };
  }

  @Get(':resourceName')
  @ApiOperation({ summary: 'Get a single contact' })
  async getContact(@Req() req: any, @Param('resourceName') resourceName: string) {
    // Resource names come URL-encoded, e.g., people%2F123 -> people/123
    const decoded = decodeURIComponent(resourceName);
    return this.contactsService.getContact(req.user.userId, decoded);
  }
}
