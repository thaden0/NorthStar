import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { ToolsModule } from '../tools/tools.module';
import { LlmModule } from '../llm/llm.module';
import { SettingsModule } from '../settings/settings.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [ToolsModule, LlmModule, SettingsModule, MemoryModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
