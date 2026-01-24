import { Injectable, Logger } from '@nestjs/common';
import * as googleNews from 'google-news-json';

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  image?: string;
}

export interface NewsSearchResult {
  query: string;
  articles: NewsArticle[];
  error?: string;
}

export interface TopHeadlinesResult {
  category: string;
  articles: NewsArticle[];
  error?: string;
}

@Injectable()
export class GoogleNewsService {
  private readonly logger = new Logger(GoogleNewsService.name);

  async searchNews(
    query: string,
    options?: { language?: string; country?: string },
  ): Promise<NewsSearchResult> {
    try {
      this.logger.log(`Searching news for: ${query}`);

      const results = await googleNews.getNews(googleNews.SEARCH, query, options?.language || 'en-US');

      const articles: NewsArticle[] = (results?.items || []).map(
        (item) => ({
          title: item.title || '',
          description: item.snippet || '',
          url: item.link || '',
          source: item.source?.title || 'Unknown',
          publishedAt: item.published || '',
          image: item.thumbnail,
        }),
      );

      this.logger.log(`Found ${articles.length} articles for query: ${query}`);

      return { query, articles };
    } catch (error) {
      this.logger.error(`Error searching news for "${query}": ${error}`);
      return {
        query,
        articles: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getTopHeadlines(
    category?: string,
    options?: { language?: string; country?: string },
  ): Promise<TopHeadlinesResult> {
    try {
      const categoryToUse = category || 'general';
      this.logger.log(`Getting top headlines for category: ${categoryToUse}`);

      // Map category to Google News topic constants
      const topicMap: Record<string, string> = {
        general: googleNews.TOP_NEWS,
        world: googleNews.WORLD,
        nation: googleNews.NATION,
        business: googleNews.BUSINESS,
        technology: googleNews.TECHNOLOGY,
        entertainment: googleNews.ENTERTAINMENT,
        science: googleNews.SCIENCE,
        sports: googleNews.SPORTS,
        health: googleNews.HEALTH,
      };

      const topic = topicMap[categoryToUse.toLowerCase()] || googleNews.TOP_NEWS;
      const results = await googleNews.getNews(topic, null, options?.language || 'en-US');

      const articles: NewsArticle[] = (results?.items || []).map(
        (item) => ({
          title: item.title || '',
          description: item.snippet || '',
          url: item.link || '',
          source: item.source?.title || 'Unknown',
          publishedAt: item.published || '',
          image: item.thumbnail,
        }),
      );

      this.logger.log(
        `Found ${articles.length} top headlines for category: ${categoryToUse}`,
      );

      return { category: categoryToUse, articles };
    } catch (error) {
      this.logger.error(`Error getting top headlines: ${error}`);
      return {
        category: category || 'general',
        articles: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getNewsByTopic(
    topic: string,
    options?: { language?: string; country?: string },
  ): Promise<NewsSearchResult> {
    try {
      this.logger.log(`Getting news for topic: ${topic}`);

      // Use search with the topic
      return this.searchNews(topic, options);
    } catch (error) {
      this.logger.error(`Error getting news for topic "${topic}": ${error}`);
      return {
        query: topic,
        articles: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
