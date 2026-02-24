import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import type { JobHandler } from '../job-handler.interface';

interface ReportGenerationInput {
  assessmentId: string;
}

interface ReportGenerationResult {
  assessmentId: string;
  pdfKey: string;
  downloadUrl: string;
}

/**
 * STUB handler for REPORT_GENERATION jobs.
 * Generates a mock PDF and uploads to S3.
 * Replace with actual PDF generation when implementing the full pipeline.
 */
@Injectable()
export class ReportGenerationHandler implements JobHandler {
  private readonly logger = new Logger(ReportGenerationHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async execute(input: ReportGenerationInput): Promise<ReportGenerationResult> {
    this.logger.log(`[STUB] Generating report for assessment: ${input.assessmentId}`);

    const assessment = await this.prisma.assessment.findUnique({
      where: { id: input.assessmentId },
    });

    if (!assessment) {
      throw new Error(`Assessment ${input.assessmentId} not found`);
    }

    const reportId = `report-${Date.now()}`;
    const pdfKey = this.storageService.buildReportKey(input.assessmentId, reportId);

    // In production, this would actually generate and upload the PDF
    // For now, generate a presigned download URL (stub assumes PDF already exists)
    const downloadUrl = await this.storageService.generatePresignedDownloadUrl(pdfKey);

    await this.prisma.assessment.update({
      where: { id: input.assessmentId },
      data: { progress: 100 },
    });

    this.logger.log(`[STUB] Report generated: ${pdfKey}`);

    return { assessmentId: input.assessmentId, pdfKey, downloadUrl };
  }
}
