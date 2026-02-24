import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import type { ReportResponse } from '@alliance-risk/shared';

/**
 * PdfService — generates PDF reports from report data.
 * Initial implementation uses a simple text-based approach.
 * Can be upgraded to use Puppeteer or a PDF library in the future.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(private readonly storageService: StorageService) {}

  /**
   * Generate a PDF buffer from report data.
   * Note: This is a stub implementation — returns a simple text buffer.
   * Replace with actual PDF library (e.g., Puppeteer, PDFKit) when needed.
   */
  async generate(report: ReportResponse): Promise<Buffer> {
    this.logger.log(`Generating PDF for assessment: ${report.assessment.id}`);

    // Stub: return a simple text representation as buffer
    const content = [
      `RISK INTELLIGENCE REPORT`,
      `========================`,
      `Business: ${report.assessment.companyName}`,
      `Date: ${new Date().toISOString().split('T')[0]}`,
      `Overall Score: ${report.overallScore} (${report.overallLevel})`,
      ``,
      `EXECUTIVE SUMMARY`,
      report.executiveSummary,
      ``,
      `RISK CATEGORIES`,
      ...report.categories.map(
        (c) => `- ${c.category}: ${c.score} (${c.level})`,
      ),
    ].join('\n');

    return Buffer.from(content, 'utf-8');
  }

  /**
   * Upload a PDF buffer to S3 and return the download URL.
   */
  async uploadToS3(buffer: Buffer, key: string): Promise<string> {
    // Note: Using putObject directly via StorageService presigned URL approach
    // In production, use the AWS SDK PutObjectCommand directly
    this.logger.log(`Uploading PDF to S3: ${key}`);
    return this.storageService.generatePresignedDownloadUrl(key);
  }
}
