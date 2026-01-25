import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentToolsService } from './agent-tools.service';
import { ToolsModule } from '../tools/tools.module';
import { LlmModule } from '../llm/llm.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [ToolsModule, LlmModule, SettingsModule],
  controllers: [AgentController],
  providers: [AgentService, AgentToolsService],
  exports: [AgentService],
})
export class AgentModule {}
