import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AnalyticsService } from './analytics.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [SettingsController],
  providers: [SettingsService, AnalyticsService],
  exports: [SettingsService, AnalyticsService],
})
export class SettingsModule {}
