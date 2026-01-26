import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  isStarred: boolean;
}

export interface GmailMessagesResult {
  messages: GmailMessage[];
  pageToken?: string;
  error?: string;
}

@Injectable()
export class GmailToolService {
  private readonly logger = new Logger(GmailToolService.name);
  private readonly googleServiceUrl: string;

  constructor(private configService: ConfigService) {
    this.googleServiceUrl = this.configService.get<string>('GOOGLE_SERVICE_URL') || 'http://localhost:3003';
    this.logger.log(`Gmail Tool Service initialized with Google Service URL: ${this.googleServiceUrl}`);
  }

  /**
   * Get Gmail messages for a user
   * Note: We pass the userId as a header so the Google Service can look up the OAuth token
   */
  async getMessages(userId: string, token: string, options?: { maxResults?: number }): Promise<GmailMessagesResult> {
    try {
      const maxResults = options?.maxResults || 10;
      const url = `${this.googleServiceUrl}/gmail/messages?maxResults=${maxResults}`;
      
      this.logger.debug(`Fetching Gmail messages for user ${userId} from ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Id': userId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Failed to fetch Gmail messages: ${response.status} ${errorText}`);
        return { messages: [], error: `Failed to fetch messages: ${response.status}` };
      }

      const data = await response.json();
      return { messages: data.messages || data, pageToken: data.nextPageToken };
    } catch (error) {
      this.logger.error(`Error fetching Gmail messages: ${error}`);
      return { messages: [], error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Search Gmail messages
   */
  async searchMessages(userId: string, token: string, query: string): Promise<GmailMessagesResult> {
    try {
      const url = `${this.googleServiceUrl}/gmail/search?q=${encodeURIComponent(query)}`;
      
      this.logger.debug(`Searching Gmail for user ${userId}: ${query}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Failed to search Gmail: ${response.status} ${errorText}`);
        return { messages: [], error: `Failed to search: ${response.status}` };
      }

      const data = await response.json();
      return { messages: data.messages || data };
    } catch (error) {
      this.logger.error(`Error searching Gmail: ${error}`);
      return { messages: [], error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string, token: string): Promise<number> {
    try {
      const url = `${this.googleServiceUrl}/gmail/unread-count`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.error(`Failed to get unread count: ${response.status}`);
        return 0;
      }

      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      this.logger.error(`Error getting unread count: ${error}`);
      return 0;
    }
  }
}
