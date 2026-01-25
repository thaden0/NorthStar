import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { modelAnalytics } from '../database/schema';
import { eq, sql, desc, and, gte } from 'drizzle-orm';

export interface ModelStats {
  modelName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  totalTokens: number;
  lastUsed: Date | null;
}

export interface RecordAnalyticsParams {
  modelName: string;
  executionId?: string;
  userId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  responseTimeMs: number;
  success: boolean;
  errorType?: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private databaseService: DatabaseService) {}

  /**
   * Record a model analytics entry
   */
  async recordAnalytics(params: RecordAnalyticsParams): Promise<void> {
    const db = this.databaseService.getDb();

    try {
      await db.insert(modelAnalytics).values({
        modelName: params.modelName,
        executionId: params.executionId,
        userId: params.userId,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens: params.totalTokens,
        responseTimeMs: params.responseTimeMs,
        success: params.success,
        errorType: params.errorType,
      });

      this.logger.debug(
        `Recorded analytics for model ${params.modelName}: ${params.responseTimeMs}ms`,
      );
    } catch (error) {
      this.logger.error(`Failed to record analytics: ${error}`);
    }
  }

  /**
   * Get stats for all models
   */
  async getAllModelStats(): Promise<ModelStats[]> {
    const db = this.databaseService.getDb();

    const results = await db
      .select({
        modelName: modelAnalytics.modelName,
        totalRequests: sql<number>`count(*)::int`,
        successfulRequests: sql<number>`count(*) filter (where ${modelAnalytics.success} = true)::int`,
        failedRequests: sql<number>`count(*) filter (where ${modelAnalytics.success} = false)::int`,
        averageResponseTimeMs: sql<number>`round(avg(${modelAnalytics.responseTimeMs}))::int`,
        minResponseTimeMs: sql<number>`min(${modelAnalytics.responseTimeMs})::int`,
        maxResponseTimeMs: sql<number>`max(${modelAnalytics.responseTimeMs})::int`,
        totalTokens: sql<number>`coalesce(sum(${modelAnalytics.totalTokens}), 0)::int`,
        lastUsed: sql<Date>`max(${modelAnalytics.createdAt})`,
      })
      .from(modelAnalytics)
      .groupBy(modelAnalytics.modelName)
      .orderBy(desc(sql`count(*)`));

    return results;
  }

  /**
   * Get stats for a specific model
   */
  async getModelStats(modelName: string): Promise<ModelStats | null> {
    const db = this.databaseService.getDb();

    const [result] = await db
      .select({
        modelName: modelAnalytics.modelName,
        totalRequests: sql<number>`count(*)::int`,
        successfulRequests: sql<number>`count(*) filter (where ${modelAnalytics.success} = true)::int`,
        failedRequests: sql<number>`count(*) filter (where ${modelAnalytics.success} = false)::int`,
        averageResponseTimeMs: sql<number>`round(avg(${modelAnalytics.responseTimeMs}))::int`,
        minResponseTimeMs: sql<number>`min(${modelAnalytics.responseTimeMs})::int`,
        maxResponseTimeMs: sql<number>`max(${modelAnalytics.responseTimeMs})::int`,
        totalTokens: sql<number>`coalesce(sum(${modelAnalytics.totalTokens}), 0)::int`,
        lastUsed: sql<Date>`max(${modelAnalytics.createdAt})`,
      })
      .from(modelAnalytics)
      .where(eq(modelAnalytics.modelName, modelName))
      .groupBy(modelAnalytics.modelName);

    return result || null;
  }

  /**
   * Get recent analytics entries for a model
   */
  async getRecentAnalytics(
    modelName: string,
    limit: number = 50,
  ): Promise<
    Array<{
      id: string;
      responseTimeMs: number;
      success: boolean;
      createdAt: Date;
    }>
  > {
    const db = this.databaseService.getDb();

    return db
      .select({
        id: modelAnalytics.id,
        responseTimeMs: modelAnalytics.responseTimeMs,
        success: modelAnalytics.success,
        createdAt: modelAnalytics.createdAt,
      })
      .from(modelAnalytics)
      .where(eq(modelAnalytics.modelName, modelName))
      .orderBy(desc(modelAnalytics.createdAt))
      .limit(limit);
  }

  /**
   * Get hourly stats for a model (last 24 hours)
   */
  async getHourlyStats(
    modelName: string,
  ): Promise<
    Array<{
      hour: string;
      requests: number;
      avgResponseTime: number;
    }>
  > {
    const db = this.databaseService.getDb();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const results = await db
      .select({
        hour: sql<string>`date_trunc('hour', ${modelAnalytics.createdAt})::text`,
        requests: sql<number>`count(*)::int`,
        avgResponseTime: sql<number>`round(avg(${modelAnalytics.responseTimeMs}))::int`,
      })
      .from(modelAnalytics)
      .where(
        and(
          eq(modelAnalytics.modelName, modelName),
          gte(modelAnalytics.createdAt, twentyFourHoursAgo),
        ),
      )
      .groupBy(sql`date_trunc('hour', ${modelAnalytics.createdAt})`)
      .orderBy(sql`date_trunc('hour', ${modelAnalytics.createdAt})`);

    return results;
  }
}
