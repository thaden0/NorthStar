import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AgentModule } from './agent/agent.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { SettingsModule } from './settings/settings.module';
import { ToolsModule } from './tools/tools.module';
import { LlmModule } from './llm/llm.module';
import { CronModule } from './cron/cron.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MemoryModule } from './memory/memory.module';
import { JobScoringModule } from './job-scoring/job-scoring.module';
import { CoverLetterModule } from './cover-letter/cover-letter.module';
import { JobApplyModule } from './job-apply/job-apply.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    AuthModule,
    AgentModule,
    UsersModule,
    ConversationsModule,
    SettingsModule,
    ToolsModule,
    LlmModule,
    CronModule,
    NotificationsModule,
    MemoryModule,
    JobScoringModule,
    CoverLetterModule,
    JobApplyModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

