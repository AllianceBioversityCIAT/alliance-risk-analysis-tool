import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { AiPreviewHandler } from './handlers/ai-preview.handler';
import { ParseDocumentHandler } from './handlers/parse-document.handler';
import { GapDetectionHandler } from './handlers/gap-detection.handler';
import { RiskAnalysisHandler } from './handlers/risk-analysis.handler';
import { ReportGenerationHandler } from './handlers/report-generation.handler';
import { BedrockModule } from '../bedrock/bedrock.module';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [DatabaseModule, BedrockModule, StorageModule],
  providers: [
    JobsService,
    AiPreviewHandler,
    ParseDocumentHandler,
    GapDetectionHandler,
    RiskAnalysisHandler,
    ReportGenerationHandler,
  ],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
