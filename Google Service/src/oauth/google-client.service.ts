import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth } from 'googleapis';

@Injectable()
export class GoogleClientService {
  private readonly logger = new Logger(GoogleClientService.name);
  private oauth2Client: Auth.OAuth2Client;

  constructor(private configService: ConfigService) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );
  }

  /**
   * Get the base OAuth2 client (for generating auth URLs)
   */
  getOAuth2Client(): Auth.OAuth2Client {
    return this.oauth2Client;
  }

  /**
   * Create an authenticated OAuth2 client for a specific user's tokens
   */
  createAuthenticatedClient(tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Auth.OAuth2Client {
    const client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );

    client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiresAt?.getTime(),
    });

    // Handle token refresh
    client.on('tokens', (newTokens) => {
      this.logger.log('Tokens refreshed automatically');
      // The OAuthService should handle persisting these
    });

    return client;
  }

  /**
   * Generate authorization URL
   */
  generateAuthUrl(state?: string): string {
    const scopes = this.configService.get<string>('GOOGLE_SCOPES')?.split(' ') || [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/contacts.readonly',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
      state,
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
  }> {
    this.logger.debug(`Exchanging authorization code for tokens...`);
    const { tokens } = await this.oauth2Client.getToken(code);
    
    this.logger.debug(`Token exchange result - access_token exists: ${!!tokens.access_token}, refresh_token exists: ${!!tokens.refresh_token}, scope: ${tokens.scope}`);
    
    if (!tokens.access_token) {
      this.logger.error('No access token received from Google!');
      throw new Error('Failed to get access token from Google');
    }
    
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scope: tokens.scope || undefined,
    };
  }

  /**
   * Refresh an access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    const client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
    );

    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();

    return {
      accessToken: credentials.access_token!,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
    };
  }

  /**
   * Revoke tokens
   */
  async revokeToken(token: string): Promise<void> {
    await this.oauth2Client.revokeToken(token);
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken: string): Promise<{
    id: string;
    email: string;
    name?: string;
    picture?: string;
  }> {
    this.logger.debug(`Getting user info with access token (first 20 chars): ${accessToken.substring(0, 20)}...`);
    
    // Create a temporary OAuth2 client with the access token
    const client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
    );
    client.setCredentials({ access_token: accessToken });
    
    // Use the googleapis library
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    
    if (!data.email) {
      throw new Error('Failed to get user email from Google');
    }
    
    this.logger.debug(`Got user info for: ${data.email}`);
    
    return {
      id: data.id || '',
      email: data.email,
      name: data.name || undefined,
      picture: data.picture || undefined,
    };
  }
}
