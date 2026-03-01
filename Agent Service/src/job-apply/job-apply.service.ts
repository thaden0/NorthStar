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
  submitButtons: Array<{ text: string; selector: string }>;
  textContent: string;
  isConfirmationPage: boolean;
  isLoginRequired: boolean;
}

@Injectable()
export class JobApplyService {
  private readonly logger = new Logger(JobApplyService.name);
  private readonly defaultModel = 'qwen3:latest';
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
            addStep({
              action: 'needs_review',
              description: `${boardStrategy.name} requires login to apply`,
              screenshot,
              success: false,
              details: 'This job requires you to log in or create an account on the job board. Please apply manually.',
            });
            return { status: 'needs_review', steps, lastScreenshot };
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

        // If there are form fields (and NO apply button), use LLM to decide what to fill
        if (analysis.formFields.length > 0) {
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

        // No forms and no apply buttons — but maybe there's a continue/next button (multi-step wizard)
        if (analysis.applyButtons.length === 0 && analysis.formFields.length === 0) {
          // Check for submit/continue/next buttons first (Indeed wizard steps like "Add Resume")
          if (analysis.submitButtons.length > 0) {
            const submitBtn = analysis.submitButtons[0];
            addStep({
              action: 'clicking',
              description: `Clicking "${submitBtn.text}" to continue...`,
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
        // 1. ID is best
        if (el.id) return `#${el.id}`;
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

      const submitButtons = allButtons
        .filter(el => {
          if (!isInteractiveButton(el)) return false;
          const text = (el.textContent?.trim() || '').toLowerCase();
          const type = (el as HTMLInputElement).type?.toLowerCase();
          const isSubmit = submitKeywords.some(k => text.includes(k)) || type === 'submit';
          const isApply = applyKeywords.some(k => text.includes(k));
          return isSubmit && !isApply;
        })
        .slice(0, 3)
        .map(el => ({
          text: (el.textContent?.trim() || '').substring(0, 80),
          selector: getSelector(el),
        }));

      // Find form fields
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      const formFields = inputs
        .filter(el => {
          const type = (el as HTMLInputElement).type?.toLowerCase();
          if (['hidden', 'submit', 'button', 'reset', 'search'].includes(type)) return false;
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

      return { applyButtons, submitButtons, formFields, isLoginRequired, isConfirmationPage, textContent };
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
    type: 'fill' | 'select' | 'upload' | 'textarea';
    selector: string;
    label: string;
    value: string;
    isCoverLetter?: boolean;
  }>> {
    const model = request.model || this.defaultModel;

    const fieldDescriptions = analysis.formFields.map(f =>
      `- Field: "${f.label}" (type: ${f.type}, selector: ${f.id}, required: ${f.required}, current value: "${f.value}")`
    ).join('\n');

    const prompt = `You are filling out a job application form. Based on the user's information, decide what to enter in each form field.

USER INFO:
- Name: ${request.userInfo.name}
- Email: ${request.userInfo.email}
${request.userInfo.phone ? `- Phone: ${request.userInfo.phone}` : ''}
${request.resume?.skills?.length ? `- Skills: ${request.resume.skills.join(', ')}` : ''}
${request.resume?.experienceYears ? `- Experience: ${request.resume.experienceYears} years` : ''}
${request.resume?.summary ? `- Summary: ${request.resume.summary}` : ''}

JOB: ${request.job.title} at ${request.job.company}

FORM FIELDS:
${fieldDescriptions}

For each field, respond with a JSON array of actions. Each action should have:
- "selector": the field selector (use the one provided)
- "label": the field label
- "type": "fill" for text inputs, "select" for dropdowns, "upload" for file inputs, "textarea" for text areas
- "value": what to enter
- "isCoverLetter": true if this appears to be a cover letter field

Skip fields that already have values. For file upload fields, set type to "upload" and value to "resume".
For "cover letter" or "additional information" textareas, set isCoverLetter to true.
For fields about salary expectations, work authorization, start date — use reasonable defaults.
For yes/no questions about work authorization, answer "Yes" if reasonable.

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
