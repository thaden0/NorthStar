import {
  Controller,
  Get,
  Post,
  Put,
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
import { CalendarService, CreateEventDto, UpdateEventDto } from './calendar.service';

@ApiTags('Calendar')
@Controller('calendar')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @Get('events')
  @ApiOperation({ summary: 'List calendar events' })
  @ApiQuery({ name: 'calendarId', required: false, description: 'Calendar ID (default: primary)' })
  @ApiQuery({ name: 'timeMin', required: false, description: 'Start time (ISO string)' })
  @ApiQuery({ name: 'timeMax', required: false, description: 'End time (ISO string)' })
  @ApiQuery({ name: 'maxResults', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of events' })
  async listEvents(
    @Req() req: any,
    @Query('calendarId') calendarId?: string,
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
    @Query('maxResults') maxResults?: number,
  ) {
    const events = await this.calendarService.listEvents(req.user.userId, {
      calendarId,
      timeMin,
      timeMax,
      maxResults: maxResults ? parseInt(String(maxResults)) : undefined,
    });
    return { events };
  }

  @Get('events/today')
  @ApiOperation({ summary: 'Get today\'s events' })
  async getTodayEvents(@Req() req: any) {
    const events = await this.calendarService.getTodayEvents(req.user.userId);
    return { events };
  }

  @Get('events/week')
  @ApiOperation({ summary: 'Get this week\'s events' })
  async getWeekEvents(@Req() req: any) {
    const events = await this.calendarService.getWeekEvents(req.user.userId);
    return { events };
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get a single event' })
  @ApiQuery({ name: 'calendarId', required: false })
  async getEvent(
    @Req() req: any,
    @Param('id') eventId: string,
    @Query('calendarId') calendarId?: string,
  ) {
    return this.calendarService.getEvent(req.user.userId, eventId, calendarId);
  }

  @Post('events')
  @ApiOperation({ summary: 'Create a new event' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Meeting' },
        description: { type: 'string' },
        location: { type: 'string' },
        start: { type: 'string', example: '2026-01-25T10:00:00-05:00' },
        end: { type: 'string', example: '2026-01-25T11:00:00-05:00' },
        allDay: { type: 'boolean' },
        attendees: { type: 'array', items: { type: 'string' } },
        calendarId: { type: 'string' },
      },
      required: ['title', 'start', 'end'],
    },
  })
  @ApiResponse({ status: 201, description: 'Event created' })
  async createEvent(@Req() req: any, @Body() dto: CreateEventDto) {
    return this.calendarService.createEvent(req.user.userId, dto);
  }

  @Put('events/:id')
  @ApiOperation({ summary: 'Update an event' })
  async updateEvent(
    @Req() req: any,
    @Param('id') eventId: string,
    @Body() dto: Omit<UpdateEventDto, 'id'>,
  ) {
    return this.calendarService.updateEvent(req.user.userId, { ...dto, id: eventId });
  }

  @Delete('events/:id')
  @ApiOperation({ summary: 'Delete an event' })
  @ApiQuery({ name: 'calendarId', required: false })
  async deleteEvent(
    @Req() req: any,
    @Param('id') eventId: string,
    @Query('calendarId') calendarId?: string,
  ) {
    await this.calendarService.deleteEvent(req.user.userId, eventId, calendarId);
    return { success: true };
  }

  @Get('list')
  @ApiOperation({ summary: 'List all calendars' })
  async listCalendars(@Req() req: any) {
    const calendars = await this.calendarService.listCalendars(req.user.userId);
    return { calendars };
  }
}
