/**
 * Job Scraper Service
 * 
 * Scrapes job listings from Indeed and LinkedIn based on JobSearch criteria.
 * Uses public search URLs with HTTP fetching and HTML parsing.
 * 
 * Note: This is designed with rate limiting and respectful scraping practices.
 * In production, consider using official APIs or third-party job aggregation services
 * for more reliable results.
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
 * Scrape Indeed job listings using their public RSS feed
 */
async function scrapeIndeed(keywords: string[], location: string | null, jobType: string): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  
  try {
    const query = encodeURIComponent(keywords.join(' '));
    const loc = location ? encodeURIComponent(location) : '';
    
    // Indeed RSS feed
    const rssUrl = `https://www.indeed.com/rss?q=${query}&l=${loc}&sort=date&limit=25`;
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NorthStar/1.0; Job Aggregator)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) {
      console.warn(`Indeed RSS returned ${response.status}`);
      return jobs;
    }
    
    const xml = await response.text();
    
    // Parse RSS XML items
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1];
      
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
        || item.match(/<title>(.*?)<\/title>/)?.[1]
        || '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1]
        || item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]
        || '';
      const description = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
        || item.match(/<description>([\s\S]*?)<\/description>/)?.[1]
        || '';
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || '';
      
      // Extract company from source or description
      const company = sourceMatch || 'Unknown Company';
      const cleanDescription = stripHtml(description);
      
      // Try to detect location from description
      let jobLocation = location;
      const locationMatch = cleanDescription.match(/(?:in\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/);
      if (locationMatch) jobLocation = locationMatch[1];
      
      // Detect salary
      const salary = parseSalary(cleanDescription);
      
      // Detect remote
      let remote: string | null = null;
      if (/\bremote\b/i.test(cleanDescription) || /\bremote\b/i.test(title)) {
        remote = 'remote';
      } else if (/\bhybrid\b/i.test(cleanDescription)) {
        remote = 'hybrid';
      }
      
      if (title && link) {
        jobs.push({
          title: stripHtml(title),
          company,
          location: jobLocation,
          description: cleanDescription.slice(0, 5000),
          salaryMin: salary.min,
          salaryMax: salary.max,
          salaryPeriod: salary.period,
          jobType: jobType || null,
          remote,
          postedAt: pubDate ? new Date(pubDate) : null,
          source: 'indeed',
          sourceUrl: link,
          sourceId: link.match(/jk=([a-f0-9]+)/)?.[1] || null,
        });
      }
    }
  } catch (error) {
    console.error('Indeed scraping error:', error);
  }
  
  return jobs;
}

/**
 * Scrape LinkedIn job listings using their public job search page
 */
async function scrapeLinkedIn(keywords: string[], location: string | null, jobType: string): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  
  try {
    const query = encodeURIComponent(keywords.join(' '));
    const loc = location ? encodeURIComponent(location) : '';
    
    // LinkedIn public jobs search (guest accessible)
    const listingUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${query}&location=${loc}&start=0&sortBy=DD`;
    
    const response = await fetch(listingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) {
      console.warn(`LinkedIn returned ${response.status}`);
      return jobs;
    }
    
    const html = await response.text();
    
    // Parse the job cards from LinkedIn's guest API
    const cardRegex = /<div[^>]*class="[^"]*base-card[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
    const cards = html.match(cardRegex) || [];
    
    for (const card of cards.slice(0, 25)) {
      const titleMatch = card.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/);
      const companyMatch = card.match(/<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/);
      const locationMatch = card.match(/<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      const linkMatch = card.match(/<a[^>]*href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"]*)"[^>]*/);
      const dateMatch = card.match(/<time[^>]*datetime="([^"]*)"[^>]*/);
      
      const title = titleMatch ? stripHtml(titleMatch[1]) : '';
      const company = companyMatch ? stripHtml(companyMatch[1]) : 'Unknown';
      const jobLocation = locationMatch ? stripHtml(locationMatch[1]) : location;
      const link = linkMatch ? linkMatch[1].split('?')[0] : '';
      const postedAt = dateMatch ? new Date(dateMatch[1]) : null;
      
      // Detect remote
      let remote: string | null = null;
      if (jobLocation && /remote/i.test(jobLocation)) remote = 'remote';
      else if (jobLocation && /hybrid/i.test(jobLocation)) remote = 'hybrid';
      
      if (title && link) {
        jobs.push({
          title,
          company,
          location: jobLocation,
          description: null, // Would need an additional request per job
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
  
  // Scrape from each configured source
  for (const source of search.sources) {
    try {
      let scrapeResults: ScrapedJob[] = [];
      
      if (source === 'indeed') {
        scrapeResults = await scrapeIndeed(search.keywords, search.location, search.jobType);
      } else if (source === 'linkedin') {
        scrapeResults = await scrapeLinkedIn(search.keywords, search.location, search.jobType);
      }
      
      allScrapedJobs = allScrapedJobs.concat(scrapeResults);
    } catch (error) {
      const msg = `Error scraping ${source}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      console.error(msg);
    }
    
    // Rate limit between sources
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
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
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
      // Likely a unique constraint violation (duplicate), skip
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
