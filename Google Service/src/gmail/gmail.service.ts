import { Injectable, Logger, Inject } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { eq, and, desc, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { nanoid } from 'nanoid';
import { OAuthService } from '../oauth/oauth.service';
import { GoogleClientService } from '../oauth/google-client.service';
import { DATABASE_CONNECTION } from '../database/database.module';
import { gmailCache, GmailMessage as CachedGmailMessage, NewGmailMessage } from '../database/schema';

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
  accountEmail?: string;
}

export interface SendEmailDto {
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
  accountEmail?: string;
}

// Cache TTL in minutes - how long before we refresh from Google
const CACHE_TTL_MINUTES = 5;

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private oauthService: OAuthService,
    private googleClient: GoogleClientService,
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<Record<string, never>>,
  ) {}

  /**
   * Get an authenticated Gmail API client for a user
   * Can optionally specify which account to use
   */
  private async getGmailClient(userId: string, accountEmail?: string): Promise<gmail_v1.Gmail> {
    const accessToken = await this.oauthService.getValidAccessToken(userId, accountEmail);
    const auth = this.googleClient.createAuthenticatedClient({
      accessToken,
    });
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * Get the account email for the user (default account if not specified)
   */
  private async getAccountEmail(userId: string, accountEmail?: string): Promise<string> {
    if (accountEmail) return accountEmail;
    
    const tokens = await this.oauthService.getTokensForUser(userId);
    return tokens?.email || '';
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
   * Check if cache needs refresh
   */
  private async isCacheStale(userId: string, accountEmail: string): Promise<boolean> {
    try {
      // Get the most recent cached message
      const cached = await this.db
        .select()
        .from(gmailCache)
        .where(and(
          eq(gmailCache.userId, userId),
          eq(gmailCache.accountEmail, accountEmail)
        ))
        .orderBy(desc(gmailCache.cachedAt))
        .limit(1);

      if (cached.length === 0) {
        this.logger.debug('Cache is empty, needs refresh');
        return true;
      }

      const cachedAt = cached[0].cachedAt;
      if (!cachedAt) {
        return true;
      }
      
      const cacheAge = Date.now() - new Date(cachedAt).getTime();
      const isStale = cacheAge > CACHE_TTL_MINUTES * 60 * 1000;
      
      this.logger.debug(`Cache age: ${Math.round(cacheAge / 1000 / 60)} min, stale: ${isStale}`);
      return isStale;
    } catch (error) {
      this.logger.error(`Error checking cache: ${error}`);
      return true;
    }
  }

  /**
   * Get messages from cache
   */
  private async getFromCache(
    userId: string, 
    accountEmail: string,
    options: { query?: string; maxResults?: number; labelFilter?: string }
  ): Promise<EmailMessage[]> {
    try {
      const query = this.db
        .select()
        .from(gmailCache)
        .where(and(
          eq(gmailCache.userId, userId),
          eq(gmailCache.accountEmail, accountEmail)
        ))
        .orderBy(desc(gmailCache.date))
        .limit(options.maxResults || 50);

      const cached = await query;
      
      this.logger.debug(`Found ${cached.length} messages in cache for ${accountEmail}`);

      // Filter by query/label if provided
      let results = cached;
      if (options.query) {
        const q = options.query.toLowerCase();
        
        // Handle Gmail-style label queries
        if (q.includes('in:inbox')) {
          results = results.filter((m: CachedGmailMessage) => 
            m.labelIds?.includes('INBOX')
          );
        } else if (q.includes('in:sent')) {
          results = results.filter((m: CachedGmailMessage) => 
            m.labelIds?.includes('SENT')
          );
        } else if (q.includes('in:trash')) {
          results = results.filter((m: CachedGmailMessage) => 
            m.labelIds?.includes('TRASH')
          );
        } else if (q.includes('in:spam')) {
          results = results.filter((m: CachedGmailMessage) => 
            m.labelIds?.includes('SPAM')
          );
        } else if (q.includes('in:drafts')) {
          results = results.filter((m: CachedGmailMessage) => 
            m.labelIds?.includes('DRAFT')
          );
        } else if (q.includes('is:starred')) {
          results = results.filter((m: CachedGmailMessage) => m.isStarred);
        } else if (q.includes('is:unread')) {
          results = results.filter((m: CachedGmailMessage) => !m.isRead);
        } else {
          // General text search
          const searchTerms = q.replace(/in:\w+|is:\w+/g, '').trim();
          if (searchTerms) {
            results = results.filter((m: CachedGmailMessage) => 
              m.subject?.toLowerCase().includes(searchTerms) ||
              m.from?.toLowerCase().includes(searchTerms) ||
              m.snippet?.toLowerCase().includes(searchTerms) ||
              m.body?.toLowerCase().includes(searchTerms)
            );
          }
        }
      }

      return results.map((m: CachedGmailMessage) => this.mapCachedToEmail(m, accountEmail));
    } catch (error) {
      this.logger.error(`Error reading from cache: ${error}`);
      return [];
    }
  }

  /**
   * Map cached message to EmailMessage
   */
  private mapCachedToEmail(cached: CachedGmailMessage, accountEmail: string): EmailMessage {
    return {
      id: cached.messageId,
      threadId: cached.threadId || '',
      from: cached.from || '',
      to: cached.to || '',
      subject: cached.subject || '(No Subject)',
      snippet: cached.snippet || '',
      body: cached.body || cached.bodyHtml || '',
      bodyHtml: cached.bodyHtml || undefined,
      date: cached.date?.toISOString() || '',
      isRead: cached.isRead ?? true,
      isStarred: cached.isStarred ?? false,
      labels: cached.labelIds || [],
      accountEmail,
    };
  }

  /**
   * Sync messages from Google to cache
   */
  async syncFromGoogle(
    userId: string, 
    accountEmail?: string,
    options: { maxResults?: number } = {}
  ): Promise<{ synced: number; accountEmail: string }> {
    const account = await this.getAccountEmail(userId, accountEmail);
    if (!account) {
      throw new Error('No Google account connected');
    }

    this.logger.log(`Syncing Gmail for user ${userId}, account ${account}`);

    const gmail = await this.getGmailClient(userId, account);
    const maxResults = options.maxResults || 100;

    // Fetch messages from Google
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
    });

    if (!response.data.messages) {
      this.logger.log('No messages found in Google');
      return { synced: 0, accountEmail: account };
    }

    let synced = 0;
    
    for (const msg of response.data.messages) {
      try {
        // Check if we already have this message
        const existing = await this.db
          .select()
          .from(gmailCache)
          .where(and(
            eq(gmailCache.userId, userId),
            eq(gmailCache.accountEmail, account),
            eq(gmailCache.messageId, msg.id!)
          ))
          .limit(1);

        // Fetch full message details
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const headers = this.parseHeaders(detail.data.payload?.headers || []);
        const body = this.extractBody(detail.data.payload!);
        const dateStr = headers['date'];
        const parsedDate = dateStr ? new Date(dateStr) : new Date();

        const messageData: NewGmailMessage = {
          id: existing.length > 0 ? existing[0].id : nanoid(),
          userId,
          accountEmail: account,
          messageId: detail.data.id!,
          threadId: detail.data.threadId || null,
          from: headers['from'] || null,
          to: headers['to'] || null,
          subject: headers['subject'] || null,
          snippet: detail.data.snippet || null,
          body: body.text || null,
          bodyHtml: body.html || null,
          date: parsedDate,
          labelIds: detail.data.labelIds || [],
          isRead: !detail.data.labelIds?.includes('UNREAD'),
          isStarred: detail.data.labelIds?.includes('STARRED') || false,
          cachedAt: new Date(),
        };

        if (existing.length > 0) {
          await this.db
            .update(gmailCache)
            .set(messageData)
            .where(eq(gmailCache.id, existing[0].id));
        } else {
          await this.db.insert(gmailCache).values(messageData);
        }

        synced++;
      } catch (error) {
        this.logger.error(`Error syncing message ${msg.id}: ${error}`);
      }
    }

    // Update last sync time
    await this.oauthService.updateSyncStatus(userId, account);

    this.logger.log(`Synced ${synced} messages for ${account}`);
    return { synced, accountEmail: account };
  }

  /**
   * List emails - uses cache with background refresh
   * This is the main method called by the controller
   */
  async listEmails(
    userId: string,
    options: {
      query?: string;
      maxResults?: number;
      pageToken?: string;
      labelIds?: string[];
      accountEmail?: string;
    } = {},
  ): Promise<{ messages: EmailMessage[]; nextPageToken?: string; accountEmail?: string; fromCache: boolean }> {
    const account = await this.getAccountEmail(userId, options.accountEmail);
    if (!account) {
      return { messages: [], fromCache: false };
    }

    // Check if we need to sync from Google
    const needsSync = await this.isCacheStale(userId, account);
    
    if (needsSync) {
      this.logger.log(`Cache stale, syncing from Google for ${account}`);
      try {
        await this.syncFromGoogle(userId, account, { maxResults: 100 });
      } catch (error) {
        this.logger.error(`Sync failed, falling back to cache: ${error}`);
      }
    }

    // Always return from cache
    const messages = await this.getFromCache(userId, account, {
      query: options.query,
      maxResults: options.maxResults || 50,
    });

    return {
      messages,
      accountEmail: account,
      fromCache: true,
    };
  }

  /**
   * Get a single email by ID - checks cache first, then Google
   */
  async getEmail(userId: string, messageId: string, accountEmail?: string): Promise<EmailMessage> {
    const account = await this.getAccountEmail(userId, accountEmail);

    // Try cache first
    const cached = await this.db
      .select()
      .from(gmailCache)
      .where(and(
        eq(gmailCache.userId, userId),
        eq(gmailCache.accountEmail, account),
        eq(gmailCache.messageId, messageId)
      ))
      .limit(1);

    if (cached.length > 0) {
      this.logger.debug(`Returning email ${messageId} from cache`);
      return this.mapCachedToEmail(cached[0], account);
    }

    // Not in cache, fetch from Google
    this.logger.debug(`Email ${messageId} not in cache, fetching from Google`);
    const gmail = await this.getGmailClient(userId, account);

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = this.parseHeaders(response.data.payload?.headers || []);
    const body = this.extractBody(response.data.payload!);

    const email: EmailMessage = {
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
      accountEmail: account,
    };

    // Cache this message
    try {
      await this.db.insert(gmailCache).values({
        id: nanoid(),
        userId,
        accountEmail: account,
        messageId: email.id,
        threadId: email.threadId,
        from: email.from,
        to: email.to,
        subject: email.subject,
        snippet: email.snippet,
        body: body.text,
        bodyHtml: body.html,
        date: new Date(headers['date'] || Date.now()),
        labelIds: response.data.labelIds || [],
        isRead: email.isRead,
        isStarred: email.isStarred,
        cachedAt: new Date(),
      });
    } catch (error) {
      this.logger.warn(`Failed to cache email ${messageId}: ${error}`);
    }

    return email;
  }

  /**
   * Send an email
   */
  async sendEmail(userId: string, email: SendEmailDto): Promise<{ id: string; threadId: string; accountEmail?: string }> {
    const account = await this.getAccountEmail(userId, email.accountEmail);
    const gmail = await this.getGmailClient(userId, account);

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
          ? (await this.getEmail(userId, email.replyToMessageId, account)).threadId
          : undefined,
      },
    });

    this.logger.log(`Email sent: ${response.data.id} from ${fromEmail}`);

    // Trigger a cache refresh to include the sent email
    this.syncFromGoogle(userId, account, { maxResults: 10 }).catch(err => {
      this.logger.warn(`Failed to refresh cache after send: ${err}`);
    });

    return {
      id: response.data.id!,
      threadId: response.data.threadId!,
      accountEmail: fromEmail || account,
    };
  }

  /**
   * Mark email as read - update both Google and cache
   */
  async markAsRead(userId: string, messageId: string, accountEmail?: string): Promise<void> {
    const account = await this.getAccountEmail(userId, accountEmail);
    const gmail = await this.getGmailClient(userId, account);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });

    // Update cache
    try {
      await this.db
        .update(gmailCache)
        .set({ isRead: true, cachedAt: new Date() })
        .where(and(
          eq(gmailCache.userId, userId),
          eq(gmailCache.accountEmail, account),
          eq(gmailCache.messageId, messageId)
        ));
    } catch (error) {
      this.logger.warn(`Failed to update cache for mark as read: ${error}`);
    }
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(userId: string, messageId: string, accountEmail?: string): Promise<void> {
    const account = await this.getAccountEmail(userId, accountEmail);
    const gmail = await this.getGmailClient(userId, account);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['UNREAD'],
      },
    });

    // Update cache
    try {
      await this.db
        .update(gmailCache)
        .set({ isRead: false, cachedAt: new Date() })
        .where(and(
          eq(gmailCache.userId, userId),
          eq(gmailCache.accountEmail, account),
          eq(gmailCache.messageId, messageId)
        ));
    } catch (error) {
      this.logger.warn(`Failed to update cache for mark as unread: ${error}`);
    }
  }

  /**
   * Star/unstar email
   */
  async toggleStar(userId: string, messageId: string, starred: boolean, accountEmail?: string): Promise<void> {
    const account = await this.getAccountEmail(userId, accountEmail);
    const gmail = await this.getGmailClient(userId, account);
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: starred
        ? { addLabelIds: ['STARRED'] }
        : { removeLabelIds: ['STARRED'] },
    });

    // Update cache
    try {
      await this.db
        .update(gmailCache)
        .set({ isStarred: starred, cachedAt: new Date() })
        .where(and(
          eq(gmailCache.userId, userId),
          eq(gmailCache.accountEmail, account),
          eq(gmailCache.messageId, messageId)
        ));
    } catch (error) {
      this.logger.warn(`Failed to update cache for toggle star: ${error}`);
    }
  }

  /**
   * Delete (trash) email
   */
  async trashEmail(userId: string, messageId: string, accountEmail?: string): Promise<void> {
    const account = await this.getAccountEmail(userId, accountEmail);
    const gmail = await this.getGmailClient(userId, account);
    
    await gmail.users.messages.trash({
      userId: 'me',
      id: messageId,
    });

    // Remove from cache (or update labels)
    try {
      await this.db
        .delete(gmailCache)
        .where(and(
          eq(gmailCache.userId, userId),
          eq(gmailCache.accountEmail, account),
          eq(gmailCache.messageId, messageId)
        ));
    } catch (error) {
      this.logger.warn(`Failed to remove from cache: ${error}`);
    }
  }

  /**
   * Search emails - uses cache
   */
  async searchEmails(
    userId: string,
    query: string,
    maxResults: number = 20,
    accountEmail?: string,
  ): Promise<EmailMessage[]> {
    const result = await this.listEmails(userId, { query, maxResults, accountEmail });
    return result.messages;
  }

  /**
   * Get unread count from cache
   */
  async getUnreadCount(userId: string, accountEmail?: string): Promise<number> {
    const account = await this.getAccountEmail(userId, accountEmail);
    
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(gmailCache)
        .where(and(
          eq(gmailCache.userId, userId),
          eq(gmailCache.accountEmail, account),
          eq(gmailCache.isRead, false)
        ));

      return Number(result[0]?.count) || 0;
    } catch (error) {
      this.logger.error(`Error getting unread count: ${error}`);
      
      // Fall back to Google API
      try {
        const gmail = await this.getGmailClient(userId, account);
        const response = await gmail.users.labels.get({
          userId: 'me',
          id: 'INBOX',
        });
        return response.data.messagesUnread || 0;
      } catch {
        return 0;
      }
    }
  }

  /**
   * Force sync - exposed for manual refresh
   */
  async forceSync(userId: string, accountEmail?: string): Promise<{ synced: number; accountEmail: string }> {
    return this.syncFromGoogle(userId, accountEmail, { maxResults: 100 });
  }
}
