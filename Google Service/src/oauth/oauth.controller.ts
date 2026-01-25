import { Controller, Get, Post, Delete, Query, Req, Res, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OAuthService } from './oauth.service';

@ApiTags('OAuth')
@Controller('oauth')
export class OAuthController {
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
    // Handle errors from Google
    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings/integrations?error=${encodeURIComponent(error)}`);
    }

    try {
      await this.oauthService.handleCallback(code, state);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings/integrations?success=google_connected`);
    } catch (err: any) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings/integrations?error=${encodeURIComponent(err.message)}`);
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
