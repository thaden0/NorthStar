import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, desc, lte, isNull, or } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { cronJobs, jobExecutions, NewCronJob, CronJob, JobExecution } from '../database/schema';
import { CreateCronJobDto, UpdateCronJobDto } from './dto/cron-job.dto';

@Injectable()
export class CronJobsService {
  private readonly logger = new Logger(CronJobsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new cron job
   */
  async create(userId: string, dto: CreateCronJobDto): Promise<CronJob> {
    const nextRunAt = this.calculateNextRun(dto);
    
    const newJob: NewCronJob = {
      userId,
      name: dto.name,
      description: dto.description,
      prompt: dto.prompt,
      scheduleType: dto.scheduleType,
      cronExpression: dto.cronExpression,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      recurringPattern: dto.recurringPattern,
      recurringDay: dto.recurringDay,
      recurringTime: dto.recurringTime,
      timezone: dto.timezone || 'UTC',
      enabled: dto.enabled ?? true,
      nextRunAt,
    };

    const [job] = await this.db.getDb().insert(cronJobs).values(newJob).returning();
    this.logger.log(`Created cron job: ${job.id} - ${job.name}`);
    return job;
  }

  /**
   * Get all cron jobs for a user
   */
  async findAllByUser(userId: string): Promise<CronJob[]> {
    return this.db.getDb()
      .select()
      .from(cronJobs)
      .where(eq(cronJobs.userId, userId))
      .orderBy(desc(cronJobs.createdAt));
  }

  /**
   * Get all enabled cron jobs (for scheduler)
   */
  async findAllEnabled(): Promise<CronJob[]> {
    return this.db.getDb()
      .select()
      .from(cronJobs)
      .where(eq(cronJobs.enabled, true));
  }

  /**
   * Get jobs that are due to run
   */
  async findDueJobs(): Promise<CronJob[]> {
    const now = new Date();
    return this.db.getDb()
      .select()
      .from(cronJobs)
      .where(
        and(
          eq(cronJobs.enabled, true),
          or(
            isNull(cronJobs.nextRunAt),
            lte(cronJobs.nextRunAt, now)
          )
        )
      );
  }

  /**
   * Get a specific cron job
   */
  async findOne(id: string): Promise<CronJob> {
    const [job] = await this.db.getDb()
      .select()
      .from(cronJobs)
      .where(eq(cronJobs.id, id));

    if (!job) {
      throw new NotFoundException(`Cron job ${id} not found`);
    }

    return job;
  }

  /**
   * Update a cron job
   */
  async update(id: string, userId: string, dto: UpdateCronJobDto): Promise<CronJob> {
    const existing = await this.findOne(id);
    
    if (existing.userId !== userId) {
      throw new NotFoundException(`Cron job ${id} not found`);
    }

    const nextRunAt = this.calculateNextRun({
      scheduleType: dto.scheduleType || existing.scheduleType,
      cronExpression: dto.cronExpression || existing.cronExpression,
      scheduledAt: dto.scheduledAt || existing.scheduledAt?.toISOString(),
      recurringPattern: dto.recurringPattern || existing.recurringPattern,
      recurringDay: dto.recurringDay ?? existing.recurringDay,
      recurringTime: dto.recurringTime || existing.recurringTime,
      timezone: dto.timezone || existing.timezone,
    } as CreateCronJobDto);

    const [updated] = await this.db.getDb()
      .update(cronJobs)
      .set({
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        nextRunAt,
        updatedAt: new Date(),
      })
      .where(eq(cronJobs.id, id))
      .returning();

    this.logger.log(`Updated cron job: ${id}`);
    return updated;
  }

  /**
   * Delete a cron job
   */
  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.findOne(id);
    
    if (existing.userId !== userId) {
      throw new NotFoundException(`Cron job ${id} not found`);
    }

    await this.db.getDb().delete(cronJobs).where(eq(cronJobs.id, id));
    this.logger.log(`Deleted cron job: ${id}`);
  }

  /**
   * Mark a job as executed and schedule next run
   */
  async markExecuted(id: string): Promise<void> {
    const job = await this.findOne(id);
    const nextRunAt = this.calculateNextRun(job as unknown as CreateCronJobDto);

    // For one-time jobs, disable after execution
    const shouldDisable = job.scheduleType === 'once';

    await this.db.getDb()
      .update(cronJobs)
      .set({
        lastRunAt: new Date(),
        nextRunAt: shouldDisable ? null : nextRunAt,
        runCount: (job.runCount || 0) + 1,
        enabled: shouldDisable ? false : job.enabled,
        updatedAt: new Date(),
      })
      .where(eq(cronJobs.id, id));
  }

