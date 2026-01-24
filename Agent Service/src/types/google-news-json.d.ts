// Type declaration for google-news-json
declare module 'google-news-json' {
  export interface NewsSource {
    href?: string;
    title?: string;
  }

  export interface NewsItem {
    title?: string;
    snippet?: string;
    link?: string;
    source?: NewsSource;
    published?: string;
    thumbnail?: string;
  }

  export interface NewsResult {
    items?: NewsItem[];
  }

  export const TOP_NEWS: string;
  export const WORLD: string;
  export const NATION: string;
  export const BUSINESS: string;
  export const TECHNOLOGY: string;
  export const ENTERTAINMENT: string;
  export const SCIENCE: string;
  export const SPORTS: string;
  export const HEALTH: string;
  export const SEARCH: string;

  export function getNews(type: string, query: string | null, locale?: string): Promise<NewsResult>;
}
