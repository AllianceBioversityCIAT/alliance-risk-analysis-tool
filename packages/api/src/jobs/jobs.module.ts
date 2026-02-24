import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { AiPreviewHandler } from './handlers/ai-preview.handler';
import { BedrockModule } from '../bedrock/bedrock.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, BedrockModule],
  providers: [JobsService, AiPreviewHandler],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
