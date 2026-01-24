import { Module } from '@nestjs/common';
import { PlaywrightService } from './playwright.service';
import { GoogleNewsService } from './google-news.service';

@Module({
  providers: [PlaywrightService, GoogleNewsService],
  exports: [PlaywrightService, GoogleNewsService],
})
export class ToolsModule {}