  /**
   * Create execution record
   */
  async createExecution(jobId: string, userId: string): Promise<JobExecution> {
    const [execution] = await this.db.getDb()
      .insert(jobExecutions)
      .values({
        jobId,
        userId,
        status: 'running',
      })
      .returning();

    return execution;
  }

  /**
   * Update execution with result
   */
  async updateExecution(
    executionId: string, 
    status: 'completed' | 'failed',
    result?: string,
    error?: string
  ): Promise<void> {
    const startedAt = (await this.db.getDb()
      .select({ startedAt: jobExecutions.startedAt })
      .from(jobExecutions)
      .where(eq(jobExecutions.id, executionId)))[0]?.startedAt;

    const executionTimeMs = startedAt 
      ? Date.now() - startedAt.getTime() 
      : null;

    await this.db.getDb()
      .update(jobExecutions)
      .set({
        status,
        result,
        error,
        completedAt: new Date(),
        executionTimeMs,
      })
      .where(eq(jobExecutions.id, executionId));
  }

  /**
   * Get execution history for a job
   */
  async getExecutions(jobId: string, limit = 20): Promise<JobExecution[]> {
    return this.db.getDb()
      .select()
      .from(jobExecutions)
      .where(eq(jobExecutions.jobId, jobId))
      .orderBy(desc(jobExecutions.startedAt))
      .limit(limit);
  }

  /**
   * Calculate the next run time based on schedule configuration
   */
  private calculateNextRun(dto: Partial<CreateCronJobDto>): Date | null {
    const now = new Date();
    const timezone = dto.timezone || 'UTC';

    switch (dto.scheduleType) {
      case 'once':
        if (dto.scheduledAt) {
          const scheduled = new Date(dto.scheduledAt);
          return scheduled > now ? scheduled : null;
        }
        return null;

      case 'cron':
        if (dto.cronExpression) {
          return this.getNextCronTime(dto.cronExpression, timezone);
        }
        return null;

      case 'recurring':
        return this.getNextRecurringTime(
          dto.recurringPattern || 'daily',
          dto.recurringDay,
          dto.recurringTime || '09:00',
          timezone
        );

      default:
        return null;
    }
  }

  /**
   * Parse cron expression and get next run time
   */
  private getNextCronTime(expression: string, timezone: string): Date {
    // Simple cron parsing - for production, use a library like cron-parser
    const parts = expression.split(' ');
    if (parts.length !== 5) {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: tomorrow
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    // Set time
    if (hour !== '*') next.setHours(parseInt(hour, 10));
    if (minute !== '*') next.setMinutes(parseInt(minute, 10));
    next.setSeconds(0);
    next.setMilliseconds(0);

    // If the time has passed today, move to next occurrence
    if (next <= now) {
      if (dayOfWeek !== '*') {
        // Move to next matching day of week
        const targetDay = parseInt(dayOfWeek, 10);
        const currentDay = now.getDay();
        const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntil);
      } else {
        // Move to tomorrow
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  }

  /**
   * Get next recurring time based on pattern
   */
  private getNextRecurringTime(
    pattern: string,
    day: number | undefined,
    time: string,
    timezone: string
  ): Date {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const next = new Date(now);

    next.setHours(hours, minutes, 0, 0);

    switch (pattern) {
      case 'daily':
        if (next <= now) next.setDate(next.getDate() + 1);
        break;

      case 'weekly':
        const targetDay = day ?? 1; // Default Monday
        const currentDay = now.getDay();
        let daysUntil = (targetDay - currentDay + 7) % 7;
        if (daysUntil === 0 && next <= now) daysUntil = 7;
        next.setDate(next.getDate() + daysUntil);
        break;

      case 'biweekly':
        const biweeklyDay = day ?? 1;
        const biweeklyCurrent = now.getDay();
        let biweeklyDays = (biweeklyDay - biweeklyCurrent + 7) % 7;
        if (biweeklyDays === 0 && next <= now) biweeklyDays = 14;
        else if (biweeklyDays <= 7) biweeklyDays += 7;
        next.setDate(next.getDate() + biweeklyDays);
        break;

      case 'monthly':
        const targetDate = day ?? 1;
        next.setDate(targetDate);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;

      case 'weekdays':
        if (next <= now) next.setDate(next.getDate() + 1);
        while (next.getDay() === 0 || next.getDay() === 6) {
          next.setDate(next.getDate() + 1);
        }
        break;

      case 'weekends':
        if (next <= now) next.setDate(next.getDate() + 1);
        while (next.getDay() !== 0 && next.getDay() !== 6) {
          next.setDate(next.getDate() + 1);
        }
        break;
    }

    return next;
  }
}
