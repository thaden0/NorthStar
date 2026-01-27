import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronJobsService } from './cron-jobs.service';
import { CronJobsController } from './cron-jobs.controller';
import { SchedulerService } from './scheduler.service';
import { DatabaseModule } from '../database/database.module';
import { AgentModule } from '../agent/agent.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    forwardRef(() => AgentModule),
    NotificationsModule,
  ],
  controllers: [CronJobsController],
  providers: [CronJobsService, SchedulerService],
  exports: [CronJobsService, SchedulerService],
})
export class CronModule {}
