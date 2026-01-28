import { Injectable, Logger } from '@nestjs/common';

/**
 * Wikipedia article result
 */
export interface WikipediaArticle {
  title: string;
  pageid: number;
  content: string;
  summary: string;
  url: string;
  links: WikipediaLink[];
  references: WikipediaReference[];
  categories: string[];
  images: string[];
}

export interface WikipediaLink {
  title: string;
  url: string;
}

export interface WikipediaReference {
  url: string;
  title?: string;
  type: 'citation' | 'external';
}

export interface WikipediaSearchResult {
  query: string;
  results: Array<{
    title: string;
    pageid: number;
    snippet: string;
    url: string;
  }>;
  error?: string;
}

/**
 * Service for interacting with Wikipedia's API
 * Uses the MediaWiki API for searching and fetching articles
 */
@Injectable()
export class WikipediaService {
  private readonly logger = new Logger(WikipediaService.name);
  private readonly baseUrl = 'https://en.wikipedia.org/w/api.php';
  
  /**
   * Search Wikipedia for articles matching a query
   */
  async search(query: string, limit: number = 10): Promise<WikipediaSearchResult> {
    try {
      const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: limit.toString(),
        srprop: 'snippet|titlesnippet',
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`${this.baseUrl}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        return { query, results: [], error: data.error.info };
      }

      const results = (data.query?.search || []).map((item: { title: string; pageid: number; snippet: string }) => ({
        title: item.title,
        pageid: item.pageid,
        snippet: this.stripHtml(item.snippet),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
      }));

      return { query, results };
    } catch (error) {
      this.logger.error(`Wikipedia search error: ${error}`);
      return {
        query,
        results: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get a full Wikipedia article by title
   */
  async getArticle(title: string): Promise<WikipediaArticle | { error: string }> {
    try {
      // Get the article content and metadata
      const params = new URLSearchParams({
        action: 'query',
        titles: title,
        prop: 'extracts|links|extlinks|categories|images|info',
        exintro: '0', // Get full content, not just intro
        explaintext: '1', // Plain text
        pllimit: '100', // Up to 100 internal links
        ellimit: '100', // Up to 100 external links
        cllimit: '50', // Up to 50 categories
        imlimit: '20', // Up to 20 images
        inprop: 'url',
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`${this.baseUrl}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
      }

      const data = await response.json();
      const pages = data.query?.pages;
      
      if (!pages) {
        return { error: 'Article not found' };
      }

      const pageId = Object.keys(pages)[0];
      const page = pages[pageId];

      if (pageId === '-1' || !page.pageid) {
        return { error: `Article "${title}" not found` };
      }

      // Extract internal links
      const links: WikipediaLink[] = (page.links || []).map((link: { title: string }) => ({
        title: link.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(link.title.replace(/ /g, '_'))}`,
      }));

      // Extract external links as references
      const references: WikipediaReference[] = (page.extlinks || []).map((link: { '*': string }) => ({
        url: link['*'],
        type: 'external' as const,
      }));

      // Extract categories
      const categories = (page.categories || []).map((cat: { title: string }) => 
        cat.title.replace('Category:', '')
      );

      // Extract images
      const images = (page.images || [])
        .filter((img: { title: string }) => !img.title.includes('.svg'))
        .map((img: { title: string }) => img.title);

      // Get summary separately for better formatting
      const summaryParams = new URLSearchParams({
        action: 'query',
        titles: title,
        prop: 'extracts',
        exintro: '1',
        explaintext: '1',
        format: 'json',
        origin: '*',
      });

      const summaryResponse = await fetch(`${this.baseUrl}?${summaryParams}`);
      const summaryData = await summaryResponse.json();
      const summaryPage = summaryData.query?.pages?.[pageId];
      const summary = summaryPage?.extract || '';

      return {
        title: page.title,
        pageid: page.pageid,
        content: page.extract || '',
        summary: summary.substring(0, 1000),
        url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        links,
        references,
        categories,
        images,
      };
    } catch (error) {
      this.logger.error(`Wikipedia article fetch error: ${error}`);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get article by page ID
   */
  async getArticleById(pageid: number): Promise<WikipediaArticle | { error: string }> {
    try {
      // First get the title from pageid
      const params = new URLSearchParams({
        action: 'query',
        pageids: pageid.toString(),
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`${this.baseUrl}?${params}`);
      const data = await response.json();
      const page = data.query?.pages?.[pageid];

      if (!page || page.missing) {
        return { error: `Article with ID ${pageid} not found` };
      }

      return this.getArticle(page.title);
    } catch (error) {
      this.logger.error(`Wikipedia article by ID error: ${error}`);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get references/citations from an article
   * This fetches the parsed HTML to extract actual citation data
   */
  async getArticleReferences(title: string): Promise<WikipediaReference[] | { error: string }> {
    try {
      const params = new URLSearchParams({
        action: 'parse',
        page: title,
        prop: 'externallinks',
        format: 'json',
        origin: '*',
      });

      const response = await fetch(`${this.baseUrl}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        return { error: data.error.info };
      }

      const externalLinks = data.parse?.externallinks || [];
      
      return externalLinks.map((url: string) => ({
        url,
        type: 'citation' as const,
      }));
    } catch (error) {
      this.logger.error(`Wikipedia references error: ${error}`);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Strip HTML tags from a string
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#039;/g, "'");
  }
}
