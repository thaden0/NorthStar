/**
 * Job Scraper Service
 * 
 * Scrapes job listings from Indeed (using Playwright headless browser)
 * and LinkedIn (using their public guest API).
 */

import { db } from '@/lib/db';

interface ScrapedJob {
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string | null;
  jobType: string | null;
  remote: string | null;
  postedAt: Date | null;
  source: string;
  sourceUrl: string;
  sourceId: string | null;
}

/**
 * Parse salary strings like "$50,000 - $80,000 a year" or "$25 - $35 an hour"
 */
function parseSalary(salaryText: string | null): { min: number | null; max: number | null; period: string | null } {
  if (!salaryText) return { min: null, max: null, period: null };
  
  const cleaned = salaryText.replace(/,/g, '').toLowerCase();
  const numbers = cleaned.match(/\$?([\d.]+)/g)?.map(n => parseFloat(n.replace('$', ''))) || [];
  
  let period: string | null = null;
  if (cleaned.includes('year') || cleaned.includes('annual')) period = 'yearly';
  else if (cleaned.includes('month')) period = 'monthly';
  else if (cleaned.includes('hour')) period = 'hourly';
  else if (numbers[0] && numbers[0] > 1000) period = 'yearly';
  else period = 'hourly';
  
  return {
    min: numbers[0] || null,
    max: numbers[1] || numbers[0] || null,
    period,
  };
}

/**
 * Extract text content from HTML by removing tags
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse relative date strings like "3 days ago" or "Just posted"
 */
function parseRelativeDate(text: string): Date | null {
  const lower = text.toLowerCase().trim();
  const now = new Date();

  if (lower.includes('just posted') || lower.includes('today') || lower.includes('just now')) {
    return now;
  }

  const match = lower.match(/(\d+)\s*(day|hour|week|month)s?\s*ago/);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 'hour': return new Date(now.getTime() - value * 60 * 60 * 1000);
      case 'day': return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      case 'week': return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
    }
  }

  return null;
}

/**
 * Scrape Indeed job listings using Playwright headless browser.
 * Indeed blocks simple HTTP requests, so we need a real browser.
 */
async function scrapeIndeed(keywords: string[], location: string | null, jobType: string): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  
  let chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    console.warn('[Indeed] Playwright not available, skipping Indeed scraping');
    return jobs;
  }
  
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });
    
    const page = await context.newPage();
    
    // Stealth: hide webdriver flag
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      (window as unknown as { chrome: object }).chrome = { runtime: {} };
    });
    
    // Build search URL
    const queryParts: string[] = [];
    queryParts.push(`q=${encodeURIComponent(keywords.join(' '))}`);
    if (location) queryParts.push(`l=${encodeURIComponent(location)}`);
    
    const jtMap: Record<string, string> = {
      'fulltime': 'fulltime', 'parttime': 'parttime',
      'contract': 'contract', 'internship': 'internship',
    };
    if (jtMap[jobType]) queryParts.push(`jt=${jtMap[jobType]}`);
    
    const searchUrl = `https://ca.indeed.com/jobs?${queryParts.join('&')}`;
    console.log(`[Indeed] Navigating to: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    
    // Random delay to appear human
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
    
    // Wait for job cards
    try {
      await page.waitForSelector('[class*="job_seen_beacon"], [class*="jobsearch-ResultsList"] > li', {
        timeout: 10000,
      });
    } catch {
      console.log('[Indeed] No job cards found on page');
      await page.close();
      await context.close();
      return jobs;
    }
    
    // Extract job cards using Playwright selectors
    const jobCards = await page.$$('[class*="job_seen_beacon"], [data-jk]');
    console.log(`[Indeed] Found ${jobCards.length} job cards`);
    
    for (const card of jobCards.slice(0, 25)) {
      try {
        // Job key
        let jobKey = await card.getAttribute('data-jk');
        if (!jobKey) {
          const jkEl = await card.$('[data-jk]');
          if (jkEl) jobKey = await jkEl.getAttribute('data-jk');
        }
        if (!jobKey) continue;
        
        // Title
        const titleEl = await card.$('[class*="jobTitle"] a, h2 a, .jobTitle, a[data-jk]');
        const title = titleEl ? (await titleEl.innerText()).trim() : '';
        if (!title) continue;
        
        // Company
        const companyEl = await card.$('[data-testid="company-name"], [class*="companyName"]');
        const company = companyEl ? (await companyEl.innerText()).trim() : 'Unknown';
        
        // Location
        const locationEl = await card.$('[data-testid="text-location"], [class*="companyLocation"]');
        const jobLocation = locationEl ? (await locationEl.innerText()).trim() : location;
        
        // Salary
        const salaryEl = await card.$('[class*="salary-snippet"], [class*="salaryText"], [data-testid="attribute_snippet_testid"]');
        const salaryText = salaryEl ? (await salaryEl.innerText()).trim() : '';
        const salary = parseSalary(salaryText || null);
        
        // Posted date
        const dateEl = await card.$('[class*="date"], [data-testid="myJobsStateDate"]');
        const dateText = dateEl ? (await dateEl.innerText()).trim() : '';
        const postedAt = parseRelativeDate(dateText);
        
        // Snippet
        const snippetEl = await card.$('[class*="job-snippet"], [class*="underShelfFooter"]');
        const snippet = snippetEl ? (await snippetEl.innerText()).trim() : null;
        
        // Detect remote
        const fullText = `${title} ${jobLocation || ''} ${snippet || ''}`;
        let remote: string | null = null;
        if (/\bremote\b/i.test(fullText)) remote = 'remote';
        else if (/\bhybrid\b/i.test(fullText)) remote = 'hybrid';
        
        jobs.push({
          title,
          company,
          location: jobLocation,
          description: snippet,
          salaryMin: salary.min ? Math.round(salary.min) : null,
          salaryMax: salary.max ? Math.round(salary.max) : null,
          salaryPeriod: salary.period,
          jobType: jobType || null,
          remote,
          postedAt,
          source: 'indeed',
          sourceUrl: `https://ca.indeed.com/viewjob?jk=${jobKey}`,
          sourceId: jobKey,
        });
      } catch (error) {
        console.error('[Indeed] Error extracting job card:', error);
      }
    }
    
    await page.close();
    await context.close();
    console.log(`[Indeed] Found ${jobs.length} jobs for "${keywords.join(' ')}" in "${location || 'any'}"`);
  } catch (error) {
    console.error('[Indeed] Scraping error:', error);
  } finally {
    if (browser) await browser.close();
  }
  
  return jobs;
}

