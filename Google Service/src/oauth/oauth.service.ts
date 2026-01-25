import { Injectable, Logger, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
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
   */
  async handleCallback(code: string, state: string): Promise<GoogleToken> {
    // Decode state to get userId
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
    
    this.logger.log(`Processing OAuth callback for user: ${userId}`);

    // Exchange code for tokens
    const tokens = await this.googleClient.getTokensFromCode(code);
    
    // Get user info from Google
    const userInfo = await this.googleClient.getUserInfo(tokens.accessToken);
    
    // Check if this Google account is already connected to another user
    const existing = await this.db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.email, userInfo.email))
      .limit(1);

    if (existing.length > 0 && existing[0].userId !== userId) {
      throw new ConflictException(
        `This Google account is already connected to another North Star account`,
      );
    }

    // Upsert the token
    const tokenData: NewGoogleToken = {
      id: existing.length > 0 ? existing[0].id : nanoid(),
      userId,
      email: userInfo.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      isActive: true,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await this.db
        .update(googleTokens)
        .set(tokenData)
        .where(eq(googleTokens.id, existing[0].id));
    } else {
      tokenData.createdAt = new Date();
      await this.db.insert(googleTokens).values(tokenData);
    }

    this.logger.log(`Google account ${userInfo.email} connected for user ${userId}`);

    return { ...tokenData } as GoogleToken;
  }

  /**
   * Get stored tokens for a user
   */
  async getTokensForUser(userId: string): Promise<GoogleToken | null> {
    const result = await this.db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.userId, userId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get a valid access token for a user (refreshing if needed)
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const stored = await this.getTokensForUser(userId);
    
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
      this.logger.log(`Refreshing token for user ${userId}`);
      
      const newTokens = await this.googleClient.refreshAccessToken(stored.refreshToken);
      
      await this.db
        .update(googleTokens)
        .set({
          accessToken: newTokens.accessToken,
          expiresAt: newTokens.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(googleTokens.id, stored.id));

      return newTokens.accessToken;
    }

    return stored.accessToken;
  }

  /**
   * Disconnect Google account
   */
  async disconnect(userId: string): Promise<void> {
    const stored = await this.getTokensForUser(userId);
    
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
    
    this.logger.log(`Google account disconnected for user ${userId}`);
  }

  /**
   * Check if user has Google connected
   */
  async isConnected(userId: string): Promise<{ connected: boolean; email?: string }> {
    const stored = await this.getTokensForUser(userId);
    
    return {
      connected: stored?.isActive ?? false,
      email: stored?.email,
    };
  }
}
