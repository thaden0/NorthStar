import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { OAuthService } from '../oauth/oauth.service';
import { GoogleClientService } from '../oauth/google-client.service';

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  bodyHtml?: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
}

export interface SendEmailDto {
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private oauthService: OAuthService,
    private googleClient: GoogleClientService,
  ) {}

  /**
   * Get an authenticated Gmail API client for a user
   */
  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    const accessToken = await this.oauthService.getValidAccessToken(userId);
    const auth = this.googleClient.createAuthenticatedClient({
      accessToken,
    });
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * Parse email headers
   */
  private parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[]): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.name && h.value) {
        result[h.name.toLowerCase()] = h.value;
      }
    });
    return result;
  }

  /**
   * Decode base64 email body
   */
  private decodeBody(data: string): string {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  }

  /**
   * Extract body from message parts
   */
  private extractBody(payload: gmail_v1.Schema$MessagePart): { text: string; html?: string } {
    let text = '';
    let html = '';

    if (payload.body?.data) {
      const data = this.decodeBody(payload.body.data);
      if (payload.mimeType === 'text/html') {
        html = data;
      } else {
        text = data;
      }
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        const extracted = this.extractBody(part);
        if (extracted.text) text = extracted.text;
        if (extracted.html) html = extracted.html;
      }
    }

    return { text, html };
  }

  /**
   * List emails with optional search query
   */
  async listEmails(
    userId: string,
    options: {
      query?: string;
      maxResults?: number;
      pageToken?: string;
      labelIds?: string[];
    } = {},
  ): Promise<{ messages: EmailMessage[]; nextPageToken?: string }> {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: options.query,
      maxResults: options.maxResults || 20,
      pageToken: options.pageToken,
      labelIds: options.labelIds,
    });

    const messages: EmailMessage[] = [];

    if (response.data.messages) {
      for (const msg of response.data.messages) {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const headers = this.parseHeaders(detail.data.payload?.headers || []);
        const body = this.extractBody(detail.data.payload!);

        messages.push({
          id: detail.data.id!,
          threadId: detail.data.threadId!,
          from: headers['from'] || '',
          to: headers['to'] || '',
          subject: headers['subject'] || '(No Subject)',
          snippet: detail.data.snippet || '',
          body: body.text || body.html || '',
          bodyHtml: body.html,
          date: headers['date'] || '',
          isRead: !detail.data.labelIds?.includes('UNREAD'),
          isStarred: detail.data.labelIds?.includes('STARRED') || false,
          labels: detail.data.labelIds || [],
        });
      }
    }

    return {
      messages,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  /**
   * Get a single email by ID
   */
  async getEmail(userId: string, messageId: string): Promise<EmailMessage> {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = this.parseHeaders(response.data.payload?.headers || []);
    const body = this.extractBody(response.data.payload!);

    return {
      id: response.data.id!,
      threadId: response.data.threadId!,
      from: headers['from'] || '',
      to: headers['to'] || '',
      subject: headers['subject'] || '(No Subject)',
      snippet: response.data.snippet || '',
      body: body.text || body.html || '',
      bodyHtml: body.html,
      date: headers['date'] || '',
      isRead: !response.data.labelIds?.includes('UNREAD'),
      isStarred: response.data.labelIds?.includes('STARRED') || false,
      labels: response.data.labelIds || [],
    };
  }

  /**
   * Send an email
   */
  async sendEmail(userId: string, email: SendEmailDto): Promise<{ id: string; threadId: string }> {
    const gmail = await this.getGmailClient(userId);

    // Get user's email address for the From field
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const fromEmail = profile.data.emailAddress;

    // Build the email
    const messageParts = [
      `From: ${fromEmail}`,
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      email.body,
    ];

    if (email.replyToMessageId) {
      // Get the original message for threading
      const original = await gmail.users.messages.get({
        userId: 'me',
        id: email.replyToMessageId,
        format: 'metadata',
        metadataHeaders: ['Message-ID', 'References'],
      });

      const headers = this.parseHeaders(original.data.payload?.headers || []);
      if (headers['message-id']) {
        messageParts.unshift(`In-Reply-To: ${headers['message-id']}`);
        messageParts.unshift(`References: ${headers['references'] || ''} ${headers['message-id']}`);
      }
    }

    const raw = Buffer.from(messageParts.join('\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: email.replyToMessageId
          ? (await this.getEmail(userId, email.replyToMessageId)).threadId
          : undefined,
      },
    });

    this.logger.log(`Email sent: ${response.data.id}`);

    return {
      id: response.data.id!,
      threadId: response.data.threadId!,
    };
  }

  /**
   * Mark email as read
   */
  async markAsRead(userId: string, messageId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(userId: string, messageId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['UNREAD'],
      },
    });
  }

  /**
   * Star/unstar email
   */
  async toggleStar(userId: string, messageId: string, starred: boolean): Promise<void> {
    const gmail = await this.getGmailClient(userId);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: starred
        ? { addLabelIds: ['STARRED'] }
        : { removeLabelIds: ['STARRED'] },
    });
  }

  /**
   * Delete (trash) email
   */
  async trashEmail(userId: string, messageId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);
    
    await gmail.users.messages.trash({
      userId: 'me',
      id: messageId,
    });
  }

  /**
   * Search emails
   */
  async searchEmails(
    userId: string,
    query: string,
    maxResults: number = 20,
  ): Promise<EmailMessage[]> {
    const result = await this.listEmails(userId, { query, maxResults });
    return result.messages;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const gmail = await this.getGmailClient(userId);
    
    const response = await gmail.users.labels.get({
      userId: 'me',
      id: 'INBOX',
    });

    return response.data.messagesUnread || 0;
  }
}
