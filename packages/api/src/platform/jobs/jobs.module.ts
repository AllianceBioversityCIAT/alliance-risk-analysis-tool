import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { AiPreviewHandler } from './handlers/ai-preview.handler';
import { ParseDocumentHandler } from './handlers/parse-document.handler';
import { GapDetectionHandler } from './handlers/gap-detection.handler';
import { RiskAnalysisHandler } from './handlers/risk-analysis.handler';
import { ReportGenerationHandler } from './handlers/report-generation.handler';
import { PdfService } from '../../domain/report/pdf.service';
import { BedrockModule } from '../../infrastructure/bedrock/bedrock.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { ExtractorsModule } from '../../infrastructure/extractors/extractors.module';

@Module({
  imports: [DatabaseModule, BedrockModule, StorageModule, ExtractorsModule],
  providers: [
    JobsService,
    AiPreviewHandler,
    ParseDocumentHandler,
    GapDetectionHandler,
    RiskAnalysisHandler,
    ReportGenerationHandler,
    PdfService,
  ],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