/**
 * Scrape LinkedIn job listings using their public guest API
 */
async function scrapeLinkedIn(keywords: string[], location: string | null, jobType: string): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  
  try {
    const query = encodeURIComponent(keywords.join(' '));
    const loc = location ? encodeURIComponent(location) : '';
    
    // Map job types to LinkedIn's f_JT filter values
    const jtMap: Record<string, string> = {
      'fulltime': 'F', 'parttime': 'P',
      'contract': 'C', 'internship': 'I',
    };
    const jtParam = jtMap[jobType] ? `&f_JT=${jtMap[jobType]}` : '';
    
    // LinkedIn guest API for job search
    const listingUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${query}&location=${loc}&start=0&sortBy=DD${jtParam}`;
    
    const response = await fetch(listingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(20000),
    });
    
    if (!response.ok) {
      console.warn(`LinkedIn returned ${response.status}`);
      return jobs;
    }
    
    const html = await response.text();
    console.log(`LinkedIn response: ${html.length} chars for "${keywords.join(' ')}" in "${location || 'any'}"`);
    
    // Split by <li> items - each job is in a <li> element
    const items = html.split(/<li>/i).slice(1);
    
    for (const item of items.slice(0, 25)) {
      const titleMatch = item.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/);
      const companyMatch = item.match(/<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/);
      const locationMatch = item.match(/<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      const linkMatch = item.match(/<a[^>]*href="(https?:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"]*)"[^>]*/);
      const dateMatch = item.match(/<time[^>]*datetime="([^"]*)"[^>]*/);
      
      const title = titleMatch ? stripHtml(titleMatch[1]) : '';
      const company = companyMatch ? stripHtml(companyMatch[1]) : 'Unknown';
      const jobLocation = locationMatch ? stripHtml(locationMatch[1]) : location;
      let link = linkMatch ? linkMatch[1].split('?')[0] : '';
      link = link.replace(/https?:\/\/[a-z]+\.linkedin\.com/, 'https://www.linkedin.com');
      const postedAt = dateMatch ? new Date(dateMatch[1]) : null;
      
      let remote: string | null = null;
      const locText = (jobLocation || '') + ' ' + title;
      if (/\bremote\b/i.test(locText)) remote = 'remote';
      else if (/\bhybrid\b/i.test(locText)) remote = 'hybrid';
      
      if (title && link) {
        jobs.push({
          title,
          company,
          location: jobLocation,
          description: null,
          salaryMin: null,
          salaryMax: null,
          salaryPeriod: null,
          jobType: jobType || null,
          remote,
          postedAt,
          source: 'linkedin',
          sourceUrl: link,
          sourceId: link.match(/\/view\/([^/]+)/)?.[1] || null,
        });
      }
    }
    
    console.log(`LinkedIn: found ${jobs.length} jobs for "${keywords.join(' ')}" in "${location || 'any'}"`);
  } catch (error) {
    console.error('LinkedIn scraping error:', error);
  }
  
  return jobs;
}

/**
 * Run scraping for a single JobSearch and save results
 */
export async function scrapeForSearch(searchId: string): Promise<{ added: number; skipped: number; errors: string[] }> {
  const search = await db.jobSearch.findUnique({ where: { id: searchId } });
  if (!search) {
    return { added: 0, skipped: 0, errors: ['Job search not found'] };
  }
  
  const errors: string[] = [];
  let allScrapedJobs: ScrapedJob[] = [];
  
  // Build combinations of locations and job types
  const locations = search.locations.length > 0 ? search.locations : [null];
  const jobTypes = search.jobTypes.length > 0 ? search.jobTypes : ['fulltime'];
  
  // Scrape from each configured source × location × jobType
  for (const source of search.sources) {
    for (const location of locations) {
      for (const jobType of jobTypes) {
        try {
          let scrapeResults: ScrapedJob[] = [];
          
          if (source === 'indeed') {
            scrapeResults = await scrapeIndeed(search.keywords, location, jobType);
          } else if (source === 'linkedin') {
            scrapeResults = await scrapeLinkedIn(search.keywords, location, jobType);
          }
          
          allScrapedJobs = allScrapedJobs.concat(scrapeResults);
        } catch (error) {
          const msg = `Error scraping ${source} (${location || 'any'}, ${jobType}): ${error instanceof Error ? error.message : String(error)}`;
          errors.push(msg);
          console.error(msg);
        }
        
        // Rate limit between requests
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    // Extra delay between sources
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Filter by exclude keywords
  if (search.excludeKeywords.length > 0) {
    const excludeRegex = new RegExp(search.excludeKeywords.join('|'), 'i');
    allScrapedJobs = allScrapedJobs.filter(job => {
      const text = `${job.title} ${job.company} ${job.description || ''}`;
      return !excludeRegex.test(text);
    });
  }
  
  // Deduplicate by sourceUrl before saving
  const seen = new Set<string>();
  allScrapedJobs = allScrapedJobs.filter(job => {
    if (seen.has(job.sourceUrl)) return false;
    seen.add(job.sourceUrl);
    return true;
  });
  
  // Save to database, skipping duplicates
  let added = 0;
  let skipped = 0;
  
  for (const job of allScrapedJobs) {
    try {
      await db.job.create({
        data: {
          jobSearchId: search.id,
          userId: search.userId,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          salaryMin: job.salaryMin ? Math.round(job.salaryMin) : null,
          salaryMax: job.salaryMax ? Math.round(job.salaryMax) : null,
          salaryPeriod: job.salaryPeriod,
          jobType: job.jobType,
          remote: job.remote,
          postedAt: job.postedAt,
          source: job.source,
          sourceUrl: job.sourceUrl,
          sourceId: job.sourceId,
        },
      });
      added++;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        skipped++;
      } else {
        console.error('Failed to save job:', error);
        skipped++;
      }
    }
  }
  
  // Update lastScrapedAt
  await db.jobSearch.update({
    where: { id: searchId },
    data: { lastScrapedAt: new Date() },
  });
  
  console.log(`Scrape complete for "${search.name}": ${added} added, ${skipped} skipped, ${errors.length} errors`);
  return { added, skipped, errors };
}

/**
 * Run scraping for all active searches for a user
 */
export async function scrapeAllForUser(userId: string): Promise<{
  totalAdded: number;
  totalSkipped: number;
  searchResults: { searchId: string; name: string; added: number; skipped: number; errors: string[] }[];
}> {
  const searches = await db.jobSearch.findMany({
    where: { userId, isActive: true },
  });
  
  let totalAdded = 0;
  let totalSkipped = 0;
  const searchResults: { searchId: string; name: string; added: number; skipped: number; errors: string[] }[] = [];
  
  for (const search of searches) {
    const result = await scrapeForSearch(search.id);
    totalAdded += result.added;
    totalSkipped += result.skipped;
    searchResults.push({
      searchId: search.id,
      name: search.name,
      ...result,
    });
    
    // Rate limit between searches
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  return { totalAdded, totalSkipped, searchResults };
}
