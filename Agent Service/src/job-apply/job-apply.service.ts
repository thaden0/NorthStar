import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from '../llm/ollama.service';
import { PlaywrightService } from '../tools/playwright.service';
import { LoginSessionService } from './login-session.service';
import { Page, BrowserContext } from 'playwright';
import * as fs from 'fs';

export interface ApplicationStep {
  id: number;
  timestamp: string;
  action: 'navigating' | 'analyzing' | 'filling_field' | 'uploading' | 'clicking' | 'waiting' | 'screenshot' | 'error' | 'complete' | 'needs_review';
  description: string;
  screenshot?: string; // base64 (only periodic)
  success: boolean;
  details?: string;
}

export interface ApplyRequest {
  job: {
    id: string;
    title: string;
    company: string;
    sourceUrl: string;
    description: string | null;
  };
  resume: {
    name: string;
    skills: string[];
    experienceYears: number | null;
    summary: string | null;
    content: string | null;
    fileData: string | null; // base64 PDF
  } | null;
  coverLetter: {
    content: string;
  } | null;
  userInfo: {
    name: string;
    email: string;
    phone?: string;
  };
  model?: string;
  boardCredentials?: {
    email: string;
    password: string;
  };
}

export interface ApplyResult {
  status: 'submitted' | 'failed' | 'needs_review';
  steps: ApplicationStep[];
  errorMessage?: string;
  lastScreenshot?: string;
}

interface PageAnalysis {
  url: string;
  title: string;
  applyButtons: Array<{ text: string; selector: string }>;
  formFields: Array<{ label: string; type: string; name: string; id: string; required: boolean; value: string }>;
  radioGroups: Array<{ label: string; name: string; options: Array<{ value: string; text: string; selector: string; checked: boolean }> }>;
  checkboxFields: Array<{ label: string; selector: string; checked: boolean; name: string }>;
  submitButtons: Array<{ text: string; selector: string }>;
  textContent: string;
  isConfirmationPage: boolean;
  isLoginRequired: boolean;
}

