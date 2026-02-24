import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { JobType } from '@alliance-risk/shared';
import { UpdateGapFieldsDto } from './dto';
import type { GapField } from '@prisma/client';

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

  async findByAssessment(assessmentId: string, userId: string): Promise<GapField[]> {
    await this.validateOwnership(assessmentId, userId);
    return this.prisma.gapField.findMany({
      where: { assessmentId },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
  }

  async updateBatch(
    assessmentId: string,
    dto: UpdateGapFieldsDto,
    userId: string,
  ): Promise<GapField[]> {
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
