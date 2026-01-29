import { Controller, Get, Post, Delete, Query, Body, Req, Res, UseGuards, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OAuthService } from './oauth.service';

@ApiTags('OAuth')
@Controller('oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);
  
  constructor(private oauthService: OAuthService) {}

  @Get('authorize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Google OAuth authorization URL' })
  @ApiResponse({ status: 200, description: 'Returns authorization URL' })
  async getAuthorizationUrl(@Req() req: any) {
    const url = this.oauthService.getAuthorizationUrl(req.user.userId);
    return { url };
  }

  @Get('callback')
  @ApiOperation({ summary: 'OAuth callback endpoint - handles token exchange' })
  @ApiQuery({ name: 'code', required: true, description: 'Authorization code from Google' })
  @ApiQuery({ name: 'state', required: true, description: 'State parameter with encoded user ID' })
  @ApiResponse({ status: 302, description: 'Redirects to North Star dashboard' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://leonardwaugh.com';
    
    // Handle errors from Google
    if (error) {
      return res.redirect(`${frontendUrl}/dashboard/settings/profile?error=${encodeURIComponent(error)}`);
    }

    try {
      await this.oauthService.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/dashboard/email?success=google_connected`);
    } catch (err: any) {
      this.logger.error(`OAuth callback failed: ${err.message}`, err.stack);
      return res.redirect(`${frontendUrl}/dashboard/email?error=${encodeURIComponent(err.message)}`);
    }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if Google account(s) are connected' })
  @ApiResponse({ status: 200, description: 'Connection status with all accounts' })
  async getStatus(@Req() req: any) {
    return this.oauthService.isConnected(req.user.userId);
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all connected Google accounts' })
  @ApiResponse({ status: 200, description: 'List of connected accounts' })
  async getAccounts(@Req() req: any) {
    const accounts = await this.oauthService.getAllAccountsForUser(req.user.userId);
    return {
      accounts: accounts.map(a => ({
        email: a.email,
        displayName: a.displayName,
        isDefault: a.isDefault,
        isActive: a.isActive,
        lastSyncAt: a.lastSyncAt,
        syncError: a.syncError,
      })),
    };
  }

  @Post('set-default')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set an account as the default' })
  @ApiBody({ schema: { properties: { email: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Default account set' })
  async setDefault(@Req() req: any, @Body('email') email: string) {
    await this.oauthService.setDefaultAccount(req.user.userId, email);
    return { success: true, message: `${email} set as default account` };
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect a Google account' })
  @ApiQuery({ name: 'email', required: false, description: 'Specific account email to disconnect (disconnects default if not specified)' })
  @ApiResponse({ status: 200, description: 'Account disconnected' })
  async disconnect(@Req() req: any, @Query('email') email?: string) {
    await this.oauthService.disconnect(req.user.userId, email);
    return { success: true, message: 'Google account disconnected' };
  }

  @Delete('disconnect-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect all Google accounts' })
  @ApiResponse({ status: 200, description: 'All accounts disconnected' })
  async disconnectAll(@Req() req: any) {
    await this.oauthService.disconnectAll(req.user.userId);
    return { success: true, message: 'All Google accounts disconnected' };
  }
}
