import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { JobsService } from '../../platform/jobs/jobs.service';
import {
  JobType,
  JobStatus,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_FILE_SIZE_PDF,
  MAX_FILE_SIZE_OTHER,
  DEFAULT_COUNTRY,
  MergedContentResponse,
} from '@alliance-risk/shared';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
  ListAssessmentsQueryDto,
  RequestUploadDto,
  CreateAssessmentCommentDto,
} from './dto';
import type { Assessment, AssessmentComment } from '@prisma/client';

/**
 * Age past which a non-terminal job stops reading as "in flight"
 * (T-009 attempt 3, Leader-promoted from Reviewer finding — see
 * `## Pivot Record: T-008` and the T-009 attempt-1/2 entries in
 * `execution.md`).
 *
 * Nothing in this platform retries a job reset to `PENDING`
 * (`design.md` §8.2, DD-DDP-006), so `analysisInFlight` computed from
 * status alone is true forever for a stuck job. Because in-flight now
 * outranks `superseded` with no other bound (§8.1), that stuck state would
 * show "Analysing your documents…" indefinitely and make "Re-analyse now"
 * unreachable even across reloads — a worse dead end than the bug this
 * spec fixes.
 *
 * **Why 4 minutes and not 5.** Attempt 2 set this to 5 minutes by matching
 * two codebase precedents that both land on 300 000ms. That number is
 * exactly `MERGED_CONTENT_MAX_EMPTY_POLLS` (60) × the client's own
 * `POLL_INTERVAL_MS` (5000) in `use-merged-content.ts` — the client's
 * *entire poll budget*. A continuously-open screen can therefore stop
 * polling on the very same tick the server flips `analysisInFlight` to
 * `false`, and then never observe the reveal without a remount or a focus
 * refetch — the fix becomes reachable by luck, not by construction. This
 * constant must stay **strictly less than** the client's poll budget so at
 * least one poll is guaranteed to land after the server-side flip; 4
 * minutes leaves a 60-second margin (twelve polls at the client's
 * interval). **Do not "tidy" this back to 5 minutes / 300 000ms for
 * symmetry with the client constants** — that symmetry is precisely the
 * defect this comment exists to prevent from recurring.
 *
 * **Not a cost.** The `createdAt` predicate this bound adds to the
 * `job.count` queries below aligns with the existing
 * `@@index([status, createdAt])` on `Job` (`schema.prisma`), so filtering
 * on it is a query-plan win, not a perf tradeoff — do not "optimise" it
 * away by dropping the predicate.
 */
