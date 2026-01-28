import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlaywrightService } from './playwright.service';
import { GoogleNewsService } from './google-news.service';
import { GmailToolService } from './gmail-tool.service';
import { ToolParserService } from './tool-parser.service';
import { ToolExecutorService } from './tool-executor.service';
import { CronModule } from '../cron/cron.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [ConfigModule, forwardRef(() => CronModule), MemoryModule],
  providers: [
    PlaywrightService,
    GoogleNewsService,
    GmailToolService,
    ToolParserService,
    ToolExecutorService,
  ],
  exports: [
    PlaywrightService,
    GoogleNewsService,
    GmailToolService,
    ToolParserService,
    ToolExecutorService,
  ],
})
export class ToolsModule {}
