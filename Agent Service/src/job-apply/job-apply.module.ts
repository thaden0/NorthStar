import { Module } from '@nestjs/common';
import { JobApplyController } from './job-apply.controller';
import { JobApplyService } from './job-apply.service';
import { LoginController } from './login.controller';
import { LoginSessionService } from './login-session.service';
import { LlmModule } from '../llm/llm.module';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [LlmModule, ToolsModule],
  controllers: [JobApplyController, LoginController],
  providers: [JobApplyService, LoginSessionService],
  exports: [JobApplyService, LoginSessionService],
})
export class JobApplyModule {}
