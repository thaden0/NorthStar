import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlaywrightService } from './playwright.service';
import { GoogleNewsService } from './google-news.service';
import { GmailToolService } from './gmail-tool.service';
import { ToolParserService } from './tool-parser.service';
import { ToolExecutorService } from './tool-executor.service';

@Module({
  imports: [ConfigModule],
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
