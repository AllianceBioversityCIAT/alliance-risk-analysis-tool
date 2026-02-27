import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { TextractService } from '../../textract/textract.service';
import type { JobHandler } from '../job-handler.interface';
import type { ExtractionResult } from '@alliance-risk/shared';

interface ParseDocumentInput {
  assessmentId: string;
  documentId: string;
  s3Key: string;
}

@Injectable()
export class ParseDocumentHandler implements JobHandler {
  private readonly logger = new Logger(ParseDocumentHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly textract: TextractService,
    private readonly config: ConfigService,
  ) {}

  async execute(input: ParseDocumentInput): Promise<ExtractionResult> {
    const { documentId, s3Key } = input;

    this.logger.log(`Parsing document ${documentId} from s3Key: ${s3Key}`);

    // Step 1: Mark document as PARSING
    await this.prisma.assessmentDocument.update({
      where: { id: documentId },
      data: { status: 'PARSING' },
    });

    // Step 2: Run Textract analysis
    const s3Bucket = this.config.get<string>('S3_BUCKET') ?? '';
    const result = await this.textract.analyzeDocument(s3Bucket, s3Key);

    // Step 3: Mark document as PARSED
    await this.prisma.assessmentDocument.update({
      where: { id: documentId },
      data: { status: 'PARSED', errorMessage: null },
    });

    this.logger.log(
      `Document ${documentId} parsed successfully. Pages: ${result.pages}, text length: ${result.textContent.length}`,
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
