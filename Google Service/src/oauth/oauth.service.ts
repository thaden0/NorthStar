import { Injectable, Logger, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { DATABASE_CONNECTION } from '../database/database.module';
import { googleTokens, GoogleToken, NewGoogleToken } from '../database/schema';
import { GoogleClientService } from './google-client.service';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private db: any,
    private googleClient: GoogleClientService,
  ) {}

  /**
   * Generate OAuth authorization URL for a user
   */
  getAuthorizationUrl(userId: string): string {
    // Encode userId in state for callback
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    return this.googleClient.generateAuthUrl(state);
  }

  /**
   * Handle OAuth callback - exchange code for tokens and store
   * Supports multiple accounts per user
   */
  async handleCallback(code: string, state: string): Promise<GoogleToken> {
    // Decode state to get userId
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
    
    this.logger.log(`Processing OAuth callback for user: ${userId}`);

    // Exchange code for tokens
    const tokens = await this.googleClient.getTokensFromCode(code);
    
    // Get user info from Google
    const userInfo = await this.googleClient.getUserInfo(tokens.accessToken);
    
    // Check if this user already has this Google account connected
    const existingForUser = await this.db
      .select()
      .from(googleTokens)
      .where(and(
        eq(googleTokens.userId, userId),
        eq(googleTokens.email, userInfo.email)
      ))
      .limit(1);

    // Check if another user has this Google account (not allowed)
    const existingForOtherUser = await this.db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.email, userInfo.email))
      .limit(1);

    if (existingForOtherUser.length > 0 && existingForOtherUser[0].userId !== userId) {
      throw new ConflictException(
        `This Google account is already connected to another North Star account`,
      );
    }

    // Check if this is the first account for this user (make it default)
    const userAccounts = await this.db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.userId, userId));
    
    const isFirstAccount = userAccounts.length === 0 || 
      (existingForUser.length > 0 && userAccounts.length === 1);

    // Upsert the token
    const tokenData: NewGoogleToken = {
      id: existingForUser.length > 0 ? existingForUser[0].id : nanoid(),
      userId,
      email: userInfo.email,
      displayName: userInfo.name,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || existingForUser[0]?.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      isActive: true,
      isDefault: isFirstAccount,
      updatedAt: new Date(),
    };

    if (existingForUser.length > 0) {
      await this.db
        .update(googleTokens)
        .set(tokenData)
        .where(eq(googleTokens.id, existingForUser[0].id));
    } else {
      tokenData.createdAt = new Date();
      await this.db.insert(googleTokens).values(tokenData);
    }

    this.logger.log(`Google account ${userInfo.email} connected for user ${userId}`);

    return { ...tokenData } as GoogleToken;
  }

  /**
   * Get all connected accounts for a user
   */
  async getAllAccountsForUser(userId: string): Promise<GoogleToken[]> {
    return await this.db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.userId, userId));
  }

  /**
   * Get stored tokens for a user (returns default or first account)
   */
  async getTokensForUser(userId: string): Promise<GoogleToken | null> {
    // First try to get the default account
    const defaultAccount = await this.db
      .select()
      .from(googleTokens)
      .where(and(
        eq(googleTokens.userId, userId),
        eq(googleTokens.isDefault, true)
      ))
      .limit(1);

    if (defaultAccount.length > 0) {
      return defaultAccount[0];
    }

    // Fall back to any active account
    const result = await this.db
      .select()
      .from(googleTokens)
      .where(and(
        eq(googleTokens.userId, userId),
        eq(googleTokens.isActive, true)
      ))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get tokens for a specific account email
   */
  async getTokensForAccount(userId: string, accountEmail: string): Promise<GoogleToken | null> {
    const result = await this.db
      .select()
      .from(googleTokens)
      .where(and(
        eq(googleTokens.userId, userId),
        eq(googleTokens.email, accountEmail)
      ))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get a valid access token for a user (refreshing if needed)
   * Can optionally specify which account email to use
   */
  async getValidAccessToken(userId: string, accountEmail?: string): Promise<string> {
    const stored = accountEmail 
      ? await this.getTokensForAccount(userId, accountEmail)
      : await this.getTokensForUser(userId);
    
    if (!stored) {
      throw new NotFoundException('Google account not connected');
    }

    if (!stored.isActive) {
      throw new NotFoundException('Google connection is inactive');
    }

    // Check if token is expired or will expire soon (5 min buffer)
    const now = new Date();
    const expiresAt = stored.expiresAt ? new Date(stored.expiresAt) : null;
    const needsRefresh = expiresAt && (expiresAt.getTime() - now.getTime()) < 5 * 60 * 1000;

    if (needsRefresh && stored.refreshToken) {
      this.logger.log(`Refreshing token for user ${userId}, account ${stored.email}`);
      
      try {
        const newTokens = await this.googleClient.refreshAccessToken(stored.refreshToken);
        
        await this.db
          .update(googleTokens)
          .set({
            accessToken: newTokens.accessToken,
            expiresAt: newTokens.expiresAt,
            updatedAt: new Date(),
            syncError: null,
          })
          .where(eq(googleTokens.id, stored.id));

        return newTokens.accessToken;
      } catch (error) {
        // Update sync error
        await this.db
          .update(googleTokens)
          .set({
            syncError: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(googleTokens.id, stored.id));
        throw error;
      }
    }

    return stored.accessToken;
  }

  /**
   * Set an account as the default
   */
  async setDefaultAccount(userId: string, accountEmail: string): Promise<void> {
    // First, unset all defaults for this user
    await this.db
      .update(googleTokens)
      .set({ isDefault: false })
      .where(eq(googleTokens.userId, userId));

    // Set the specified account as default
    await this.db
      .update(googleTokens)
      .set({ isDefault: true })
      .where(and(
        eq(googleTokens.userId, userId),
        eq(googleTokens.email, accountEmail)
      ));

    this.logger.log(`Set ${accountEmail} as default account for user ${userId}`);
  }

  /**
   * Disconnect a specific Google account
   */
  async disconnect(userId: string, accountEmail?: string): Promise<void> {
    let stored: GoogleToken | null;
    
    if (accountEmail) {
      stored = await this.getTokensForAccount(userId, accountEmail);
    } else {
      stored = await this.getTokensForUser(userId);
    }
    
    if (!stored) {
      throw new NotFoundException('No Google account connected');
    }

    // Revoke token with Google
    try {
      await this.googleClient.revokeToken(stored.accessToken);
    } catch (error) {
      this.logger.warn(`Failed to revoke token with Google: ${error}`);
    }

    // Delete from database
    await this.db.delete(googleTokens).where(eq(googleTokens.id, stored.id));
    
    // If this was the default, promote another account to default
    if (stored.isDefault) {
      const remaining = await this.getAllAccountsForUser(userId);
      if (remaining.length > 0) {
        await this.setDefaultAccount(userId, remaining[0].email);
      }
    }
    
    this.logger.log(`Google account ${stored.email} disconnected for user ${userId}`);
  }

  /**
   * Disconnect all Google accounts for a user
   */
  async disconnectAll(userId: string): Promise<void> {
    const accounts = await this.getAllAccountsForUser(userId);
    
    for (const account of accounts) {
      try {
        await this.googleClient.revokeToken(account.accessToken);
      } catch (error) {
        this.logger.warn(`Failed to revoke token for ${account.email}: ${error}`);
      }
    }

    await this.db.delete(googleTokens).where(eq(googleTokens.userId, userId));
    
    this.logger.log(`All Google accounts disconnected for user ${userId}`);
  }

  /**
   * Check if user has Google connected
   */
  async isConnected(userId: string): Promise<{ connected: boolean; accounts: Array<{ email: string; isDefault: boolean }> }> {
    const accounts = await this.getAllAccountsForUser(userId);
    
    return {
      connected: accounts.some(a => a.isActive),
      accounts: accounts.filter(a => a.isActive).map(a => ({
        email: a.email,
        isDefault: a.isDefault ?? false,
      })),
    };
  }

  /**
   * Update last sync time for an account
   */
  async updateSyncStatus(userId: string, accountEmail: string, error?: string): Promise<void> {
    await this.db
      .update(googleTokens)
      .set({
        lastSyncAt: new Date(),
        syncError: error || null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(googleTokens.userId, userId),
        eq(googleTokens.email, accountEmail)
      ));
  }
}
