import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from '../llm/ollama.service';
import { PlaywrightService } from '../tools/playwright.service';
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
      // Step 1: Open browser and navigate
      addStep({
        action: 'navigating',
        description: `Opening ${request.job.company} job listing...`,
        success: true,
      });

      context = await this.playwrightService.getContext();
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
          const screenshot = (await page.screenshot()).toString('base64');
          lastScreenshot = screenshot;
          addStep({
            action: 'needs_review',
            description: 'Login/account required — cannot proceed automatically',
            screenshot,
            success: false,
            details: 'This application requires you to log in or create an account. Please apply manually.',
          });
          needsReview = true;
          break;
        }

        // If there are apply buttons and no form fields, click the apply button
        if (analysis.applyButtons.length > 0 && analysis.formFields.length === 0) {
          const btn = analysis.applyButtons[0];
          addStep({
            action: 'clicking',
            description: `Clicking "${btn.text}" button...`,
            success: true,
          });
          try {
            await page.click(btn.selector, { timeout: 5000 });
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

        // If there are form fields, use LLM to decide what to fill
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
              await page.click(submitBtn.selector, { timeout: 5000 });
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

        // No forms and no apply buttons — check for links
        if (analysis.applyButtons.length === 0 && analysis.formFields.length === 0) {
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
          // Exclude search bars and nav inputs
          const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
          if (cls.includes('search') || cls.includes('nav-') || cls.includes('gnav')) return false;
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
