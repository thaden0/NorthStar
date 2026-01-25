import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

export interface BrowseResult {
  url: string;
  title: string;
  content: string;
  links: Array<{ text: string; href: string }>;
  images: Array<{ alt: string; src: string }>;
  error?: string;
}

export interface ScreenshotResult {
  url: string;
  screenshot: string; // Base64 encoded
  error?: string;
}

@Injectable()
export class PlaywrightService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlaywrightService.name);
  private browser: Browser | null = null;
  private readonly headless: boolean;
  private readonly timeout: number;

  constructor(private configService: ConfigService) {
    this.headless = configService.get('PLAYWRIGHT_HEADLESS', 'true') === 'true';
    this.timeout = parseInt(
      configService.get('PLAYWRIGHT_TIMEOUT', '30000'),
      10,
    );
  }

  async onModuleInit() {
    await this.initBrowser();
  }

  async onModuleDestroy() {
    await this.closeBrowser();
  }

  private async initBrowser() {
    if (!this.browser) {
      this.logger.log('Initializing Playwright browser...');
      this.browser = await chromium.launch({
        headless: this.headless,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      this.logger.log('Playwright browser initialized');
    }
  }

  private async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.log('Playwright browser closed');
    }
  }

  private async getContext(): Promise<BrowserContext> {
    if (!this.browser) {
      await this.initBrowser();
    }
    return this.browser!.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });
  }

  async browsePage(url: string): Promise<BrowseResult> {
    const context = await this.getContext();
    let page: Page | null = null;

    try {
      page = await context.newPage();
      page.setDefaultTimeout(this.timeout);

      this.logger.log(`Browsing URL: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Wait for the page to be somewhat stable
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        // Ignore timeout, continue with what we have
      });

      const title = await page.title();

      // Extract main content - try common content selectors
      const content = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach((el) => el.remove());

        // Try to find main content
        const selectors = [
          'main',
          'article',
          '[role="main"]',
          '.content',
          '.post-content',
          '.article-content',
          '#content',
          '#main',
        ];

        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent && el.textContent.trim().length > 100) {
            return el.textContent.trim().substring(0, 10000);
          }
        }

        // Fall back to body
        return document.body.textContent?.trim().substring(0, 10000) || '';
      });

      // Extract links
      const links = await page.evaluate(() => {
        const anchors = document.querySelectorAll('a[href]');
        return Array.from(anchors)
          .slice(0, 50)
          .map((a) => ({
            text: a.textContent?.trim() || '',
            href: (a as HTMLAnchorElement).href,
          }))
          .filter((l) => l.text && l.href.startsWith('http'));
      });

      // Extract images
      const images = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img[src]');
        return Array.from(imgs)
          .slice(0, 20)
          .map((img) => ({
            alt: (img as HTMLImageElement).alt || '',
            src: (img as HTMLImageElement).src,
          }))
          .filter((i) => i.src.startsWith('http'));
      });

      return { url, title, content, links, images };
    } catch (error) {
      this.logger.error(`Error browsing ${url}: ${error}`);
      return {
        url,
        title: '',
        content: '',
        links: [],
        images: [],
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (page) await page.close();
      await context.close();
    }
  }

  async takeScreenshot(url: string): Promise<ScreenshotResult> {
    const context = await this.getContext();
    let page: Page | null = null;

    try {
      page = await context.newPage();
      page.setDefaultTimeout(this.timeout);

      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const screenshotBuffer = await page.screenshot();
      const screenshot = screenshotBuffer.toString('base64');

      return { url, screenshot };
    } catch (error) {
      this.logger.error(`Error taking screenshot of ${url}: ${error}`);
      return {
        url,
        screenshot: '',
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (page) await page.close();
      await context.close();
    }
  }

  async extractStructuredData(url: string): Promise<Record<string, unknown>> {
    const context = await this.getContext();
    let page: Page | null = null;

    try {
      page = await context.newPage();
      page.setDefaultTimeout(this.timeout);

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const structuredData = await page.evaluate(() => {
        const scripts = document.querySelectorAll(
          'script[type="application/ld+json"]',
        );
        const data: Record<string, unknown>[] = [];

        scripts.forEach((script) => {
          try {
            const parsed = JSON.parse(script.textContent || '');
            data.push(parsed);
          } catch {
            // Ignore parse errors
          }
        });

        return data;
      });

      return { url, structuredData };
    } catch (error) {
      this.logger.error(`Error extracting structured data from ${url}: ${error}`);
      return {
        url,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (page) await page.close();
      await context.close();
    }
  }
}
