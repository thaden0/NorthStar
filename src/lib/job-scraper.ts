/**
 * Job Scraper Service
 * 
 * Scrapes job listings from Indeed and LinkedIn based on JobSearch criteria.
 * Uses public search URLs with HTTP fetching and HTML parsing.
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
 * Scrape Indeed job listings using their public search page
 * Indeed has blocked RSS feeds, so we scrape their search results page
 */
async function scrapeIndeed(keywords: string[], location: string | null, jobType: string): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  
  try {
    const query = encodeURIComponent(keywords.join(' '));
    const loc = location ? encodeURIComponent(location) : '';
    
    // Map job type to Indeed's filter values
    const jtMap: Record<string, string> = {
      'fulltime': 'jt=fulltime',
      'parttime': 'jt=parttime', 
      'contract': 'jt=contract',
      'internship': 'jt=internship',
    };
    const jtParam = jtMap[jobType] || '';
    
    // Indeed search page
    const searchUrl = `https://www.indeed.com/jobs?q=${query}&l=${loc}&sort=date&limit=25${jtParam ? '&' + jtParam : ''}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(20000),
    });
    
    if (!response.ok) {
      console.warn(`Indeed search returned ${response.status}`);
      return jobs;
    }
    
    const html = await response.text();
    
    // Try to find the JSON data in the page's script tags
    // Indeed embeds job data as JSON in window._initialData or mosaic-provider-jobcards
    const jsonMatch = html.match(/window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{[\s\S]*?\});/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const results = data?.metaData?.mosaicProviderJobCardsModel?.results || [];
        for (const result of results.slice(0, 25)) {
          const salary = parseSalary(result.extractedSalary?.max ? 
            `$${result.extractedSalary.min} - $${result.extractedSalary.max} ${result.extractedSalary.type}` : null);
          
          let remote: string | null = null;
          if (result.remoteLocation) remote = 'remote';
          
          jobs.push({
            title: result.title || '',
            company: result.company || 'Unknown',
            location: result.formattedLocation || location,
            description: result.snippet ? stripHtml(result.snippet) : null,
            salaryMin: salary.min,
            salaryMax: salary.max,
            salaryPeriod: salary.period,
            jobType: jobType || null,
            remote,
            postedAt: result.pubDate ? new Date(result.pubDate * 1000) : null,
            source: 'indeed',
            sourceUrl: `https://www.indeed.com/viewjob?jk=${result.jobkey}`,
            sourceId: result.jobkey || null,
          });
        }
      } catch (e) {
        console.warn('Failed to parse Indeed JSON data:', e);
      }
    }
    
    // Fallback: parse HTML job cards if JSON extraction failed
    if (jobs.length === 0) {
      // Match job cards by looking for data-jk attributes (Indeed job keys)
      const jobKeyRegex = /data-jk="([a-f0-9]+)"/gi;
      const titleRegex = /<h2[^>]*class="[^"]*jobTitle[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi;
      const companyRegex = /<span[^>]*data-testid="company-name"[^>]*>([\s\S]*?)<\/span>/gi;
      const locationRegex = /<div[^>]*data-testid="text-location"[^>]*>([\s\S]*?)<\/div>/gi;
      
      const jobKeys: string[] = [];
      let km;
      while ((km = jobKeyRegex.exec(html)) !== null) {
        if (!jobKeys.includes(km[1])) jobKeys.push(km[1]);
      }
      
      const titles: string[] = [];
      let tm;
      while ((tm = titleRegex.exec(html)) !== null) {
        titles.push(stripHtml(tm[1]));
      }
      
      const companies: string[] = [];
      let cm;
      while ((cm = companyRegex.exec(html)) !== null) {
        companies.push(stripHtml(cm[1]));
      }
      
      const locations: string[] = [];
      let lm;
      while ((lm = locationRegex.exec(html)) !== null) {
        locations.push(stripHtml(lm[1]));
      }
      
      const count = Math.min(jobKeys.length, titles.length);
      for (let i = 0; i < count; i++) {
        let remote: string | null = null;
        const titleAndLoc = `${titles[i]} ${locations[i] || ''}`;
        if (/\bremote\b/i.test(titleAndLoc)) remote = 'remote';
        else if (/\bhybrid\b/i.test(titleAndLoc)) remote = 'hybrid';
        
        jobs.push({
          title: titles[i],
          company: companies[i] || 'Unknown',
          location: locations[i] || location,
          description: null,
          salaryMin: null,
          salaryMax: null,
          salaryPeriod: null,
          jobType: jobType || null,
          remote,
          postedAt: null,
          source: 'indeed',
          sourceUrl: `https://www.indeed.com/viewjob?jk=${jobKeys[i]}`,
          sourceId: jobKeys[i],
        });
      }
    }
    
    console.log(`Indeed: found ${jobs.length} jobs for "${keywords.join(' ')}" in "${location || 'any'}"`);
  } catch (error) {
    console.error('Indeed scraping error:', error);
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
      'fulltime': 'F',
      'parttime': 'P',
      'contract': 'C',
      'internship': 'I',
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
    const items = html.split(/<li>/i).slice(1); // skip first empty split
    
    for (const item of items.slice(0, 25)) {
      // Extract title from h3.base-search-card__title
      const titleMatch = item.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/);
      
      // Extract company from h4.base-search-card__subtitle (contains nested <a>)
      const companyMatch = item.match(/<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/);
      
      // Extract location from span.job-search-card__location
      const locationMatch = item.match(/<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      
      // Extract link - can be linkedin.com or subdomain like in.linkedin.com
      const linkMatch = item.match(/<a[^>]*href="(https?:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"]*)"[^>]*/);
      
      // Extract date
      const dateMatch = item.match(/<time[^>]*datetime="([^"]*)"[^>]*/);
      
      const title = titleMatch ? stripHtml(titleMatch[1]) : '';
      const company = companyMatch ? stripHtml(companyMatch[1]) : 'Unknown';
      const jobLocation = locationMatch ? stripHtml(locationMatch[1]) : location;
      // Clean URL: take the base URL without query params and normalize to www.linkedin.com
      let link = linkMatch ? linkMatch[1].split('?')[0] : '';
      link = link.replace(/https?:\/\/[a-z]+\.linkedin\.com/, 'https://www.linkedin.com');
      const postedAt = dateMatch ? new Date(dateMatch[1]) : null;
      
      // Detect remote
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