@Injectable()
export class JobApplyService {
  private readonly logger = new Logger(JobApplyService.name);
  private readonly defaultModel = 'phi4:latest';
  private readonly MAX_STEPS = 30;

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly playwrightService: PlaywrightService,
    private readonly loginSessionService: LoginSessionService,
  ) {}

  async applyToJob(
    request: ApplyRequest,
    onStep: (step: ApplicationStep) => void,
  ): Promise<ApplyResult> {
    const steps: ApplicationStep[] = [];
    let stepCount = 0;
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let lastScreenshot = '';

    const addStep = (step: Omit<ApplicationStep, 'id' | 'timestamp'>): ApplicationStep => {
      const fullStep: ApplicationStep = {
        ...step,
        id: ++stepCount,
        timestamp: new Date().toISOString(),
      };
      steps.push(fullStep);
      onStep(fullStep);
      this.logger.log(`[Apply ${request.job.id}] Step ${stepCount}: ${step.action} - ${step.description}`);
      return fullStep;
    };

    try {
      // Step 1: Open browser and navigate — try persistent profile first
      addStep({
        action: 'navigating',
        description: `Opening ${request.job.company} job listing...`,
        success: true,
      });

      // Detect board and try to use persistent profile
      const sourceUrl = request.job.sourceUrl?.toLowerCase() || '';
      let boardKey: string | null = null;
      if (sourceUrl.includes('indeed.com') || sourceUrl.includes('indeed.ca')) boardKey = 'indeed';
      else if (sourceUrl.includes('linkedin.com')) boardKey = 'linkedin';
      else if (sourceUrl.includes('glassdoor.com')) boardKey = 'glassdoor';
      else if (sourceUrl.includes('ziprecruiter.com')) boardKey = 'ziprecruiter';

      let usedPersistentProfile = false;
      if (boardKey && request.userInfo?.email) {
        // Use a simple user ID from email for profile lookup
        const userId = request.userInfo.email.replace(/[^a-zA-Z0-9]/g, '_');
        const profileContext = await this.loginSessionService.getApplyContext(userId, boardKey);
        if (profileContext) {
          context = profileContext;
          usedPersistentProfile = true;
          addStep({
            action: 'analyzing',
            description: `Using saved ${boardKey} login session`,
            success: true,
          });
        }
      }

      if (!usedPersistentProfile) {
        context = await this.playwrightService.getContext();
      }
      page = await context!.newPage();
      page.setDefaultTimeout(15000);

      await page.goto(request.job.sourceUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      // Take initial screenshot
      const initScreenshot = (await page.screenshot()).toString('base64');
      lastScreenshot = initScreenshot;
      addStep({
        action: 'screenshot',
        description: 'Job listing page loaded',
        screenshot: initScreenshot,
        success: true,
      });

      // Detect job board and use specific strategy
      const boardStrategy = this.detectJobBoard(request.job.sourceUrl);
      if (boardStrategy) {
        addStep({
          action: 'analyzing',
          description: `Detected ${boardStrategy.name} — using optimized strategy`,
          success: true,
        });

        // Step 1: Click the apply button using board-specific selectors
        let clickedApply = false;
        for (const selector of boardStrategy.applySelectors) {
          try {
            const locator = page.locator(selector).first();
            if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
              addStep({
                action: 'clicking',
                description: `Clicking apply button on ${boardStrategy.name}...`,
                success: true,
              });
              await locator.click({ timeout: 5000 });
              await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
              await this.sleep(2000);
              clickedApply = true;
              break;
            }
          } catch { /* try next selector */ }
        }

        if (!clickedApply) {
          // Try text-based as fallback
          for (const text of boardStrategy.applyTexts) {
            try {
              const btn = page.getByRole('button', { name: text, exact: false }).first();
              if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
                addStep({
                  action: 'clicking',
                  description: `Clicking "${text}" on ${boardStrategy.name}...`,
                  success: true,
                });
                await btn.click({ timeout: 5000 });
                await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
                await this.sleep(2000);
                clickedApply = true;
                break;
              }
              // Also try links
              const link = page.getByRole('link', { name: text, exact: false }).first();
              if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
                await link.click({ timeout: 5000 });
                await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
                await this.sleep(2000);
                clickedApply = true;
                break;
              }
            } catch { /* try next */ }
          }
        }

        if (clickedApply) {
          const screenshot = (await page.screenshot()).toString('base64');
          lastScreenshot = screenshot;
          addStep({
            action: 'screenshot',
            description: 'After clicking apply',
            screenshot,
            success: true,
          });

          // Check if we got redirected to an external site or login
          const newUrl = page.url();
          const bodyText = await page.evaluate(() => document.body.textContent?.toLowerCase() || '');

          if (bodyText.includes('sign in') || bodyText.includes('log in') || bodyText.includes('create an account')) {
            // Check if this looks like a login redirect (not just header text)
            const isLoginPage = newUrl.includes('/auth') || newUrl.includes('/login') || newUrl.includes('/signin') ||
              bodyText.includes('sign in to apply') || bodyText.includes('log in to apply');
            if (isLoginPage) {
              const description = usedPersistentProfile
                ? `${boardStrategy.name} session has expired — please re-login in Settings`
                : `${boardStrategy.name} requires login to apply`;
              addStep({
                action: 'needs_review',
                description,
                screenshot,
                success: false,
                details: 'This job requires you to log in or create an account on the job board. Please apply manually.',
              });
              return { status: 'needs_review', steps, lastScreenshot };
            }
          }

          this.logger.log(`[Apply ${request.job.id}] After apply click, now on: ${newUrl}`);
        } else {
          addStep({
            action: 'error',
            description: `Could not find apply button on ${boardStrategy.name}`,
            success: false,
          });
        }
      }

      // Main agent loop
      let applied = false;
      let needsReview = false;
      const errorMsg = '';
      let consecutiveErrors = 0;

      while (stepCount < this.MAX_STEPS && !applied && !needsReview && consecutiveErrors < 3) {
        // Analyze the current page
        const analysis = await this.analyzePage(page);

        // Check if we've reached a confirmation/success page
        if (analysis.isConfirmationPage) {
          const screenshot = (await page.screenshot()).toString('base64');
          lastScreenshot = screenshot;
          addStep({
            action: 'complete',
            description: 'Application submitted successfully!',
            screenshot,
            success: true,
          });
          applied = true;
          break;
        }

        // Check if login is required
        if (analysis.isLoginRequired) {
          if (request.boardCredentials) {
            addStep({
              action: 'analyzing',
              description: 'Login required — attempting sign-in with saved credentials...',
              success: true,
            });

            const loginSuccess = await this.attemptLogin(page, request.boardCredentials, request.job.sourceUrl);
            if (loginSuccess) {
              addStep({
                action: 'navigating',
                description: 'Signed in successfully! Continuing application...',
                success: true,
              });
              const screenshot = (await page.screenshot()).toString('base64');
              lastScreenshot = screenshot;
              addStep({
                action: 'screenshot',
                description: 'After login',
                screenshot,
                success: true,
              });
              continue; // Re-analyze the page now that we're logged in
            } else {
              const screenshot = (await page.screenshot()).toString('base64');
              lastScreenshot = screenshot;
              addStep({
                action: 'needs_review',
                description: 'Login failed — could not sign in with saved credentials',
                screenshot,
                success: false,
                details: 'The agent could not log in. Check your saved credentials in Job Search settings.',
              });
              needsReview = true;
              break;
            }
          } else {
            const screenshot = (await page.screenshot()).toString('base64');
            lastScreenshot = screenshot;
            addStep({
              action: 'needs_review',
              description: 'Login required — no credentials saved',
              screenshot,
              success: false,
              details: 'Save your job board login credentials in Settings → Job Search to enable auto-login.',
            });
            needsReview = true;
            break;
          }
        }

        // ALWAYS click apply buttons first — they take priority over any form fields
        if (analysis.applyButtons.length > 0) {
          const btn = analysis.applyButtons[0];
          addStep({
            action: 'clicking',
            description: `Clicking "${btn.text}" button...`,
            success: true,
          });
          try {
            await this.clickByText(page, btn.text, btn.selector);
            await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
            await this.sleep(1500);
            consecutiveErrors = 0;
          } catch (err) {
            consecutiveErrors++;
            addStep({
              action: 'error',
              description: `Failed to click "${btn.text}": ${err instanceof Error ? err.message : err}`,
              success: false,
            });
          }
          continue;
        }

        // If there are form fields, radio groups, or checkboxes — use LLM to decide
        const hasInteractiveElements = analysis.formFields.length > 0 || analysis.radioGroups.length > 0 || analysis.checkboxFields.length > 0;
        if (hasInteractiveElements) {
          const actions = await this.decideFormActions(analysis, request);

          for (const action of actions) {
            if (stepCount >= this.MAX_STEPS) break;

            if (action.type === 'fill') {
              addStep({
                action: 'filling_field',
                description: `Filling "${action.label}": ${action.value.substring(0, 50)}${action.value.length > 50 ? '...' : ''}`,
                success: true,
              });
              try {
                await page.fill(action.selector, action.value);
                await this.sleep(300);
              } catch {
                // Try clicking then typing
                try {
                  await page.click(action.selector);
                  await page.fill(action.selector, action.value);
                } catch (err2) {
                  addStep({
                    action: 'error',
                    description: `Failed to fill "${action.label}": ${err2 instanceof Error ? err2.message : err2}`,
                    success: false,
                  });
                }
              }
            } else if (action.type === 'radio') {
              addStep({
                action: 'filling_field',
                description: `Selecting "${action.value}" for "${action.label}"`,
                success: true,
              });
              try {
                await page.click(action.selector);
                await this.sleep(300);
              } catch (err) {
                addStep({
                  action: 'error',
                  description: `Failed to select radio "${action.label}": ${err instanceof Error ? err.message : err}`,
                  success: false,
                });
              }
            } else if (action.type === 'checkbox') {
              addStep({
                action: 'filling_field',
                description: `Checking "${action.label}"`,
                success: true,
              });
              try {
                await page.click(action.selector);
                await this.sleep(300);
              } catch (err) {
                addStep({
                  action: 'error',
                  description: `Failed to check "${action.label}": ${err instanceof Error ? err.message : err}`,
                  success: false,
                });
              }
            } else if (action.type === 'select') {
              addStep({
                action: 'filling_field',
                description: `Selecting "${action.value}" for "${action.label}"`,
                success: true,
              });
              try {
                await page.selectOption(action.selector, { label: action.value });
              } catch {
                try { await page.selectOption(action.selector, action.value); } catch { /* ignore */ }
              }
            } else if (action.type === 'upload') {
              if (request.resume?.fileData) {
                addStep({
                  action: 'uploading',
                  description: `Uploading resume to "${action.label}"`,
                  success: true,
                });
                try {
                  // Write base64 to temp file
                  const tmpPath = `/tmp/resume_${Date.now()}.pdf`;
                  fs.writeFileSync(tmpPath, Buffer.from(request.resume.fileData, 'base64'));
                  await page.setInputFiles(action.selector, tmpPath);
                  fs.unlinkSync(tmpPath);
                } catch (err) {
                  addStep({
                    action: 'error',
                    description: `Failed to upload file: ${err instanceof Error ? err.message : err}`,
                    success: false,
                  });
                }
              }
            } else if (action.type === 'textarea') {
              const text = action.isCoverLetter && request.coverLetter?.content
                ? request.coverLetter.content
                : action.value;
              addStep({
                action: 'filling_field',
                description: `Writing in "${action.label}" (${text.length} chars)`,
                success: true,
              });
              try {
                await page.fill(action.selector, text);
              } catch {
                try {
                  await page.click(action.selector);
                  await page.fill(action.selector, text);
                } catch { /* ignore */ }
              }
            }
          }

          // Take screenshot after filling
          if (stepCount % 5 === 0 || analysis.submitButtons.length > 0) {
            const screenshot = (await page.screenshot()).toString('base64');
            lastScreenshot = screenshot;
            addStep({
              action: 'screenshot',
              description: 'Form progress',
              screenshot,
              success: true,
            });
          }

          // If there's a submit/next button, click it
          if (analysis.submitButtons.length > 0) {
            const submitBtn = analysis.submitButtons[0];
            addStep({
              action: 'clicking',
              description: `Clicking "${submitBtn.text}" button...`,
              success: true,
            });
            try {
              await this.clickByText(page, submitBtn.text, submitBtn.selector);
              await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
              await this.sleep(2000);
              consecutiveErrors = 0;
            } catch (err) {
              consecutiveErrors++;
              addStep({
                action: 'error',
                description: `Failed to click submit: ${err instanceof Error ? err.message : err}`,
                success: false,
              });
            }
            continue;
          }

          continue;
        }

        // No interactive elements and no apply buttons — just a continue/next page
        if (analysis.applyButtons.length === 0 && !hasInteractiveElements) {
          // Check for submit/continue/next buttons first (Indeed wizard steps like "Add Resume")
          if (analysis.submitButtons.length > 0) {
            const submitBtn = analysis.submitButtons[0];
            const isSubmitApplication = submitBtn.text.toLowerCase().includes('submit your application') ||
              submitBtn.text.toLowerCase().includes('submit application');

            addStep({
              action: 'clicking',
              description: `Clicking "${submitBtn.text}"${isSubmitApplication ? ' (final submit)' : ' to continue'}...`,
              success: true,
            });
            try {
              // Try to solve any CAPTCHA BEFORE clicking submit
              if (isSubmitApplication) {
                const preCaptcha = await this.trySolveCaptcha(page);
                if (preCaptcha) {
                  addStep({ action: 'analyzing', description: 'Solved CAPTCHA checkbox', success: true });
                  await this.sleep(1000);
                }
              }

              // Scroll the button into view first
              await page.evaluate((sel) => {
                const el = document.querySelector(sel) as HTMLElement;
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, submitBtn.selector);
              await this.sleep(500);

              const urlBefore = page.url();
              await this.clickByText(page, submitBtn.text, submitBtn.selector);
              await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
              await this.sleep(3000);

              const urlAfter = page.url();
              // Check if page changed or if we see confirmation
              const postClickText = await page.evaluate(() => document.body.textContent?.toLowerCase() || '');

              // Check for "already applied" scenario
              if (postClickText.includes('already applied') || postClickText.includes('you have already submitted') || postClickText.includes('duplicate application')) {
                const screenshot = (await page.screenshot()).toString('base64');
                lastScreenshot = screenshot;
                addStep({
                  action: 'complete',
                  description: 'Already applied to this job previously.',
                  screenshot,
                  success: true,
                });
                applied = true;
                break;
              }

              if (postClickText.includes('application submitted') ||
                  postClickText.includes('your application has been submitted') ||
                  postClickText.includes('thank you for applying') ||
                  postClickText.includes('thanks for applying') ||
                  postClickText.includes('application received') ||
                  postClickText.includes('you have successfully applied') ||
                  postClickText.includes('application complete') ||
                  postClickText.includes('application sent') ||
                  postClickText.includes('your application was sent') ||
                  urlAfter.includes('post-apply') ||
                  urlAfter.includes('application-submitted') ||
                  urlAfter.includes('confirmation')) {
                const screenshot = (await page.screenshot()).toString('base64');
                lastScreenshot = screenshot;
                addStep({
                  action: 'complete',
                  description: 'Application submitted successfully!',
                  screenshot,
                  success: true,
                });
                applied = true;
                break;
              }

              if (urlBefore === urlAfter && isSubmitApplication) {
                // Same page after clicking final submit — try to solve CAPTCHA first
                const pageSnippet = postClickText.substring(0, 500);
                this.logger.warn(`[Apply ${request.job.id}] Submit click didn't change page. Page text: ${pageSnippet}`);

                // Try to find and click reCAPTCHA
                const captchaSolved = await this.trySolveCaptcha(page);
                if (captchaSolved) {
                  addStep({
                    action: 'analyzing',
                    description: 'Solved CAPTCHA — retrying submit...',
                    success: true,
                  });
                  // Retry the submit click after CAPTCHA
                  await this.clickByText(page, submitBtn.text, submitBtn.selector);
                  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
                  await this.sleep(3000);
                  
                  // Check again for confirmation
                  const postRetryText = await page.evaluate(() => document.body.textContent?.toLowerCase() || '');
                  const retryUrl = page.url();
                  if (postRetryText.includes('application submitted') ||
                      postRetryText.includes('your application has been submitted') ||
                      postRetryText.includes('thank you for applying') ||
                      postRetryText.includes('thanks for applying') ||
                      retryUrl.includes('post-apply') ||
                      retryUrl !== urlBefore) {
                    const screenshot = (await page.screenshot()).toString('base64');
                    lastScreenshot = screenshot;
                    addStep({
                      action: 'complete',
                      description: 'Application submitted successfully!',
                      screenshot,
                      success: true,
                    });
                    applied = true;
                    break;
                  }
                }

                // Still stuck — needs manual review
                const screenshot = (await page.screenshot()).toString('base64');
                lastScreenshot = screenshot;
                addStep({
                  action: 'needs_review',
                  description: 'Clicked submit but page did not change — may need manual review (CAPTCHA, missing fields, etc.)',
                  screenshot,
                  success: false,
                });
                needsReview = true;
                break;
              }
              consecutiveErrors = 0;
            } catch (err) {
              consecutiveErrors++;
              addStep({
                action: 'error',
                description: `Failed to click "${submitBtn.text}": ${err instanceof Error ? err.message : err}`,
                success: false,
              });
            }
            continue;
          }

          // Try to find any apply-related link on the page
          const applyLink = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const applyLink = links.find(l => {
              const text = l.textContent?.toLowerCase() || '';
              return text.includes('apply') || text.includes('submit application');
            });
            return applyLink ? { text: applyLink.textContent?.trim() || '', href: applyLink.href } : null;
          });

          if (applyLink) {
            addStep({
              action: 'navigating',
              description: `Following link: "${applyLink.text}"`,
              success: true,
            });
            await page.goto(applyLink.href, { waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
            continue;
          }

          // Nothing found — stuck
          const screenshot = (await page.screenshot()).toString('base64');
          lastScreenshot = screenshot;
          addStep({
            action: 'needs_review',
            description: 'Unable to find application form or apply button',
            screenshot,
            success: false,
            details: 'The agent could not locate an application form on this page. You may need to apply manually.',
          });
          needsReview = true;
          break;
        }
      }

      if (!applied && !needsReview) {
        const screenshot = (await page.screenshot()).toString('base64');
        lastScreenshot = screenshot;
        const reason = consecutiveErrors >= 3
          ? 'Too many errors — unable to interact with the page'
          : 'Maximum steps reached — application may be incomplete';
        addStep({
          action: 'needs_review',
          description: reason,
          screenshot,
          success: false,
          details: 'The agent was unable to complete the application. Please apply manually.',
        });
        needsReview = true;
      }

      const finalStatus = applied ? 'submitted' : needsReview ? 'needs_review' : 'failed';
      return {
        status: finalStatus,
        steps,
        errorMessage: errorMsg || undefined,
        lastScreenshot,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Apply ${request.job.id}] Fatal error: ${errMsg}`);
      addStep({
        action: 'error',
        description: `Application failed: ${errMsg}`,
        success: false,
      });

      if (page) {
        try {
          lastScreenshot = (await page.screenshot()).toString('base64');
        } catch { /* ignore */ }
      }

      return {
        status: 'failed',
        steps,
        errorMessage: errMsg,
        lastScreenshot,
      };
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  private async analyzePage(page: Page): Promise<PageAnalysis> {
    const url = page.url();
    const title = await page.title();

    const result = await page.evaluate(() => {
      // Helper: generate a robust selector for an element
      function getSelector(el: Element): string {
        // 1. ID is best (but escape special chars for CSS)
        if (el.id) {
          // React IDs like :r0: contain colons — need CSS.escape
          const hasSpecial = /[^a-zA-Z0-9_-]/.test(el.id);
          if (hasSpecial) {
            return `[id="${el.id}"]`;
          }
          return `#${el.id}`;
        }
        // 2. data-testid
        const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
        if (testId) return `[data-testid="${testId}"]`;
        // 3. For buttons/links use text-based selector
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent?.trim() || '').substring(0, 60);
        if (text && (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button')) {
          // Use :has-text for Playwright — but since we're returning strings, use role-based
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel) return `${tag}[aria-label="${ariaLabel}"]`;
          // Use unique class + text combo
          const cls = el.className && typeof el.className === 'string' ? el.className.split(' ').filter(c => c && c.length > 2 && !c.startsWith('css-')).slice(0, 2).join('.') : '';
          if (cls) return `${tag}.${cls}`;
        }
        // 4. name attribute
        const name = el.getAttribute('name');
        if (name) return `${tag}[name="${name}"]`;
        // 5. Combine tag + class
        const cls = el.className && typeof el.className === 'string' ? el.className.split(' ').filter(c => c && c.length > 2).slice(0, 2).join('.') : '';
        if (cls) return `${tag}.${cls}`;
        // 6. aria-label
        const ariaL = el.getAttribute('aria-label');
        if (ariaL) return `${tag}[aria-label="${ariaL}"]`;
        // Fallback: basic CSS path
        return tag;
      }

      // Helper: is the element likely a real interactive button (not nav/skip/menu)
      function isInteractiveButton(el: Element): boolean {
        const text = (el.textContent?.trim() || '').toLowerCase();
        const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        const role = (el.getAttribute('role') || '').toLowerCase();

        // Exclude navigation, skip, header, menu, close, share buttons
        const excludeTexts = ['skip', 'menu', 'close', 'share', 'bookmark', 'save job', 'sign in', 'log in', 'register', 'cookie', 'accept', 'dismiss', 'notification'];
        if (excludeTexts.some(ex => text.startsWith(ex) || text === ex)) return false;
        if (cls.includes('gnav') || cls.includes('nav-') || cls.includes('skip') || cls.includes('header-') || cls.includes('cookie') || cls.includes('modal-close')) return false;
        if (ariaLabel.includes('skip') || ariaLabel.includes('menu') || ariaLabel.includes('close') || ariaLabel.includes('navigation')) return false;
        if (role === 'menuitem' || role === 'tab') return false;

        // Must be visible and reasonably sized
        const rect = el.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 10) return false;
        if (rect.top < 0 || rect.left < 0) return false;

        return true;
      }

      // Find apply / submit buttons
      const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"], a[class*="apply"], a[class*="btn"], [role="button"]'));
      const applyKeywords = ['apply now', 'apply', 'submit application', 'quick apply', 'easy apply', 'start application', 'apply for this job', 'apply to this job'];
      const submitKeywords = ['submit', 'next', 'continue', 'send', 'complete', 'finish', 'save & continue', 'save and continue', 'review', 'confirm'];

      const applyButtons = allButtons
        .filter(el => {
          if (!isInteractiveButton(el)) return false;
          const text = (el.textContent?.trim() || '').toLowerCase();
          return applyKeywords.some(k => text.includes(k));
        })
        .slice(0, 3)
        .map(el => ({
          text: (el.textContent?.trim() || '').substring(0, 80),
          selector: getSelector(el),
        }));

      // Buttons that look like submit but actually exit or go back
      const exitKeywords = ['save and close', 'save & close', 'cancel', 'back', 'discard', 'exit', 'close window', 'not now', 'no thanks', 'maybe later'];

      const submitButtons = allButtons
        .filter(el => {
          if (!isInteractiveButton(el)) return false;
          const text = (el.textContent?.trim() || '').toLowerCase();
          const type = (el as HTMLInputElement).type?.toLowerCase();
          // Exclude exit/dismiss buttons
          if (exitKeywords.some(k => text.includes(k))) return false;
          if (text === 'close' || text === 'back') return false;
          const isSubmit = submitKeywords.some(k => text.includes(k)) || type === 'submit';
          const isApply = applyKeywords.some(k => text.includes(k));
          return isSubmit && !isApply;
        })
        .slice(0, 5)
        .map(el => ({
          text: (el.textContent?.trim() || '').substring(0, 80),
          selector: getSelector(el),
        }))
        // Prioritize 'continue' and 'next' over generic submit buttons
        .sort((a, b) => {
          const priority = ['continue', 'next', 'submit', 'review'];
          const aIdx = priority.findIndex(k => a.text.toLowerCase().includes(k));
          const bIdx = priority.findIndex(k => b.text.toLowerCase().includes(k));
          return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
        })
        .slice(0, 3);

      // Find form fields (text inputs, textareas, selects)
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      const formFields = inputs
        .filter(el => {
          const type = (el as HTMLInputElement).type?.toLowerCase();
          if (['hidden', 'submit', 'button', 'reset', 'search', 'radio', 'checkbox'].includes(type)) return false;
          // Must be visible
          const rect = el.getBoundingClientRect();
          if (rect.width < 10 || rect.height < 10) return false;
          // Exclude search bars, nav inputs, and site-level search fields
          const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
          if (cls.includes('search') || cls.includes('nav-') || cls.includes('gnav')) return false;
          const name = ((el as HTMLInputElement).name || '').toLowerCase();
          const id = (el.id || '').toLowerCase();
          const placeholder = ((el as HTMLInputElement).placeholder || '').toLowerCase();
          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          // Filter out job search fields (Indeed, LinkedIn, etc)
          const searchFieldIndicators = ['what', 'where', 'keyword', 'location', 'search', 'find job', 'job title'];
          if (searchFieldIndicators.some(s => name.includes(s) || id.includes(s) || placeholder.includes(s) || ariaLabel.includes(s))) return false;
          // Filter fields inside nav/header/search containers
          const parent = el.closest('nav, header, [role="search"], [data-gnav], form[role="search"]');
          if (parent) return false;
          return true;
        })
        .slice(0, 20)
        .map(el => {
          const input = el as HTMLInputElement;
          const id = input.id || '';
          const name = input.name || '';
          const label = id
            ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || ''
            : '';
          const placeholder = input.placeholder || '';
          const ariaLabel = input.getAttribute('aria-label') || '';

          return {
            label: label || placeholder || ariaLabel || name || id || 'Unknown',
            type: input.tagName === 'SELECT' ? 'select' : input.tagName === 'TEXTAREA' ? 'textarea' : (input.type || 'text'),
            name,
            id: getSelector(el),
            required: input.required,
            value: input.value || '',
          };
        });

      // Find radio button groups (Indeed questions like "most relevant job")
      const radioInputs = Array.from(document.querySelectorAll('input[type="radio"]'));
      const radioGroupMap: Record<string, { label: string; name: string; options: { value: string; text: string; selector: string; checked: boolean }[] }> = {};
      for (const radio of radioInputs) {
        const input = radio as HTMLInputElement;
        if (!input.name) continue;
        const rect = input.getBoundingClientRect();
        // Radios can be small (custom styled) — check parent visibility
        const parentVisible = input.closest('label, div, li');
        if (parentVisible) {
          const pRect = parentVisible.getBoundingClientRect();
          if (pRect.width < 10 || pRect.height < 10) continue;
        } else if (rect.width < 2 && rect.height < 2) continue;

        if (!radioGroupMap[input.name]) {
          // Try to find the question/label for this radio group
          const fieldset = input.closest('fieldset');
          const legend = fieldset?.querySelector('legend')?.textContent?.trim() || '';
          const groupLabel = input.closest('[class*="question"], [class*="Question"]');
          const questionText = legend || groupLabel?.querySelector('label, h3, h4, p, span')?.textContent?.trim() || '';
          // Also try aria-labelledby
          const ariaLabelledBy = input.getAttribute('aria-labelledby');
          const ariaText = ariaLabelledBy ? document.getElementById(ariaLabelledBy)?.textContent?.trim() || '' : '';

          radioGroupMap[input.name] = {
            label: questionText || ariaText || input.name,
            name: input.name,
            options: [],
          };
        }

        // Get option text from label
        const labelEl = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
        const parentLabel = input.closest('label');
        const optionText = labelEl?.textContent?.trim() || parentLabel?.textContent?.trim() || input.value;

        radioGroupMap[input.name].options.push({
          value: input.value,
          text: optionText,
          selector: getSelector(radio),
          checked: input.checked,
        });
      }
      const radioGroups = Object.values(radioGroupMap).filter(g => g.options.length > 0);

      // Find checkbox questions
      const checkboxInputs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      const checkboxFields = checkboxInputs
        .filter(el => {
          const parent = el.closest('nav, header, [role="search"]');
          if (parent) return false;
          // Exclude email subscription / notification checkboxes
          const labelEl = (el as HTMLInputElement).id ? document.querySelector(`label[for="${(el as HTMLInputElement).id}"]`) : null;
          const parentLabel = el.closest('label');
          const labelText = (labelEl?.textContent || parentLabel?.textContent || '').toLowerCase();
          if (labelText.includes('email update') || labelText.includes('job alert') || labelText.includes('newsletter') || labelText.includes('notify me') || labelText.includes('subscribe')) return false;
          const pEl = el.closest('label, div, li');
          if (pEl) {
            const r = pEl.getBoundingClientRect();
            if (r.width < 10) return false;
          }
          return true;
        })
        .slice(0, 10)
        .map(el => {
          const input = el as HTMLInputElement;
          const labelEl = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
          const parentLabel = input.closest('label');
          return {
            label: labelEl?.textContent?.trim() || parentLabel?.textContent?.trim() || input.name || 'checkbox',
            selector: getSelector(el),
            checked: input.checked,
            name: input.name,
          };
        });

      // Check for login/account indicators
      const bodyText = document.body.textContent?.toLowerCase() || '';
      const isLoginRequired = bodyText.includes('sign in to apply') ||
        bodyText.includes('log in to apply') ||
        bodyText.includes('create an account to apply') ||
        bodyText.includes('sign up to apply');

      // Check for confirmation indicators
      const isConfirmationPage = bodyText.includes('application submitted') ||
        bodyText.includes('thank you for applying') ||
        bodyText.includes('application received') ||
        bodyText.includes('you have successfully applied') ||
        bodyText.includes('application complete');

      const textContent = bodyText.substring(0, 3000);

      return { applyButtons, submitButtons, formFields, radioGroups, checkboxFields, isLoginRequired, isConfirmationPage, textContent };
    });

    return {
      url,
      title,
      ...result,
    };
  }

  private async decideFormActions(
    analysis: PageAnalysis,
    request: ApplyRequest,
  ): Promise<Array<{
    type: 'fill' | 'select' | 'upload' | 'textarea' | 'radio' | 'checkbox';
    selector: string;
    label: string;
    value: string;
    isCoverLetter?: boolean;
  }>> {
    const model = request.model || this.defaultModel;

    // Build descriptions for all interactive elements
    const sections: string[] = [];

    if (analysis.formFields.length > 0) {
      const fieldDescriptions = analysis.formFields.map(f =>
        `- Field: "${f.label}" (type: ${f.type}, selector: ${f.id}, required: ${f.required}, current value: "${f.value}")`
      ).join('\n');
      sections.push(`TEXT FIELDS:\n${fieldDescriptions}`);
    }

    if (analysis.radioGroups.length > 0) {
      const radioDescriptions = analysis.radioGroups.map(g => {
        const optionsList = g.options.map(o =>
          `    - "${o.text}" (value: "${o.value}", selector: ${o.selector}${o.checked ? ', CURRENTLY SELECTED' : ''})`
        ).join('\n');
        return `- Question: "${g.label}"\n  Options:\n${optionsList}`;
      }).join('\n');
      sections.push(`RADIO QUESTIONS (select ONE option per question):\n${radioDescriptions}`);
    }

    if (analysis.checkboxFields.length > 0) {
      const cbDescriptions = analysis.checkboxFields.map(c =>
        `- "${c.label}" (selector: ${c.selector}, currently ${c.checked ? 'CHECKED' : 'unchecked'})`
      ).join('\n');
      sections.push(`CHECKBOXES:\n${cbDescriptions}`);
    }

    // Include some page context for the LLM to understand the page
    const pageContext = analysis.textContent.substring(0, 1500);

    const prompt = `You are an AI agent filling out a job application form. Read the page content and decide what to do for each interactive element.

USER INFO:
- Name: ${request.userInfo.name}
- Email: ${request.userInfo.email}
${request.userInfo.phone ? `- Phone: ${request.userInfo.phone}` : ''}
${request.resume?.skills?.length ? `- Skills: ${request.resume.skills.join(', ')}` : ''}
${request.resume?.experienceYears ? `- Experience: ${request.resume.experienceYears} years` : ''}
${request.resume?.summary ? `- Summary: ${request.resume.summary}` : ''}

JOB BEING APPLIED TO: ${request.job.title} at ${request.job.company}

PAGE CONTEXT:
${pageContext}

${sections.join('\n\n')}

INSTRUCTIONS:
Respond with a JSON array of actions. Each action should have:
- "selector": the element selector (use the one provided)
- "label": the question/field label
- "type": one of "fill", "select", "upload", "textarea", "radio", "checkbox"
- "value": what to enter (for radio, use the option text)
- "isCoverLetter": true ONLY if this is a cover letter/additional info textarea

RULES:
- For RADIO questions: pick the BEST option based on the user's profile and the job. Use "type": "radio" and set "selector" to the specific option's selector.
- For CHECKBOXES: only include if they should be checked (e.g., agreement checkboxes). Use "type": "checkbox".
- Skip fields that already have correct values.
- For "most relevant job title" questions, pick the one most similar to the job being applied for.
- For work authorization questions, answer "Yes" / select the affirmative option.
- For "years of experience" questions, use the user's actual experience.
- For salary, use a reasonable range based on the role.
- For file upload fields, set type to "upload" and value to "resume".

Respond with ONLY the JSON array, no explanation. /no_think`;

    try {
      const result = await this.ollamaService.rawChat({
        model,
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
      });

      let content = result.content.trim();
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const actions = JSON.parse(content);
      return Array.isArray(actions) ? actions : [];
    } catch (error) {
      this.logger.error(`Failed to get LLM form decisions: ${error}`);
      // Fall back to basic matching
      return this.basicFormFill(analysis.formFields, request);
    }
  }

  private basicFormFill(
    fields: PageAnalysis['formFields'],
    request: ApplyRequest,
  ): Array<{ type: 'fill' | 'select' | 'upload' | 'textarea'; selector: string; label: string; value: string; isCoverLetter?: boolean }> {
    const actions: Array<{ type: 'fill' | 'select' | 'upload' | 'textarea'; selector: string; label: string; value: string; isCoverLetter?: boolean }> = [];

    for (const field of fields) {
      if (field.value) continue; // Skip filled fields

      const label = field.label.toLowerCase();
      const type = field.type.toLowerCase();

      if (type === 'file') {
        actions.push({ type: 'upload', selector: field.id, label: field.label, value: 'resume' });
      } else if (label.includes('name') || label.includes('full name')) {
        actions.push({ type: 'fill', selector: field.id, label: field.label, value: request.userInfo.name });
      } else if (label.includes('first') && label.includes('name')) {
        actions.push({ type: 'fill', selector: field.id, label: field.label, value: request.userInfo.name.split(' ')[0] });
      } else if (label.includes('last') && label.includes('name')) {
        const parts = request.userInfo.name.split(' ');
        actions.push({ type: 'fill', selector: field.id, label: field.label, value: parts[parts.length - 1] });
      } else if (label.includes('email')) {
        actions.push({ type: 'fill', selector: field.id, label: field.label, value: request.userInfo.email });
      } else if (label.includes('phone') || label.includes('mobile')) {
        actions.push({ type: 'fill', selector: field.id, label: field.label, value: request.userInfo.phone || '' });
      } else if (label.includes('cover letter') || label.includes('additional')) {
        actions.push({ type: 'textarea', selector: field.id, label: field.label, value: '', isCoverLetter: true });
      }
    }

    return actions;
  }

  /**
   * Attempt to log in to a job board using stored credentials.
   */
  private async attemptLogin(
    page: Page,
    credentials: { email: string; password: string },
    sourceUrl: string,
  ): Promise<boolean> {
    const url = sourceUrl.toLowerCase();

    try {
      if (url.includes('indeed.com') || url.includes('indeed.ca')) {
        // Click "Sign in" link if visible
        try {
          const signInLink = page.getByRole('link', { name: /sign in/i }).first();
          if (await signInLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await signInLink.click({ timeout: 5000 });
            await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
            await this.sleep(2000);
          }
        } catch { /* already on login page */ }

        // Look for Google Sign-In button
        const googleBtn = page.locator('button:has-text("Google"), a:has-text("Google"), [data-provider="google"], button:has-text("Continue with Google")').first();
        if (await googleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          const [popup] = await Promise.all([
            page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null),
            googleBtn.click({ timeout: 5000 }),
          ]);

          const loginPage = popup || page;
          await this.sleep(2000);

          try {
            const emailInput = loginPage.locator('input[type="email"], input[name="identifier"]').first();
            await emailInput.waitFor({ state: 'visible', timeout: 5000 });
            await emailInput.fill(credentials.email);
            await this.sleep(500);
            await loginPage.getByRole('button', { name: /next/i }).first().click({ timeout: 5000 });
            await this.sleep(3000);

            const passwordInput = loginPage.locator('input[type="password"], input[name="Passwd"]').first();
            await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
            await passwordInput.fill(credentials.password);
            await this.sleep(500);
            await loginPage.getByRole('button', { name: /next/i }).first().click({ timeout: 5000 });
            await this.sleep(5000);

            if (popup) await popup.waitForEvent('close', { timeout: 15000 }).catch(() => {});
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
            await page.goto(sourceUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
            return true;
          } catch (err) {
            this.logger.error(`Google login failed: ${err}`);
            return false;
          }
        }

        return this.directEmailLogin(page, credentials, sourceUrl);
      }

      return this.directEmailLogin(page, credentials, sourceUrl);
    } catch (error) {
      this.logger.error(`Login attempt failed: ${error}`);
      return false;
    }
  }

  private async directEmailLogin(
    page: Page,
    credentials: { email: string; password: string },
    sourceUrl: string,
  ): Promise<boolean> {
    try {
      const emailInput = page.locator(
        'input[type="email"], input[name="email"], input[name="username"], input[id*="email"], input[autocomplete="email"]'
      ).first();
      if (!await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) return false;

      await emailInput.fill(credentials.email);
      await this.sleep(500);

      const passwordInput = page.locator('input[type="password"]').first();
      if (await passwordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await passwordInput.fill(credentials.password);
        await this.sleep(500);
      }

      const submitBtn = page.locator(
        'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Continue"), input[type="submit"]'
      ).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click({ timeout: 5000 });
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await this.sleep(3000);
      }

      await page.goto(sourceUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      return true;
    } catch (error) {
      this.logger.error(`Direct login failed: ${error}`);
      return false;
    }
  }

  private detectJobBoard(url: string): {
    name: string;
    applySelectors: string[];
    applyTexts: string[];
  } | null {
    const u = url.toLowerCase();

    if (u.includes('indeed.com') || u.includes('indeed.ca')) {
      return {
        name: 'Indeed',
        applySelectors: [
          '#indeedApplyButton',
          'button[id*="indeedApply"]',
          '.jobsearch-IndeedApplyButton-newDesign',
          'button[data-testid="indeedApplyButton"]',
          'button.css-1234:has-text("Apply now")',
          'a[href*="applystart"]',
          '.indeed-apply-button',
          'button[aria-label*="Apply"]',
        ],
        applyTexts: ['Apply now', 'Apply on company site', 'Apply', 'Easy Apply'],
      };
    }

    if (u.includes('linkedin.com')) {
      return {
        name: 'LinkedIn',
        applySelectors: [
          '.jobs-apply-button',
          'button.jobs-apply-button',
          'button[data-control-name="jobdetails_topcard_inapply"]',
          '.jobs-s-apply button',
          'button.jobs-apply-button--top-card',
        ],
        applyTexts: ['Easy Apply', 'Apply', 'Apply now'],
      };
    }

    if (u.includes('glassdoor.com') || u.includes('glassdoor.ca')) {
      return {
        name: 'Glassdoor',
        applySelectors: [
          'button[data-test="applyButton"]',
          '.applyButton',
          'button.gd-ui-button:has-text("Apply")',
          'a[data-test="applyButton"]',
        ],
        applyTexts: ['Apply Now', 'Apply', 'Easy Apply', 'Apply on Company Site'],
      };
    }

    if (u.includes('ziprecruiter.com')) {
      return {
        name: 'ZipRecruiter',
        applySelectors: [
          'button.apply_button',
          '#apply_button',
          'a.apply_button',
          'button[data-testid="apply-button"]',
        ],
        applyTexts: ['Apply Now', 'Apply', '1-Click Apply'],
      };
    }

    if (u.includes('monster.com')) {
      return {
        name: 'Monster',
        applySelectors: [
          '#applyButton',
          'button[data-testid="applyButton"]',
          'a.apply-button',
        ],
        applyTexts: ['Apply Now', 'Apply'],
      };
    }

    if (u.includes('workday.com') || u.includes('myworkdayjobs.com')) {
      return {
        name: 'Workday',
        applySelectors: [
          'a[data-automation-id="jobPostingApplyButton"]',
          'button[data-automation-id="jobPostingApplyButton"]',
        ],
        applyTexts: ['Apply', 'Apply Now'],
      };
    }

    // Generic — no board-specific strategy
    return null;
  }

  /**
   * Try to find and solve a reCAPTCHA on the page using the audio challenge approach.
   * Based on danielgatis/puppeteer-recaptcha-solver, ported to Playwright.
   * Flow: click checkbox → if image challenge → switch to audio → transcribe → verify
   */
  private async trySolveCaptcha(page: Page): Promise<boolean> {
    try {
      // Log all iframes for debugging
      const iframeInfo = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).map(f => ({
          src: (f.src || '').substring(0, 150),
          title: f.title || '',
        }));
      });
      this.logger.log(`[CAPTCHA] Page has ${iframeInfo.length} iframes: ${JSON.stringify(iframeInfo)}`);

      // Step 1: Find the anchor iframe (checkbox) — supports both standard and Enterprise reCAPTCHA
      const anchorFrame = page.frames().find(f =>
        f.url().includes('api2/anchor') || f.url().includes('enterprise/anchor')
      );

      if (!anchorFrame) {
        this.logger.log('[CAPTCHA] No reCAPTCHA anchor iframe found');
        return false;
      }

      this.logger.log(`[CAPTCHA] Found anchor frame: ${anchorFrame.url().substring(0, 100)}`);

      // Step 2: Click the checkbox
      const checkbox = anchorFrame.locator('#recaptcha-anchor');
      if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Add random delay to seem human
        await this.sleep(Math.floor(Math.random() * 200) + 100);
        await checkbox.click({ delay: Math.floor(Math.random() * 120) + 30 });
        this.logger.log('[CAPTCHA] Clicked reCAPTCHA checkbox');
        await this.sleep(3000);
      } else {
        this.logger.log('[CAPTCHA] Checkbox not visible in anchor frame');
        return false;
      }

      // Step 3: Check if checkbox is already checked (solved without challenge)
      const isChecked = await anchorFrame.locator('#recaptcha-anchor[aria-checked="true"]')
        .isVisible({ timeout: 2000 }).catch(() => false);
      if (isChecked) {
        this.logger.log('[CAPTCHA] Checkbox passed without challenge!');
        return true;
      }

      // Step 4: Image challenge appeared — find the bframe and switch to audio
      this.logger.log('[CAPTCHA] Image challenge detected, switching to audio...');
      const bframe = page.frames().find(f =>
        f.url().includes('api2/bframe') || f.url().includes('enterprise/bframe')
      );

      if (!bframe) {
        this.logger.log('[CAPTCHA] No bframe found for challenge');
        return false;
      }

      // Click the audio button
      const audioButton = bframe.locator('#recaptcha-audio-button');
      if (await audioButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await audioButton.click({ delay: Math.floor(Math.random() * 120) + 30 });
        this.logger.log('[CAPTCHA] Clicked audio challenge button');
        await this.sleep(3000);
      } else {
        this.logger.log('[CAPTCHA] Audio button not found in bframe');
        return false;
      }

      // Step 5: Solve the audio challenge (up to 3 attempts)
      for (let attempt = 0; attempt < 3; attempt++) {
        this.logger.log(`[CAPTCHA] Audio solve attempt ${attempt + 1}/3`);

        // Wait for audio download link
        const downloadLink = bframe.locator('.rc-audiochallenge-tdownload-link');
        if (!await downloadLink.isVisible({ timeout: 5000 }).catch(() => false)) {
          this.logger.warn('[CAPTCHA] Audio download link not visible');
          // Check if we got "Try again later" error
          const errorMsg = await bframe.locator('.rc-audiochallenge-error-message')
            .textContent({ timeout: 1000 }).catch(() => '');
          if (errorMsg) {
            this.logger.warn(`[CAPTCHA] Audio challenge error: ${errorMsg}`);
            return false; // Can't continue — blocked
          }
          continue;
        }

        // Get the audio source URL
        const audioSrc = await bframe.locator('#audio-source')
          .getAttribute('src', { timeout: 3000 }).catch(() => null);
        if (!audioSrc) {
          this.logger.warn('[CAPTCHA] Could not get audio source URL');
          continue;
        }
        this.logger.log(`[CAPTCHA] Audio source: ${audioSrc.substring(0, 80)}...`);

        // Download the audio and send to wit.ai for transcription
        try {
          const audioResponse = await fetch(audioSrc);
          const audioBuffer = await audioResponse.arrayBuffer();

          const witResponse = await fetch('https://api.wit.ai/speech?v=20220622', {
            method: 'POST',
            body: new Uint8Array(audioBuffer),
            headers: {
              'Authorization': 'Bearer JVHWCNWJLWLGN6MFALYLHAPKUFHMNTAC',
              'Content-Type': 'audio/mpeg3',
            },
          });
          const witText = await witResponse.text();
          this.logger.log(`[CAPTCHA] wit.ai response: ${witText.substring(0, 200)}`);

          // Extract the transcript
          const match = witText.match(/"text":\s*"(.+?)"/);
          if (!match || !match[1]) {
            this.logger.warn('[CAPTCHA] Could not parse transcript, reloading...');
            const reloadBtn = bframe.locator('#recaptcha-reload-button');
            if (await reloadBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
              await reloadBtn.click({ delay: Math.floor(Math.random() * 120) + 30 });
              await this.sleep(3000);
            }
            continue;
          }

          const transcript = match[1].trim();
          this.logger.log(`[CAPTCHA] Transcript: "${transcript}"`);

          // Type the answer
          const audioInput = bframe.locator('#audio-response');
          await audioInput.click({ delay: Math.floor(Math.random() * 120) + 30 });
          await audioInput.fill(''); // Clear first
          // Type with random delays to seem human
          for (const char of transcript) {
            await audioInput.type(char, { delay: Math.floor(Math.random() * 45) + 30 });
          }

          // Click verify
          const verifyBtn = bframe.locator('#recaptcha-verify-button');
          await verifyBtn.click({ delay: Math.floor(Math.random() * 120) + 30 });
          await this.sleep(3000);

          // Check if solved
          const solved = await anchorFrame.locator('#recaptcha-anchor[aria-checked="true"]')
            .isVisible({ timeout: 5000 }).catch(() => false);
          if (solved) {
            this.logger.log('[CAPTCHA] ✅ reCAPTCHA solved successfully via audio!');
            return true;
          }

          this.logger.warn('[CAPTCHA] Verify did not solve, retrying...');
        } catch (err) {
          this.logger.warn(`[CAPTCHA] Audio solve error: ${err}`);
        }
      }

      this.logger.warn('[CAPTCHA] Failed to solve after 3 attempts');
      return false;
    } catch (error) {
      this.logger.warn(`[CAPTCHA] Solve attempt failed: ${error}`);
      return false;
    }
  }

  /**
   * Click a button using text-based Playwright locators first, falling back to CSS.
   * This avoids issues with shared dynamic CSS classes (e.g. Indeed's e8ju0x50).
   */
  private async clickByText(page: Page, buttonText: string, fallbackSelector: string): Promise<void> {
    const cleanText = buttonText.trim();

    // Strategy 1: getByRole with exact name
    try {
      const byRole = page.getByRole('button', { name: cleanText, exact: false });
      if (await byRole.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await byRole.first().click({ timeout: 5000 });
        return;
      }
    } catch { /* try next */ }

    // Strategy 2: getByRole link
    try {
      const byLink = page.getByRole('link', { name: cleanText, exact: false });
      if (await byLink.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await byLink.first().click({ timeout: 5000 });
        return;
      }
    } catch { /* try next */ }

    // Strategy 3: text locator
    try {
      const byText = page.locator(`text="${cleanText}"`);
      if (await byText.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await byText.first().click({ timeout: 5000 });
        return;
      }
    } catch { /* try next */ }

    // Strategy 4: contains text with button/link filter
    try {
      const words = cleanText.split(/\s+/).slice(0, 3).join(' ');
      const byContains = page.locator(`button:has-text("${words}"), a:has-text("${words}"), [role="button"]:has-text("${words}")`).first();
      if (await byContains.isVisible({ timeout: 1000 }).catch(() => false)) {
        await byContains.click({ timeout: 5000 });
        return;
      }
    } catch { /* try next */ }

    // Strategy 5: fallback to CSS selector with force click
    try {
      await page.click(fallbackSelector, { timeout: 5000, force: true });
    } catch {
      // Final fallback: JS click
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        if (el) el.click();
      }, fallbackSelector);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
