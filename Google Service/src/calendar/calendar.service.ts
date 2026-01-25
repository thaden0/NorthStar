import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { OAuthService } from '../oauth/oauth.service';
import { GoogleClientService } from '../oauth/google-client.service';

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  status: string;
  htmlLink?: string;
  attendees?: Array<{
    email: string;
    name?: string;
    responseStatus?: string;
  }>;
  organizer?: {
    email: string;
    name?: string;
  };
  color?: string;
}

export interface CreateEventDto {
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay?: boolean;
  attendees?: string[];
  calendarId?: string;
}

export interface UpdateEventDto extends Partial<CreateEventDto> {
  id: string;
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private oauthService: OAuthService,
    private googleClient: GoogleClientService,
  ) {}

  /**
   * Get an authenticated Calendar API client
   */
  private async getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
    const accessToken = await this.oauthService.getValidAccessToken(userId);
    const auth = this.googleClient.createAuthenticatedClient({ accessToken });
    return google.calendar({ version: 'v3', auth });
  }

  /**
   * Convert Google event to our format
   */
  private formatEvent(event: calendar_v3.Schema$Event, calendarId: string): CalendarEvent {
    const isAllDay = !event.start?.dateTime;
    const start = isAllDay ? event.start?.date : event.start?.dateTime;
    const end = isAllDay ? event.end?.date : event.end?.dateTime;

    return {
      id: event.id!,
      calendarId,
      title: event.summary || '(No Title)',
      description: event.description || undefined,
      location: event.location || undefined,
      start: start || '',
      end: end || '',
      allDay: isAllDay,
      status: event.status || 'confirmed',
      htmlLink: event.htmlLink || undefined,
      attendees: event.attendees?.map((a) => ({
        email: a.email!,
        name: a.displayName || undefined,
        responseStatus: a.responseStatus || undefined,
      })),
      organizer: event.organizer
        ? {
            email: event.organizer.email!,
            name: event.organizer.displayName || undefined,
          }
        : undefined,
      color: event.colorId ? this.getColorForId(event.colorId) : undefined,
    };
  }

  /**
   * Map color IDs to hex colors
   */
  private getColorForId(colorId: string): string {
    const colors: Record<string, string> = {
      '1': '#7986cb', // Lavender
      '2': '#33b679', // Sage
      '3': '#8e24aa', // Grape
      '4': '#e67c73', // Flamingo
      '5': '#f6bf26', // Banana
      '6': '#f4511e', // Tangerine
      '7': '#039be5', // Peacock
      '8': '#616161', // Graphite
      '9': '#3f51b5', // Blueberry
      '10': '#0b8043', // Basil
      '11': '#d50000', // Tomato
    };
    return colors[colorId] || '#3b82f6';
  }

  /**
   * List events from calendar
   */
  async listEvents(
    userId: string,
    options: {
      calendarId?: string;
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      singleEvents?: boolean;
      orderBy?: 'startTime' | 'updated';
    } = {},
  ): Promise<CalendarEvent[]> {
    const calendar = await this.getCalendarClient(userId);
    const calendarId = options.calendarId || 'primary';

    const response = await calendar.events.list({
      calendarId,
      timeMin: options.timeMin || new Date().toISOString(),
      timeMax: options.timeMax,
      maxResults: options.maxResults || 50,
      singleEvents: options.singleEvents ?? true,
      orderBy: options.orderBy || 'startTime',
    });

    return (response.data.items || []).map((event) =>
      this.formatEvent(event, calendarId),
    );
  }

  /**
   * Get a single event
   */
  async getEvent(
    userId: string,
    eventId: string,
    calendarId: string = 'primary',
  ): Promise<CalendarEvent> {
    const calendar = await this.getCalendarClient(userId);

    const response = await calendar.events.get({
      calendarId,
      eventId,
    });

    return this.formatEvent(response.data, calendarId);
  }

  /**
   * Create a new event
   */
  async createEvent(userId: string, dto: CreateEventDto): Promise<CalendarEvent> {
    const calendar = await this.getCalendarClient(userId);
    const calendarId = dto.calendarId || 'primary';

    const eventResource: calendar_v3.Schema$Event = {
      summary: dto.title,
      description: dto.description,
      location: dto.location,
      start: dto.allDay
        ? { date: dto.start.split('T')[0] }
        : { dateTime: dto.start },
      end: dto.allDay
        ? { date: dto.end.split('T')[0] }
        : { dateTime: dto.end },
      attendees: dto.attendees?.map((email) => ({ email })),
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: eventResource,
      sendUpdates: 'all',
    });

    this.logger.log(`Created event: ${response.data.id}`);

    return this.formatEvent(response.data, calendarId);
  }

  /**
   * Update an event
   */
  async updateEvent(userId: string, dto: UpdateEventDto): Promise<CalendarEvent> {
    const calendar = await this.getCalendarClient(userId);
    const calendarId = dto.calendarId || 'primary';

    // Get existing event
    const existing = await calendar.events.get({
      calendarId,
      eventId: dto.id,
    });

    const eventResource: calendar_v3.Schema$Event = {
      ...existing.data,
      summary: dto.title ?? existing.data.summary,
      description: dto.description ?? existing.data.description,
      location: dto.location ?? existing.data.location,
    };

    if (dto.start) {
      eventResource.start = dto.allDay
        ? { date: dto.start.split('T')[0] }
        : { dateTime: dto.start };
    }

    if (dto.end) {
      eventResource.end = dto.allDay
        ? { date: dto.end.split('T')[0] }
        : { dateTime: dto.end };
    }

    if (dto.attendees) {
      eventResource.attendees = dto.attendees.map((email) => ({ email }));
    }

    const response = await calendar.events.update({
      calendarId,
      eventId: dto.id,
      requestBody: eventResource,
      sendUpdates: 'all',
    });

    this.logger.log(`Updated event: ${response.data.id}`);

    return this.formatEvent(response.data, calendarId);
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    userId: string,
    eventId: string,
    calendarId: string = 'primary',
  ): Promise<void> {
    const calendar = await this.getCalendarClient(userId);

    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: 'all',
    });

    this.logger.log(`Deleted event: ${eventId}`);
  }

  /**
   * Get events for today
   */
  async getTodayEvents(userId: string): Promise<CalendarEvent[]> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return this.listEvents(userId, {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
    });
  }

  /**
   * Get events for this week
   */
  async getWeekEvents(userId: string): Promise<CalendarEvent[]> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start from Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return this.listEvents(userId, {
      timeMin: startOfWeek.toISOString(),
      timeMax: endOfWeek.toISOString(),
    });
  }

  /**
   * List calendars
   */
  async listCalendars(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      primary: boolean;
      color?: string;
    }>
  > {
    const calendar = await this.getCalendarClient(userId);

    const response = await calendar.calendarList.list();

    return (response.data.items || []).map((cal) => ({
      id: cal.id!,
      name: cal.summary || cal.id!,
      primary: cal.primary || false,
      color: cal.backgroundColor || undefined,
    }));
  }
}
