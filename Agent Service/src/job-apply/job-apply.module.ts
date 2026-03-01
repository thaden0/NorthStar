import { Module } from '@nestjs/common';
import { JobApplyController } from './job-apply.controller';
import { JobApplyService } from './job-apply.service';
import { LlmModule } from '../llm/llm.module';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [LlmModule, ToolsModule],
  controllers: [JobApplyController],
  providers: [JobApplyService],
  exports: [JobApplyService],
})
export class JobApplyModule {}