const ANALYSIS_IN_FLIGHT_MAX_AGE_MS = 4 * 60 * 1000;

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
        country: dto.country ?? DEFAULT_COUNTRY,
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
      ...(query.country && { country: query.country }),
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
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.userId !== userId) throw new ForbiddenException('Access denied');
    return assessment;
  }

  private buildAssessmentUpdateFields(dto: UpdateAssessmentDto) {
    return {
      ...(dto.name && { name: dto.name }),
      ...(dto.companyName && { companyName: dto.companyName }),
      ...(dto.companyType !== undefined && { companyType: dto.companyType }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.status && { status: dto.status as unknown as import('@prisma/client').$Enums.AssessmentStatus }),
      ...(dto.progress !== undefined && { progress: dto.progress }),
    };
  }

  async update(id: string, dto: UpdateAssessmentDto, userId: string): Promise<Assessment> {
    const assessment = await this.findOne(id, userId); // Ownership check

    if (dto.country !== undefined && assessment.status !== 'DRAFT') {
      throw new BadRequestException(
        'Country can only be changed while assessment is in DRAFT status',
      );
    }

    const fields = this.buildAssessmentUpdateFields(dto);

    // Optimistic locking: if version is provided, verify it matches
    if (dto.version !== undefined) {
      const result = await this.prisma.assessment.updateMany({
        where: { id, version: dto.version },
        data: { ...fields, version: dto.version + 1 },
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
      data: { ...fields, version: { increment: 1 } },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId); // Ownership check
    await this.prisma.assessment.delete({ where: { id } });
  }

  async getStats(
    userId: string,
    country?: string,
  ): Promise<{ active: number; drafts: number; completed: number; total: number }> {
    const baseWhere = { userId, ...(country && { country }) };
    const [active, drafts, completed, total] = await Promise.all([
      this.prisma.assessment.count({ where: { ...baseWhere, status: 'ANALYZING' } }),
      this.prisma.assessment.count({ where: { ...baseWhere, status: 'DRAFT' } }),
      this.prisma.assessment.count({ where: { ...baseWhere, status: 'COMPLETE' } }),
      this.prisma.assessment.count({ where: baseWhere }),
    ]);
    return { active, drafts, completed, total };
  }

  async requestUploadUrl(
    id: string,
    dto: RequestUploadDto,
    userId: string,
  ): Promise<{ presignedUrl: string; documentId: string }> {
    await this.findOne(id, userId); // Ownership check

    if (dto.mimeType === 'application/msword') {
      throw new BadRequestException(
        'Legacy .doc format is not supported. Please save the document as .docx (Word 2007+) and re-upload.',
      );
    }

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
   * Removes the S3 object (best-effort) and, in one transaction, the
   * database record and its own orphaned PARSE_DOCUMENT job (FR-DDP-004).
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

    // Delete from S3 — best-effort, outside the transaction. A failure here
    // must not block the row cleanup below.
    if (doc.s3Key) {
      try {
        await this.storageService.deleteObject(doc.s3Key);
      } catch (err) {
        this.logger.warn(`Failed to delete S3 object ${doc.s3Key}: ${(err as Error).message}`);
        // Continue — DB record should still be removed
      }
    }

    // Delete the document row and its own parse job atomically: either both
    // are removed or neither is (FR-DDP-004 Sc2). The job delete is scoped
    // by both id and type — id alone would say nothing about job type,
    // since parseJobId is unique per document but not per job kind.
    const parseJobId = doc.parseJobId;
    await this.prisma.$transaction(async (tx) => {
      await tx.assessmentDocument.delete({ where: { id: documentId } });
      if (parseJobId) {
        await tx.job.delete({ where: { id: parseJobId, type: 'PARSE_DOCUMENT' } });
      }
    });

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
  ): Promise<MergedContentResponse> {
    await this.findOne(assessmentId, userId); // Ownership check

    const gapJob = await this.prisma.job.findFirst({
      where: {
        type: 'GAP_DETECTION',
        status: 'COMPLETED',
        input: { path: ['assessmentId'], equals: assessmentId },
      },
      orderBy: { completedAt: 'desc' },
    });

    // "Current" documents: every AssessmentDocument row that exists right
    // now, with no status filter, no ordering, and no time window — exactly
    // what design.md §7.3 requires so an added-but-unparsed or
    // still-parsing document is still "current" and cannot supersede. Read
    // unconditionally — not only on the withholding path below — because
    // `analysisInFlight` needs it regardless of whether a completed
    // analysis exists at all (design.md §7.3 v2.1).
    const currentDocuments = await this.prisma.assessmentDocument.findMany({
      where: { assessmentId },
    });
    const currentParseJobIds = currentDocuments
      .map((document) => document.parseJobId)
      .filter((parseJobId): parseJobId is string => parseJobId !== null);

    // Computed independently of `superseded` below — neither reads the
    // other. Content availability is a property of the snapshot;
    // work-in-progress is a property of the run (design.md §7.3 v2.1,
    // restoring v1.2's shape after v2.0 discarded it — see `## Pivot
    // Record: T-008` in execution.md). This is the only signal by which the
    // client can observe a server-chained analysis completing: that job's
    // id is created in jobs.service.ts and never returned in any HTTP
    // response.
    const analysisInFlight = await this.isAnalysisInFlight(
      assessmentId,
      currentParseJobIds,
    );

    if (!gapJob?.result) {
      return { mergedMarkdown: null, superseded: false, analysisInFlight };
    }

    const result = gapJob.result as {
      mergedMarkdown?: string;
      sourceParseJobIds?: string[];
    };

    // A snapshot recorded before this fix carries no `sourceParseJobIds` key
    // at all, so supersession cannot be evaluated against it. Fail closed:
    // treat it as superseded rather than trust unevaluable content.
    if (!('sourceParseJobIds' in result)) {
      return { mergedMarkdown: null, superseded: true, analysisInFlight };
    }

    // The one rule: superseded iff the snapshot references a parse job that
    // is no longer any current document's parseJobId. One-directional
    // subtraction — sourceParseJobIds \ currentParseJobIds — never a set
    // comparison. An addition only grows currentParseJobIds, so it can
    // never make this true; only a removed/re-parsed document can.
    const currentParseJobIdSet = new Set(currentParseJobIds);
    const sourceParseJobIds = result.sourceParseJobIds ?? [];
    const superseded = sourceParseJobIds.some(
      (jobId) => !currentParseJobIdSet.has(jobId),
    );

    return {
      mergedMarkdown: superseded ? null : (result.mergedMarkdown ?? null),
      superseded,
      analysisInFlight,
    };
  }

  /**
   * True when a non-terminal PARSE_DOCUMENT job exists for one of the
   * assessment's current documents, or a non-terminal GAP_DETECTION job
   * exists for the assessment (design.md §7.3 v2.1), **and that job is no
   * older than `ANALYSIS_IN_FLIGHT_MAX_AGE_MS`**. Deliberately separate
   * from — and never consulted by — the withholding rule above: modelling
   * in-flight as a freshness value is the exact defect Judgment Day round
   * two found (finding R-1), which short-circuited the snapshot rules and
   * blanked valid content.
   *
   * The age bound exists because a job stuck non-terminal is otherwise
   * indistinguishable from one genuinely running — see
   * `ANALYSIS_IN_FLIGHT_MAX_AGE_MS`'s own comment for why that stops being
   * safe once in-flight outranks `superseded`.
   */
  private async isAnalysisInFlight(
    assessmentId: string,
    currentParseJobIds: string[],
  ): Promise<boolean> {
    const nonTerminalStatuses = [JobStatus.PENDING, JobStatus.PROCESSING];
    const notStuck = {
      createdAt: { gte: new Date(Date.now() - ANALYSIS_IN_FLIGHT_MAX_AGE_MS) },
    };

    const [inFlightParseCount, inFlightGapCount] = await Promise.all([
      currentParseJobIds.length > 0
        ? this.prisma.job.count({
            where: {
              id: { in: currentParseJobIds },
              type: 'PARSE_DOCUMENT',
              status: { in: nonTerminalStatuses },
              ...notStuck,
            },
          })
        : Promise.resolve(0),
      this.prisma.job.count({
        where: {
          type: 'GAP_DETECTION',
          status: { in: nonTerminalStatuses },
          input: { path: ['assessmentId'], equals: assessmentId },
          ...notStuck,
        },
      }),
    ]);

    return inFlightParseCount > 0 || inFlightGapCount > 0;
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
