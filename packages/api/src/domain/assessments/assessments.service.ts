import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { JobsService } from '../../platform/jobs/jobs.service';
import { JobType, ALLOWED_DOCUMENT_MIME_TYPES, MAX_FILE_SIZE_PDF, MAX_FILE_SIZE_OTHER } from '@alliance-risk/shared';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
  ListAssessmentsQueryDto,
  RequestUploadDto,
  CreateAssessmentCommentDto,
} from './dto';
import type { Assessment, AssessmentComment } from '@prisma/client';

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly jobsService: JobsService,
  ) {}

  async create(dto: CreateAssessmentDto, userId: string): Promise<Assessment> {
    return this.prisma.assessment.create({
      data: {
        name: dto.name,
        companyName: dto.companyName,
        companyType: dto.companyType,
        country: dto.country ?? 'Kenya',
        intakeMode: dto.intakeMode as unknown as import('@prisma/client').$Enums.IntakeMode,
        userId,
      },
    });
  }

  async findAll(
    userId: string,
    query: ListAssessmentsQueryDto,
  ): Promise<{ data: Assessment[]; nextCursor: string | null; total: number }> {
    const limit = query.limit ?? 10;

    const where = {
      userId,
      ...(query.status && { status: query.status as unknown as import('@prisma/client').$Enums.AssessmentStatus }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { companyName: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const total = await this.prisma.assessment.count({ where });

    const assessments = await this.prisma.assessment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(query.cursor && {
        cursor: { id: query.cursor },
        skip: 1,
      }),
    });

    let nextCursor: string | null = null;
    if (assessments.length > limit) {
      const nextItem = assessments.pop();
      nextCursor = nextItem?.id ?? null;
    }

    return { data: assessments, nextCursor, total };
  }

  async findOne(id: string, userId: string): Promise<Assessment> {
    // SECURITY: Use findFirst to prevent IDOR and resource enumeration
    const assessment = await this.prisma.assessment.findFirst({
      where: { id, userId },
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    return assessment;
  }

  async update(id: string, dto: UpdateAssessmentDto, userId: string): Promise<Assessment> {
    await this.findOne(id, userId); // Ownership check

    const updateData = {
      ...(dto.name && { name: dto.name }),
      ...(dto.companyName && { companyName: dto.companyName }),
      ...(dto.companyType !== undefined && { companyType: dto.companyType }),
      ...(dto.status && { status: dto.status as unknown as import('@prisma/client').$Enums.AssessmentStatus }),
      ...(dto.progress !== undefined && { progress: dto.progress }),
      version: { increment: 1 },
    };

    // Optimistic locking: if version is provided, verify it matches
    if (dto.version !== undefined) {
      const result = await this.prisma.assessment.updateMany({
        where: { id, version: dto.version },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.companyName && { companyName: dto.companyName }),
          ...(dto.companyType !== undefined && { companyType: dto.companyType }),
          ...(dto.status && { status: dto.status as unknown as import('@prisma/client').$Enums.AssessmentStatus }),
          ...(dto.progress !== undefined && { progress: dto.progress }),
          version: dto.version + 1,
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          'Assessment was modified by another user. Please refresh and try again.',
        );
      }

      return this.prisma.assessment.findUniqueOrThrow({ where: { id } });
    }

    // No version provided — backward compatible, skip conflict check
    return this.prisma.assessment.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId); // Ownership check
    await this.prisma.assessment.delete({ where: { id } });
  }

  async getStats(userId: string): Promise<{ active: number; drafts: number; completed: number; total: number }> {
    const [active, drafts, completed, total] = await Promise.all([
      this.prisma.assessment.count({ where: { userId, status: 'ANALYZING' } }),
      this.prisma.assessment.count({ where: { userId, status: 'DRAFT' } }),
      this.prisma.assessment.count({ where: { userId, status: 'COMPLETE' } }),
      this.prisma.assessment.count({ where: { userId } }),
    ]);
    return { active, drafts, completed, total };
  }

  async requestUploadUrl(
    id: string,
    dto: RequestUploadDto,
    userId: string,
  ): Promise<{ presignedUrl: string; documentId: string }> {
    await this.findOne(id, userId); // Ownership check

    if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(dto.mimeType)) {
      throw new BadRequestException(
        `Unsupported file type: ${dto.mimeType}. Allowed: ${ALLOWED_DOCUMENT_MIME_TYPES.join(', ')}`,
      );
    }

    const maxSize =
      dto.mimeType === 'application/pdf' ? MAX_FILE_SIZE_PDF : MAX_FILE_SIZE_OTHER;
    if (dto.fileSize > maxSize) {
      const limitMB = Math.round(maxSize / (1024 * 1024));
      throw new BadRequestException(
        `File too large. Maximum size for ${dto.mimeType === 'application/pdf' ? 'PDF' : 'non-PDF'} files is ${limitMB}MB.`,
      );
    }

    // Create the document record first to get an ID for the S3 key
    const document = await this.prisma.assessmentDocument.create({
      data: {
        assessmentId: id,
        fileName: dto.fileName,
        s3Key: '', // Will be updated below
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
      },
    });

    const s3Key = this.storageService.buildDocumentKey(id, document.id, dto.fileName);

    // Update with the actual key
    await this.prisma.assessmentDocument.update({
      where: { id: document.id },
      data: { s3Key },
    });

    const presignedUrl = await this.storageService.generatePresignedUploadUrl(
      s3Key,
      dto.mimeType,
    );

    return { presignedUrl, documentId: document.id };
  }

  async getDocuments(id: string, userId: string) {
    await this.findOne(id, userId);
    const documents = await this.prisma.assessmentDocument.findMany({
      where: { assessmentId: id },
      orderBy: { uploadedAt: 'desc' },
    });

    return Promise.all(
      documents.map(async (doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        status: doc.status,
        uploadedAt: doc.uploadedAt,
        presignedUrl: doc.s3Key
          ? await this.storageService.generatePresignedDownloadUrl(doc.s3Key)
          : null,
      })),
    );
  }

  async triggerParseDocument(id: string, documentId: string, userId: string): Promise<string> {
    await this.findOne(id, userId);

    // Fetch the document to get the s3Key
    const document = await this.prisma.assessmentDocument.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Mark document as UPLOADED before creating the job
    await this.prisma.assessmentDocument.update({
      where: { id: documentId },
      data: { status: 'UPLOADED' },
    });

    // Create the job with assessmentId, documentId, s3Key, mimeType, and fileName in input
    const jobId = await this.jobsService.create(
      JobType.PARSE_DOCUMENT,
      {
        assessmentId: id,
        documentId,
        s3Key: document.s3Key,
        mimeType: document.mimeType,
        fileName: document.fileName,
      },
      userId,
    );

    // Link the job back to the document
    await this.prisma.assessmentDocument.update({
      where: { id: documentId },
      data: { parseJobId: jobId },
    });

    // Update assessment status to ANALYZING
    await this.prisma.assessment.update({
      where: { id },
      data: { status: 'ANALYZING' },
    });

    return jobId;
  }

  /**
   * Trigger parsing for ALL documents in an assessment that are in UPLOADED or FAILED state.
   * Creates one PARSE_DOCUMENT job per document, invokes Worker Lambda async for each,
   * and sets the assessment status to ANALYZING.
   * Returns the list of job IDs created.
   */
  async triggerParseAllDocuments(
    assessmentId: string,
    userId: string,
  ): Promise<{ jobIds: string[] }> {
    await this.findOne(assessmentId, userId); // Ownership check

    const documents = await this.prisma.assessmentDocument.findMany({
      where: {
        assessmentId,
        status: { in: ['PENDING_UPLOAD', 'UPLOADED', 'FAILED'] },
      },
    });

    if (documents.length === 0) {
      throw new BadRequestException('No uploaded documents to parse. Upload at least one file first.');
    }

    const jobIds: string[] = [];

    for (const doc of documents) {
      // Mark document as UPLOADED if still PENDING_UPLOAD (S3 upload completed by frontend)
      if (doc.status === 'PENDING_UPLOAD') {
        await this.prisma.assessmentDocument.update({
          where: { id: doc.id },
          data: { status: 'UPLOADED' },
        });
      }

      const jobId = await this.jobsService.create(
        JobType.PARSE_DOCUMENT,
        {
          assessmentId,
          documentId: doc.id,
          s3Key: doc.s3Key,
          mimeType: doc.mimeType,
          fileName: doc.fileName,
        },
        userId,
      );

      await this.prisma.assessmentDocument.update({
        where: { id: doc.id },
        data: { parseJobId: jobId },
      });

      jobIds.push(jobId);
    }

    // Mark assessment as ANALYZING
    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: 'ANALYZING' },
    });

    this.logger.log(
      `Created ${jobIds.length} PARSE_DOCUMENT job(s) for assessment ${assessmentId}`,
    );

    return { jobIds };
  }

  /**
   * Delete a single document from an assessment.
   * Removes the S3 object and the database record.
   * Rejects deletion if the document is currently being parsed.
   */
  async deleteDocument(
    assessmentId: string,
    documentId: string,
    userId: string,
  ): Promise<void> {
    await this.findOne(assessmentId, userId); // Ownership check

    const doc = await this.prisma.assessmentDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.assessmentId !== assessmentId) {
      throw new NotFoundException('Document not found');
    }

    if (doc.status === 'PARSING') {
      throw new BadRequestException(
        'Cannot delete a document that is currently being parsed. Wait for parsing to complete.',
      );
    }

    // Delete from S3
    if (doc.s3Key) {
      try {
        await this.storageService.deleteObject(doc.s3Key);
      } catch (err) {
        this.logger.warn(`Failed to delete S3 object ${doc.s3Key}: ${(err as Error).message}`);
        // Continue — DB record should still be removed
      }
    }

    await this.prisma.assessmentDocument.delete({ where: { id: documentId } });
    this.logger.log(`Deleted document ${documentId} from assessment ${assessmentId}`);
  }

  /**
   * Returns the merged Markdown content from the latest completed GAP_DETECTION job.
   * Used by the frontend DocumentViewer to display compiled document content.
   * Returns null if no completed gap detection job exists yet.
   */
  async getMergedContent(
    assessmentId: string,
    userId: string,
  ): Promise<{ mergedMarkdown: string | null }> {
    await this.findOne(assessmentId, userId); // Ownership check

    const gapJob = await this.prisma.job.findFirst({
      where: {
        type: 'GAP_DETECTION',
        status: 'COMPLETED',
        input: { path: ['assessmentId'], equals: assessmentId },
      },
      orderBy: { completedAt: 'desc' },
    });

    if (!gapJob?.result) return { mergedMarkdown: null };

    const result = gapJob.result as { mergedMarkdown?: string };
    return { mergedMarkdown: result.mergedMarkdown ?? null };
  }

  async addComment(
    id: string,
    dto: CreateAssessmentCommentDto,
    userId: string,
  ): Promise<AssessmentComment> {
    await this.findOne(id, userId); // Ownership check
    return this.prisma.assessmentComment.create({
      data: {
        assessmentId: id,
        userId,
        content: dto.content,
      },
    });
  }

  async getComments(id: string, userId: string): Promise<AssessmentComment[]> {
    await this.findOne(id, userId); // Ownership check
    return this.prisma.assessmentComment.findMany({
      where: { assessmentId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { email: true } },
      },
    });
  }
}
