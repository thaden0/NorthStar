import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlaywrightService } from './playwright.service';
import { GoogleNewsService } from './google-news.service';
import { GmailToolService } from './gmail-tool.service';
import { ToolParserService } from './tool-parser.service';
import { ToolExecutorService } from './tool-executor.service';
import { WikipediaService } from './wikipedia.service';
import { RedditService } from './reddit.service';
import { BackgroundAgentService } from './background-agent.service';
import { TimeTrackingService } from './time-tracking.service';
import { ClientsService } from './clients.service';
import { NotificationsService } from './notifications.service';
import { FilesService } from './files.service';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { CronModule } from '../cron/cron.module';
import { MemoryModule } from '../memory/memory.module';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => CronModule),
    MemoryModule,
    DatabaseModule,
    LlmModule,
    SettingsModule,
  ],
  providers: [
    PlaywrightService,
    GoogleNewsService,
    GmailToolService,
    ToolParserService,
    ToolExecutorService,
    WikipediaService,
    RedditService,
    BackgroundAgentService,
    TimeTrackingService,
    ClientsService,
    NotificationsService,
    FilesService,
    ScheduledTasksService,
  ],
  exports: [
    PlaywrightService,
    GoogleNewsService,
    GmailToolService,
    ToolParserService,
    ToolExecutorService,
    WikipediaService,
    RedditService,
    BackgroundAgentService,
    TimeTrackingService,
    ClientsService,
    NotificationsService,
    FilesService,
    ScheduledTasksService,
  ],
})
export class ToolsModule {}
