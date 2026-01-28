import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryToolsService } from './memory-tools.service';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [DatabaseModule, LlmModule],
  providers: [MemoryService, MemoryToolsService],
  exports: [MemoryService, MemoryToolsService],
})
export class MemoryModule {}
