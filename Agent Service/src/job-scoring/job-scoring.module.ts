import { Module } from '@nestjs/common';
import { JobScoringController } from './job-scoring.controller';
import { JobScoringService } from './job-scoring.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [JobScoringController],
  providers: [JobScoringService],
  exports: [JobScoringService],
})
export class JobScoringModule {}
