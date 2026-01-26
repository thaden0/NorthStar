import { Controller, Get, Post, Delete, Query, Req, Res, UseGuards, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
      return res.redirect(`${frontendUrl}/dashboard/settings/profile?success=google_connected`);
    } catch (err: any) {
      this.logger.error(`OAuth callback failed: ${err.message}`, err.stack);
      return res.redirect(`${frontendUrl}/dashboard/settings/profile?error=${encodeURIComponent(err.message)}`);
    }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if Google account is connected' })
  @ApiResponse({ status: 200, description: 'Connection status' })
  async getStatus(@Req() req: any) {
    return this.oauthService.isConnected(req.user.userId);
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Google account' })
  @ApiResponse({ status: 200, description: 'Account disconnected' })
  async disconnect(@Req() req: any) {
    await this.oauthService.disconnect(req.user.userId);
    return { success: true, message: 'Google account disconnected' };
  }
}
