import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { PdfService } from './pdf.service';
import { ReportController } from './report.controller';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [DatabaseModule, StorageModule, JobsModule],
  controllers: [ReportController],
  providers: [ReportService, PdfService],
  exports: [ReportService, PdfService],
})
export class ReportModule {}
