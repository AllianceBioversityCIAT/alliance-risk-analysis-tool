import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { JobType } from '@alliance-risk/shared';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
  ListAssessmentsQueryDto,
  RequestUploadDto,
  CreateAssessmentCommentDto,
} from './dto';
import type { Assessment, AssessmentDocument, AssessmentComment } from '@prisma/client';

const ALLOWED_MIME_TYPES = ['application/pdf'];

@Injectable()
export class AssessmentsService {
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
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.userId !== userId) throw new ForbiddenException('Access denied');
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

    if (!ALLOWED_MIME_TYPES.includes(dto.mimeType)) {
      throw new BadRequestException('Only PDF files are allowed');
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

  async getDocuments(id: string, userId: string): Promise<AssessmentDocument[]> {
    await this.findOne(id, userId);
    return this.prisma.assessmentDocument.findMany({
      where: { assessmentId: id },
      orderBy: { uploadedAt: 'desc' },
    });
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

    // Create the job with assessmentId, documentId, and s3Key in input
    const jobId = await this.jobsService.create(
      JobType.PARSE_DOCUMENT,
      { assessmentId: id, documentId, s3Key: document.s3Key },
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
