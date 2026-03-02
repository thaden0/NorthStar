import { Injectable, Logger } from '@nestjs/common';
import { BrowserContext, Page } from 'playwright';
import { chromium as stealthChromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

// Add stealth plugin to avoid bot detection (hides automation fingerprints)
stealthChromium.use(StealthPlugin());

// Use stealth chromium for all persistent contexts
const chromium = stealthChromium;

export interface LoginSession {
  id: string;
  board: string;
  userId: string;
  status: 'connecting' | 'ready' | 'logged_in' | 'closed';
  context: BrowserContext | null;
  page: Page | null;
  popupPage: Page | null; // Google OAuth popup, etc.
  lastScreenshot: string | null;
  createdAt: Date;
}

interface BoardLoginConfig {
  name: string;
  loginUrl: string;
  loggedInIndicators: string[]; // Text on page that indicates successful login
  loggedInSelectors: string[]; // CSS selectors that only appear when logged in
}

const BOARD_CONFIGS: Record<string, BoardLoginConfig> = {
  indeed: {
    name: 'Indeed',
    loginUrl: 'https://secure.indeed.com/auth',
    loggedInIndicators: ['my jobs', 'my indeed', 'profile', 'sign out'],
    loggedInSelectors: ['[data-gnav-element-name="SignOut"]', 'a[href*="/account"]'],
  },
  linkedin: {
    name: 'LinkedIn',
    loginUrl: 'https://www.linkedin.com/login',
    loggedInIndicators: ['messaging', 'notifications', 'my network'],
    loggedInSelectors: ['.global-nav__me', 'a[href*="/feed"]'],
  },
  glassdoor: {
    name: 'Glassdoor',
    loginUrl: 'https://www.glassdoor.com/profile/login_input.htm',
    loggedInIndicators: ['my activity', 'account settings'],
    loggedInSelectors: ['[data-test="account-menu"]'],
  },
  ziprecruiter: {
    name: 'ZipRecruiter',
    loginUrl: 'https://www.ziprecruiter.com/login',
    loggedInIndicators: ['my jobs', 'dashboard'],
    loggedInSelectors: ['.user-menu'],
  },
};

const PROFILES_DIR = '/app/browser-profiles';

@Injectable()
export class LoginSessionService {
  private readonly logger = new Logger(LoginSessionService.name);
  private activeSessions: Map<string, LoginSession> = new Map();
  private keepAliveIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Ensure profiles directory exists
    if (!fs.existsSync(PROFILES_DIR)) {
      fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }
  }

  /**
   * Get the profile path for a user's board session.
   */
  getProfilePath(userId: string, board: string): string {
    const profileDir = path.join(PROFILES_DIR, userId, board);
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    return profileDir;
  }

  /**
   * Check if a persistent profile exists for a board.
   */
  hasProfile(userId: string, board: string): boolean {
    const profileDir = this.getProfilePath(userId, board);
    // Check if the profile has actual data (cookies, etc.)
    try {
      const files = fs.readdirSync(profileDir);
      return files.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Start a login session — launches browser with persistent profile.
   */
  async startLoginSession(userId: string, board: string): Promise<LoginSession> {
    const existingKey = `${userId}:${board}`;
    
    // Close any existing session for this board
    if (this.activeSessions.has(existingKey)) {
      await this.endLoginSession(existingKey);
    }

    const config = BOARD_CONFIGS[board];
    if (!config) {
      throw new Error(`Unsupported board: ${board}`);
    }

    const profilePath = this.getProfilePath(userId, board);
    const sessionId = existingKey;

    const session: LoginSession = {
      id: sessionId,
      board,
      userId,
      status: 'connecting',
      context: null,
      page: null,
      popupPage: null,
      lastScreenshot: null,
      createdAt: new Date(),
    };

    this.activeSessions.set(sessionId, session);

    try {
      // Clean up stale lock files from crashed processes
      this.cleanProfileLocks(profilePath);

      // Launch persistent context with user data dir
      const context = await chromium.launchPersistentContext(profilePath, {
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-infobars',
          '--window-size=1920,1080',
          '--start-maximized',
        ],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        bypassCSP: true,
      });

      const page = await context.newPage();
      session.context = context;
      session.page = page;
      session.status = 'ready';

      // Listen for popups (Google OAuth, etc.)
      context.on('page', (newPage: Page) => {
        this.logger.log(`Popup detected: ${newPage.url()}`);
        session.popupPage = newPage;

        // When popup closes, clear it
        newPage.on('close', () => {
          this.logger.log('Popup closed, switching back to main page');
          session.popupPage = null;
        });
      });

      // Navigate to login page
      await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      // Take initial screenshot
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 });
      session.lastScreenshot = screenshot.toString('base64');

      // Check if already logged in
      const isLoggedIn = await this.checkLoggedIn(page, config);
      if (isLoggedIn) {
        session.status = 'logged_in';
      }

      this.logger.log(`Login session started for ${board} (user: ${userId}), status: ${session.status}`);
      return session;
    } catch (error) {
      session.status = 'closed';
      this.logger.error(`Failed to start login session: ${error}`);
      throw error;
    }
  }

  /**
   * Get the currently active page (popup if open, otherwise main).
   */
  private getActivePage(session: LoginSession): Page | null {
    if (session.popupPage && !session.popupPage.isClosed()) {
      return session.popupPage;
    }
    return session.page;
  }

  /**
   * Get a screenshot of the current page.
   */
  async getScreenshot(sessionId: string): Promise<{ screenshot: string; url: string; status: string; isPopup: boolean }> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) {
      throw new Error('No active session');
    }

    try {
      const activePage = this.getActivePage(session);
      if (!activePage || activePage.isClosed()) {
        return {
          screenshot: session.lastScreenshot || '',
          url: '',
          status: session.status,
          isPopup: false,
        };
      }

      const screenshot = await activePage.screenshot({ type: 'jpeg', quality: 70 });
      session.lastScreenshot = screenshot.toString('base64');

      // Check login status on main page (not popup)
      const config = BOARD_CONFIGS[session.board];
      if (config && session.status !== 'logged_in' && !session.popupPage) {
        const isLoggedIn = await this.checkLoggedIn(session.page, config);
        if (isLoggedIn) {
          session.status = 'logged_in';
          this.logger.log(`User logged in to ${session.board}!`);
        }
      }

      return {
        screenshot: session.lastScreenshot,
        url: activePage.url(),
        status: session.status,
        isPopup: !!session.popupPage && !session.popupPage.isClosed(),
      };
    } catch {
      return {
        screenshot: session.lastScreenshot || '',
        url: '',
        status: session.status,
        isPopup: false,
      };
    }
  }

  /**
   * Navigate to a specific URL within the session.
   */
  async navigate(sessionId: string, url: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) throw new Error('No active session');

    const activePage = this.getActivePage(session);
    if (!activePage || activePage.isClosed()) throw new Error('No active page');

    await activePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await activePage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }

  /**
   * Send a click at specific coordinates.
   */
  async click(sessionId: string, x: number, y: number): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) throw new Error('No active session');

    const activePage = this.getActivePage(session);
    if (!activePage || activePage.isClosed()) throw new Error('No active page');

    await activePage.mouse.click(x, y);
    await this.sleep(500);
  }

  /**
   * Send text input (types into the currently focused element).
   */
  async type(sessionId: string, text: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) throw new Error('No active session');

    const activePage = this.getActivePage(session);
    if (!activePage || activePage.isClosed()) throw new Error('No active page');

    await activePage.keyboard.type(text, { delay: 50 });
  }

  /**
   * Send a keyboard action (Enter, Tab, Backspace, etc.)
   */
  async keyPress(sessionId: string, key: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) throw new Error('No active session');

    const activePage = this.getActivePage(session);
    if (!activePage || activePage.isClosed()) throw new Error('No active page');

    await activePage.keyboard.press(key);
    await this.sleep(300);
  }

  /**
   * Clear the focused input field.
   */
  async clearField(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session?.page) throw new Error('No active session');

    const activePage = this.getActivePage(session);
    if (!activePage || activePage.isClosed()) throw new Error('No active page');

    await activePage.keyboard.press('Control+a');
    await activePage.keyboard.press('Backspace');
  }

  /**
   * End the login session (browser closes but profile persists).
   */
  async endLoginSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      try {
        if (session.page) await session.page.close().catch(() => {});
        if (session.context) await session.context.close().catch(() => {});
      } catch { /* ignore */ }
      session.status = 'closed';
      session.page = null;
      session.context = null;
      this.activeSessions.delete(sessionId);
      this.logger.log(`Login session ended for ${session.board} (user: ${session.userId})`);
    }

    // Clear keep-alive interval
    const interval = this.keepAliveIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.keepAliveIntervals.delete(sessionId);
    }
  }

  /**
   * Get session status.
   */
  getSession(sessionId: string): LoginSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * List saved profiles.
   */
  getSavedProfiles(userId: string): { board: string; name: string; hasProfile: boolean }[] {
    return Object.entries(BOARD_CONFIGS).map(([board, config]) => ({
      board,
      name: config.name,
      hasProfile: this.hasProfile(userId, board),
    }));
  }

  /**
   * Get a BrowserContext using a persistent profile for applying.
   * IMPORTANT: Closes any active login session first to avoid profile directory lock.
   */
  async getApplyContext(userId: string, board: string): Promise<BrowserContext | null> {
    if (!this.hasProfile(userId, board)) {
      return null;
    }

    // Close any active login session that's holding the profile lock
    const sessionKey = `${userId}:${board}`;
    if (this.activeSessions.has(sessionKey)) {
      this.logger.log(`Closing active login session for ${board} before apply`);
      await this.endLoginSession(sessionKey);
      await new Promise(r => setTimeout(r, 1000)); // Wait for browser to fully close
    }

    const profilePath = this.getProfilePath(userId, board);

    // Clean up stale lock files from crashed processes
    this.cleanProfileLocks(profilePath);

    try {
      const context = await chromium.launchPersistentContext(profilePath, {
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-infobars',
          '--window-size=1920,1080',
          '--start-maximized',
        ],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        bypassCSP: true,
      });
      return context;
    } catch (error) {
      this.logger.error(`Failed to get apply context: ${error}`);
      return null;
    }
  }

  /**
   * Remove stale Chromium lock files from a profile directory.
   */
  private cleanProfileLocks(profilePath: string): void {
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
    for (const lockFile of lockFiles) {
      const lockPath = path.join(profilePath, lockFile);
      try {
        if (fs.existsSync(lockPath)) {
          fs.unlinkSync(lockPath);
          this.logger.log(`Removed stale lock file: ${lockPath}`);
        }
      } catch { /* ignore */ }
    }
  }

  /**
   * Delete a saved profile.
   */
  deleteProfile(userId: string, board: string): void {
    const profileDir = this.getProfilePath(userId, board);
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
      this.logger.log(`Deleted profile for ${board} (user: ${userId})`);
    } catch (error) {
      this.logger.error(`Failed to delete profile: ${error}`);
    }
  }

  /**
   * Refresh cookies for a board — navigates briefly to keep session alive.
   */
  async refreshSession(userId: string, board: string): Promise<boolean> {
    if (!this.hasProfile(userId, board)) return false;

    const config = BOARD_CONFIGS[board];
    if (!config) return false;

    try {
      const context = await this.getApplyContext(userId, board);
      if (!context) return false;

      const page = await context.newPage();
      await page.goto(config.loginUrl.replace('/auth', '').replace('/login', ''), {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

      const isLoggedIn = await this.checkLoggedIn(page, config);
      await page.close();
      await context.close();

      this.logger.log(`Session refresh for ${board}: ${isLoggedIn ? 'still logged in' : 'expired'}`);
      return isLoggedIn;
    } catch (error) {
      this.logger.error(`Session refresh failed for ${board}: ${error}`);
      return false;
    }
  }

  /**
   * Check if the page indicates a successful login.
   */
  private async checkLoggedIn(page: Page, config: BoardLoginConfig): Promise<boolean> {
    try {
      // Check selectors
      for (const selector of config.loggedInSelectors) {
        try {
          const el = page.locator(selector);
          if (await el.first().isVisible({ timeout: 1000 }).catch(() => false)) {
            return true;
          }
        } catch { /* continue */ }
      }

      // Check text indicators
      const bodyText = await page.evaluate(() =>
        document.body.textContent?.toLowerCase() || '',
      );
      for (const indicator of config.loggedInIndicators) {
        if (bodyText.includes(indicator.toLowerCase())) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
