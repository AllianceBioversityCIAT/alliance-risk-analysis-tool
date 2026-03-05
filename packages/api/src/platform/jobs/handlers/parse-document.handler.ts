import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ExtractorFactory } from '../../../infrastructure/extractors/extractor-factory';
import type { JobHandler } from '../job-handler.interface';
import type { ExtractionResult } from '@alliance-risk/shared';

interface ParseDocumentInput {
  assessmentId: string;
  documentId: string;
  s3Key: string;
  /** MIME type determines which extractor to use (PDF → Textract, other → Programmatic) */
  mimeType: string;
  /** Original file name, passed to extractor for logging */
  fileName: string;
}

@Injectable()
export class ParseDocumentHandler implements JobHandler {
  private readonly logger = new Logger(ParseDocumentHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractorFactory: ExtractorFactory,
    private readonly config: ConfigService,
  ) {}

  async execute(input: ParseDocumentInput): Promise<ExtractionResult> {
    const { documentId, s3Key, mimeType, fileName } = input;

    this.logger.log(
      `Parsing document ${documentId} (${mimeType}) from s3Key: ${s3Key}`,
    );

    // Step 1: Mark document as PARSING
    await this.prisma.assessmentDocument.update({
      where: { id: documentId },
      data: { status: 'PARSING' },
    });

    // Step 2: Route to the correct extractor via strategy pattern
    const s3Bucket = this.config.get<string>('S3_BUCKET_NAME') ?? '';
    const extractor = this.extractorFactory.getExtractor(mimeType);
    const result = await extractor.extract(s3Bucket, s3Key, mimeType, fileName);

    // Step 3: Mark document as PARSED
    await this.prisma.assessmentDocument.update({
      where: { id: documentId },
      data: { status: 'PARSED', errorMessage: null },
    });

    this.logger.log(
      `Document ${documentId} parsed successfully. Pages: ${result.pages}, markdown length: ${result.markdownContent?.length ?? 0}`,
    );

    return result;
  }

  async onFailure(documentId: string, error: Error): Promise<void> {
    this.logger.error(`Document ${documentId} parse failed: ${error.message}`);
    await this.prisma.assessmentDocument.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
      },
    });
  }
}
