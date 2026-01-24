import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentToolsService } from './agent-tools.service';
import { ToolsModule } from '../tools/tools.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [ToolsModule, LlmModule],
  controllers: [AgentController],
  providers: [AgentService, AgentToolsService],
  exports: [AgentService],
})
export class AgentModule {}
