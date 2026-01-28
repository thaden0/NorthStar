import { Injectable, Logger } from '@nestjs/common';

/**
 * Reddit post data
 */
export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  score: number;
  upvoteRatio: number;
  numComments: number;
  url: string;
  permalink: string;
  createdUtc: number;
  isNsfw: boolean;
  isSelf: boolean;
  linkUrl?: string;
  thumbnail?: string;
}

/**
 * Reddit comment data
 */
export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  createdUtc: number;
  depth: number;
  replies: RedditComment[];
  permalink: string;
}

/**
 * Reddit thread (post + comments)
 */
export interface RedditThread {
  post: RedditPost;
  comments: RedditComment[];
  totalComments: number;
}

export interface RedditSearchResult {
  query: string;
  subreddit?: string;
  posts: RedditPost[];
  after?: string;
  error?: string;
}

/**
 * Service for interacting with Reddit's public JSON API
 * Uses the .json endpoint which doesn't require authentication
 */
@Injectable()
export class RedditService {
  private readonly logger = new Logger(RedditService.name);
  private readonly baseUrl = 'https://www.reddit.com';
  private readonly userAgent = 'NorthStarAgent/1.0';

  /**
   * Search Reddit for posts
   */
  async search(
    query: string,
    options: {
      subreddit?: string;
      sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
      time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
      after?: string;
    } = {}
  ): Promise<RedditSearchResult> {
    try {
      const { subreddit, sort = 'relevance', time = 'all', limit = 25, after } = options;
      
      let url: string;
      if (subreddit) {
        url = `${this.baseUrl}/r/${subreddit}/search.json`;
      } else {
        url = `${this.baseUrl}/search.json`;
      }

      const params = new URLSearchParams({
        q: query,
        sort,
        t: time,
        limit: Math.min(limit, 100).toString(),
        restrict_sr: subreddit ? 'true' : 'false',
        type: 'link',
      });

      if (after) {
        params.set('after', after);
      }

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          return { query, posts: [], error: 'Rate limited by Reddit. Please wait a moment.' };
        }
        throw new Error(`Reddit API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        return { query, posts: [], error: data.message || data.error };
      }

      const posts = this.parsePostListing(data.data?.children || []);
      
      return {
        query,
        subreddit,
        posts,
        after: data.data?.after || undefined,
      };
    } catch (error) {
      this.logger.error(`Reddit search error: ${error}`);
      return {
        query,
        posts: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get hot posts from a subreddit or front page
   */
  async getHot(
    subreddit?: string,
    limit: number = 25
  ): Promise<{ posts: RedditPost[]; error?: string }> {
    try {
      const url = subreddit
        ? `${this.baseUrl}/r/${subreddit}/hot.json`
        : `${this.baseUrl}/hot.json`;

      const params = new URLSearchParams({
        limit: Math.min(limit, 100).toString(),
      });

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { posts: [], error: `Subreddit r/${subreddit} not found` };
        }
        throw new Error(`Reddit API error: ${response.status}`);
      }

      const data = await response.json();
      return { posts: this.parsePostListing(data.data?.children || []) };
    } catch (error) {
      this.logger.error(`Reddit hot posts error: ${error}`);
      return {
        posts: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get a full thread with comments
   */
  async getThread(
    permalink: string,
    options: {
      sort?: 'confidence' | 'top' | 'new' | 'controversial' | 'old' | 'qa';
      depth?: number;
      limit?: number;
    } = {}
  ): Promise<RedditThread | { error: string }> {
    try {
      const { sort = 'confidence', depth = 5, limit = 100 } = options;
      
      // Normalize permalink
      let cleanPermalink = permalink;
      if (permalink.startsWith('http')) {
        const url = new URL(permalink);
        cleanPermalink = url.pathname;
      }
      if (!cleanPermalink.startsWith('/')) {
        cleanPermalink = '/' + cleanPermalink;
      }
      if (!cleanPermalink.endsWith('/')) {
        cleanPermalink = cleanPermalink + '/';
      }

      const params = new URLSearchParams({
        sort,
        depth: depth.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`${this.baseUrl}${cleanPermalink}.json?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { error: 'Thread not found' };
        }
        throw new Error(`Reddit API error: ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length < 2) {
        return { error: 'Invalid thread data' };
      }

      // First item is the post, second is comments
      const postData = data[0].data?.children?.[0]?.data;
      const commentsData = data[1].data?.children || [];

      if (!postData) {
        return { error: 'Post data not found' };
      }

      const post = this.parsePost(postData);
      const comments = this.parseComments(commentsData);

      return {
        post,
        comments,
        totalComments: post.numComments,
      };
    } catch (error) {
      this.logger.error(`Reddit thread error: ${error}`);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get user's recent posts and comments
   */
  async getUserContent(
    username: string,
    type: 'overview' | 'submitted' | 'comments' = 'overview',
    limit: number = 25
  ): Promise<{ posts: RedditPost[]; comments: RedditComment[]; error?: string }> {
    try {
      const params = new URLSearchParams({
        limit: Math.min(limit, 100).toString(),
      });

      const response = await fetch(
        `${this.baseUrl}/user/${username}/${type}.json?${params}`,
        {
          headers: {
            'User-Agent': this.userAgent,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return { posts: [], comments: [], error: `User u/${username} not found` };
        }
        throw new Error(`Reddit API error: ${response.status}`);
      }

      const data = await response.json();
      const children = data.data?.children || [];

      const posts: RedditPost[] = [];
      const comments: RedditComment[] = [];

      for (const child of children) {
        if (child.kind === 't3') {
          posts.push(this.parsePost(child.data));
        } else if (child.kind === 't1') {
          comments.push(this.parseComment(child.data, 0));
        }
      }

      return { posts, comments };
    } catch (error) {
      this.logger.error(`Reddit user content error: ${error}`);
      return {
        posts: [],
        comments: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Parse post listing data
   */
  private parsePostListing(children: Array<{ kind: string; data: Record<string, unknown> }>): RedditPost[] {
    return children
      .filter((child) => child.kind === 't3')
      .map((child) => this.parsePost(child.data));
  }

  /**
   * Parse a single post
   */
  private parsePost(data: Record<string, unknown>): RedditPost {
    return {
      id: data.id as string,
      title: data.title as string,
      selftext: (data.selftext as string) || '',
      author: data.author as string,
      subreddit: data.subreddit as string,
      score: data.score as number,
      upvoteRatio: data.upvote_ratio as number,
      numComments: data.num_comments as number,
      url: `${this.baseUrl}${data.permalink}`,
      permalink: data.permalink as string,
      createdUtc: data.created_utc as number,
      isNsfw: data.over_18 as boolean,
      isSelf: data.is_self as boolean,
      linkUrl: data.is_self ? undefined : (data.url as string),
      thumbnail: data.thumbnail === 'self' || data.thumbnail === 'default' 
        ? undefined 
        : (data.thumbnail as string),
    };
  }

  /**
   * Parse comments recursively
   */
  private parseComments(children: Array<{ kind: string; data: Record<string, unknown> }>): RedditComment[] {
    const comments: RedditComment[] = [];

    for (const child of children) {
      if (child.kind !== 't1') continue;
      comments.push(this.parseComment(child.data, 0));
    }

    return comments;
  }

  /**
   * Parse a single comment with replies
   */
  private parseComment(data: Record<string, unknown>, depth: number): RedditComment {
    const replies: RedditComment[] = [];

    if (data.replies && typeof data.replies === 'object') {
      const repliesData = (data.replies as { data?: { children?: Array<{ kind: string; data: Record<string, unknown> }> } }).data?.children || [];
      for (const reply of repliesData) {
        if (reply.kind === 't1') {
          replies.push(this.parseComment(reply.data, depth + 1));
        }
      }
    }

    return {
      id: data.id as string,
      author: data.author as string,
      body: data.body as string,
      score: data.score as number,
      createdUtc: data.created_utc as number,
      depth,
      replies,
      permalink: `${this.baseUrl}${data.permalink}`,
    };
  }
}
