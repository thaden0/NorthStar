import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { LoginSessionService } from './login-session.service';

@Controller('job-apply/login')
export class LoginController {
  private readonly logger = new Logger(LoginController.name);

  constructor(private readonly loginSessionService: LoginSessionService) {}

  /**
   * GET /job-apply/login/profiles/:userId
   * List saved profiles and their status.
   */
  @Get('profiles/:userId')
  getProfiles(@Param('userId') userId: string) {
    const profiles = this.loginSessionService.getSavedProfiles(userId);
    return { profiles };
  }

  /**
   * POST /job-apply/login/start
   * Start a login session for a board.
   */
  @Post('start')
  async startSession(@Body() body: { userId: string; board: string }) {
    this.logger.log(`Starting login session: ${body.board} for user ${body.userId}`);

    try {
      const session = await this.loginSessionService.startLoginSession(body.userId, body.board);
      return {
        sessionId: session.id,
        status: session.status,
        screenshot: session.lastScreenshot,
        board: session.board,
      };
    } catch (error) {
      this.logger.error(`Start session error: ${error}`);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * POST /job-apply/login/screenshot
   * Get a fresh screenshot.
   */
  @Post('screenshot')
  async getScreenshot(@Body() body: { sessionId: string }) {
    try {
      const result = await this.loginSessionService.getScreenshot(body.sessionId);
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * POST /job-apply/login/click
   * Click at coordinates.
   */
  @Post('click')
  async click(@Body() body: { sessionId: string; x: number; y: number }) {
    try {
      await this.loginSessionService.click(body.sessionId, body.x, body.y);
      const result = await this.loginSessionService.getScreenshot(body.sessionId);
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * POST /job-apply/login/type
   * Type text into focused field.
   */
  @Post('type')
  async typeText(@Body() body: { sessionId: string; text: string }) {
    try {
      await this.loginSessionService.type(body.sessionId, body.text);
      const result = await this.loginSessionService.getScreenshot(body.sessionId);
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * POST /job-apply/login/keypress
   * Send a key press (Enter, Tab, etc.)
   */
  @Post('keypress')
  async keyPress(@Body() body: { sessionId: string; key: string }) {
    try {
      await this.loginSessionService.keyPress(body.sessionId, body.key);
      const result = await this.loginSessionService.getScreenshot(body.sessionId);
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * POST /job-apply/login/clear
   * Clear the focused input field.
   */
  @Post('clear')
  async clearField(@Body() body: { sessionId: string }) {
    try {
      await this.loginSessionService.clearField(body.sessionId);
      const result = await this.loginSessionService.getScreenshot(body.sessionId);
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * POST /job-apply/login/end
   * End the login session and save the profile.
   */
  @Post('end')
  async endSession(@Body() body: { sessionId: string }) {
    try {
      await this.loginSessionService.endLoginSession(body.sessionId);
      return { success: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * POST /job-apply/login/delete
   * Delete a saved profile.
   */
  @Post('delete')
  async deleteProfile(@Body() body: { userId: string; board: string }) {
    try {
      this.loginSessionService.deleteProfile(body.userId, body.board);
      return { success: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * POST /job-apply/login/check
   * Check if a session is still valid.
   */
  @Post('check')
  async checkSession(@Body() body: { userId: string; board: string }) {
    try {
      const isValid = await this.loginSessionService.refreshSession(body.userId, body.board);
      return { board: body.board, valid: isValid };
    } catch (error) {
      return { board: body.board, valid: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
