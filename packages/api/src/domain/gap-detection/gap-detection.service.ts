import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { JobsService } from '../../platform/jobs/jobs.service';
import { JobType } from '@alliance-risk/shared';
import { UpdateGapFieldsDto } from './dto';


@Injectable()
export class GapDetectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  private async validateOwnership(assessmentId: string, userId: string): Promise<void> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.userId !== userId) throw new ForbiddenException('Access denied');
  }

  async findByAssessment(assessmentId: string, userId: string) {
    await this.validateOwnership(assessmentId, userId);
    const fields = await this.prisma.gapField.findMany({
      where: { assessmentId },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });

    const total = fields.length;
    const verifiedCount = fields.filter((f) => f.status === 'VERIFIED').length;
    const missingCount = fields.filter((f) => f.status === 'MISSING').length;
    const mandatoryFields = fields.filter((f) => f.isMandatory);
    const allMandatoryComplete =
      mandatoryFields.length > 0 &&
      mandatoryFields.every(
        (f) => f.status === 'VERIFIED' || f.correctedValue || f.extractedValue,
      );

    return { data: fields, total, verifiedCount, missingCount, allMandatoryComplete };
  }

  async updateBatch(
    assessmentId: string,
    dto: UpdateGapFieldsDto,
    userId: string,
  ) {
    await this.validateOwnership(assessmentId, userId);

    // Batch update using transactions
    await this.prisma.$transaction(
      dto.updates.map((update) =>
        this.prisma.gapField.update({
          where: { id: update.id },
          data: {
            correctedValue: update.correctedValue,
            status: update.correctedValue ? 'VERIFIED' : 'MISSING',
          },
        }),
      ),
    );

    return this.findByAssessment(assessmentId, userId);
  }

  async checkMandatoryFields(
    assessmentId: string,
  ): Promise<{ allComplete: boolean; missing: string[] }> {
    const mandatoryFields = await this.prisma.gapField.findMany({
      where: { assessmentId, isMandatory: true },
    });

    const missing = mandatoryFields
      .filter((f) => f.status === 'MISSING' || (!f.correctedValue && !f.extractedValue))
      .map((f) => f.label);

    return { allComplete: missing.length === 0, missing };
  }

  async triggerReAnalysis(assessmentId: string, userId: string): Promise<{ jobId: string }> {
    await this.validateOwnership(assessmentId, userId);
    const jobId = await this.jobsService.create(
      JobType.GAP_DETECTION,
      { assessmentId, reAnalyze: true },
      userId,
    );
    return { jobId };
  }

  async triggerRiskAnalysis(assessmentId: string, userId: string): Promise<string> {
    await this.validateOwnership(assessmentId, userId);
    const jobId = await this.jobsService.create(
      JobType.RISK_ANALYSIS,
      { assessmentId },
      userId,
    );
    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: 'ANALYZING' },
    });
    return jobId;
  }
}
