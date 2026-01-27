import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronJobsService } from './cron-jobs.service';
import { AgentService } from '../agent/agent.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CronJob } from '../database/schema';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private isRunning = false;
  private runningJobs = new Set<string>();

  constructor(
    private readonly cronJobsService: CronJobsService,
    private readonly agentService: AgentService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    this.logger.log('Scheduler service initialized');
    // Initial check for due jobs on startup
    await this.checkDueJobs();
  }

  onModuleDestroy() {
    this.logger.log('Scheduler service shutting down');
    this.isRunning = false;
  }

  /**
   * Check for due jobs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkDueJobs() {
    if (this.isRunning) {
      this.logger.debug('Scheduler already running, skipping...');
      return;
    }

    this.isRunning = true;
    
    try {
      const dueJobs = await this.cronJobsService.findDueJobs();
      
      if (dueJobs.length > 0) {
        this.logger.log(`Found ${dueJobs.length} due jobs to execute`);
      }

      for (const job of dueJobs) {
        // Skip if already running
        if (this.runningJobs.has(job.id)) {
          continue;
        }

        // Execute job asynchronously
        this.executeJob(job).catch(err => {
          this.logger.error(`Error executing job ${job.id}: ${err.message}`);
        });
      }
    } catch (error) {
      this.logger.error(`Error checking due jobs: ${error}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Execute a scheduled job
   */
  async executeJob(job: CronJob): Promise<void> {
    this.runningJobs.add(job.id);
    this.logger.log(`Executing job: ${job.id} - ${job.name}`);

    // Create execution record
    const execution = await this.cronJobsService.createExecution(job.id, job.userId);

    try {
      // Run the agent with the job's prompt
      const result = await this.runAgentPrompt(job.userId, job.prompt, job.name);

      // Update execution as completed
      await this.cronJobsService.updateExecution(
        execution.id,
        'completed',
        result.response
      );

      // Send notification to user
      await this.notificationsService.create({
        userId: job.userId,
        type: 'cron_result',
        title: `✅ Scheduled Task Completed: ${job.name}`,
        message: result.response,
        data: {
          jobId: job.id,
          jobName: job.name,
          executionId: execution.id,
          prompt: job.prompt,
        },
      });

      // Mark job as executed and schedule next run
      await this.cronJobsService.markExecuted(job.id);

      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update execution as failed
      await this.cronJobsService.updateExecution(
        execution.id,
        'failed',
        undefined,
        errorMessage
      );

      // Send failure notification
      await this.notificationsService.create({
        userId: job.userId,
        type: 'cron_error',
        title: `❌ Scheduled Task Failed: ${job.name}`,
        message: `Task failed with error: ${errorMessage}`,
        data: {
          jobId: job.id,
          jobName: job.name,
          executionId: execution.id,
          error: errorMessage,
        },
      });

      // Still mark as executed to calculate next run
      await this.cronJobsService.markExecuted(job.id);

      this.logger.error(`Job ${job.id} failed: ${errorMessage}`);
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(jobId: string): Promise<{ executionId: string }> {
    const job = await this.cronJobsService.findOne(jobId);
    
    if (this.runningJobs.has(jobId)) {
      throw new Error('Job is already running');
    }

    // Execute asynchronously
    this.executeJob(job).catch(err => {
      this.logger.error(`Error executing triggered job ${jobId}: ${err.message}`);
    });

    return { executionId: `triggered-${Date.now()}` };
  }

  /**
   * Run the agent with a prompt
   */
  private async runAgentPrompt(
    userId: string, 
    prompt: string,
    taskName: string
  ): Promise<{ response: string; conversationId: string }> {
    try {
      // Create a new conversation for this scheduled task
      const conversation = await this.agentService.createConversation(
        userId,
        `[Scheduled] ${taskName}`
      );

      // Run the agent using the public method
      const result = await this.agentService.runAgentTask(
        conversation.id,
        prompt,
        userId
      );

      return {
        response: result.response || 'Task completed successfully.',
        conversationId: conversation.id,
      };
    } catch (error) {
      throw new Error(`Agent execution failed: ${error}`);
    }
  }
}
