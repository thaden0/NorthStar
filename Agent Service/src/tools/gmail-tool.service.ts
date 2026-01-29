import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body?: string;
  date: string;
  isUnread: boolean;
  isStarred: boolean;
  accountEmail?: string;
}

export interface GmailMessagesResult {
  messages: GmailMessage[];
  pageToken?: string;
  accountEmail?: string;
  error?: string;
}

export interface GoogleAccountInfo {
  email: string;
  displayName?: string;
  isDefault: boolean;
  isActive: boolean;
  lastSyncAt?: string;
}

export interface AccountsResult {
  accounts: GoogleAccountInfo[];
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
   * Get all connected Google accounts for a user
   */
  async getConnectedAccounts(userId: string, token: string): Promise<AccountsResult> {
    try {
      const url = `${this.googleServiceUrl}/oauth/accounts`;
      
      this.logger.debug(`Fetching connected accounts for user ${userId}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Failed to fetch accounts: ${response.status} ${errorText}`);
        return { accounts: [], error: `Failed to fetch accounts: ${response.status}` };
      }

      const data = await response.json();
      return { accounts: data.accounts || [] };
    } catch (error) {
      this.logger.error(`Error fetching accounts: ${error}`);
      return { accounts: [], error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get Gmail messages for a user
   * Can optionally specify which account to use
   */
  async getMessages(
    userId: string, 
    token: string, 
    options?: { maxResults?: number; accountEmail?: string }
  ): Promise<GmailMessagesResult> {
    try {
      const maxResults = options?.maxResults || 10;
      let url = `${this.googleServiceUrl}/gmail/messages?maxResults=${maxResults}`;
      
      // Add account email if specified
      if (options?.accountEmail) {
        url += `&accountEmail=${encodeURIComponent(options.accountEmail)}`;
      }
      
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
      return { 
        messages: data.messages || data, 
        pageToken: data.nextPageToken,
        accountEmail: options?.accountEmail,
      };
    } catch (error) {
      this.logger.error(`Error fetching Gmail messages: ${error}`);
      return { messages: [], error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Search Gmail messages
   * Can optionally specify which account to search
   */
  async searchMessages(
    userId: string, 
    token: string, 
    query: string,
    options?: { accountEmail?: string }
  ): Promise<GmailMessagesResult> {
    try {
      let url = `${this.googleServiceUrl}/gmail/search?q=${encodeURIComponent(query)}`;
      
      if (options?.accountEmail) {
        url += `&accountEmail=${encodeURIComponent(options.accountEmail)}`;
      }
      
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
      return { 
        messages: data.messages || data,
        accountEmail: options?.accountEmail,
      };
    } catch (error) {
      this.logger.error(`Error searching Gmail: ${error}`);
      return { messages: [], error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get unread count
   * Can optionally specify which account
   */
  async getUnreadCount(
    userId: string, 
    token: string,
    options?: { accountEmail?: string }
  ): Promise<number> {
    try {
      let url = `${this.googleServiceUrl}/gmail/unread-count`;
      
      if (options?.accountEmail) {
        url += `?accountEmail=${encodeURIComponent(options.accountEmail)}`;
      }
      
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

  /**
   * Send an email
   * Can optionally specify which account to send from
   */
  async sendEmail(
    userId: string,
    token: string,
    email: {
      to: string;
      subject: string;
      body: string;
      accountEmail?: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const url = `${this.googleServiceUrl}/gmail/messages`;
      
      this.logger.debug(`Sending email for user ${userId} to ${email.to}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email.to,
          subject: email.subject,
          body: email.body,
          accountEmail: email.accountEmail,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Failed to send email: ${response.status} ${errorText}`);
        return { success: false, error: `Failed to send: ${response.status}` };
      }

      const data = await response.json();
      return { success: true, messageId: data.messageId || data.id };
    } catch (error) {
      this.logger.error(`Error sending email: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(
    userId: string,
    token: string,
    messageId: string,
    options?: { accountEmail?: string }
  ): Promise<{ message?: GmailMessage; error?: string }> {
    try {
      let url = `${this.googleServiceUrl}/gmail/messages/${messageId}`;
      
      if (options?.accountEmail) {
        url += `?accountEmail=${encodeURIComponent(options.accountEmail)}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { error: `Failed to get message: ${response.status}` };
      }

      const data = await response.json();
      return { message: data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}
