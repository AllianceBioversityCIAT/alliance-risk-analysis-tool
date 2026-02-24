import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { JobsModule } from '../jobs/jobs.module';
import { PromptsService } from './prompts.service';
import { CommentsService } from './comments.service';
import { ChangeHistoryService } from './change-history.service';
import { VariableInjectionService } from './variable-injection.service';
import { PromptsController } from './prompts.controller';
import { PromptsRuntimeController } from './prompts-runtime.controller';

@Module({
  imports: [DatabaseModule, JobsModule],
  controllers: [PromptsController, PromptsRuntimeController],
  providers: [PromptsService, CommentsService, ChangeHistoryService, VariableInjectionService],
  exports: [PromptsService, CommentsService, ChangeHistoryService, VariableInjectionService],
})
export class PromptsModule {}
