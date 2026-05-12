import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { JobsService } from '../../platform/jobs/jobs.service';
import { UpdateRecommendationDto, UpdateAnalystCommentDto } from './dto';
import { JobType } from '@alliance-risk/shared';
import { RISK_ANALYSIS_CONFIG } from './risk-analysis.config';
import type { CategoryDefinition } from './risk-analysis.config';
import type { RiskScore, Recommendation } from '@prisma/client';

export type RiskScoreWithRecommendations = RiskScore & {
  recommendations: Recommendation[];
};

@Injectable()
export class RiskAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  private async validateOwnership(assessmentId: string, userId: string): Promise<void> {
    // SECURITY: Use findFirst with compound condition to prevent IDOR and resource enumeration
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, userId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
  }

  async findByAssessment(
    assessmentId: string,
    userId: string,
  ): Promise<RiskScoreWithRecommendations[]> {
    await this.validateOwnership(assessmentId, userId);
    return this.prisma.riskScore.findMany({
      where: { assessmentId },
      include: { recommendations: { orderBy: { order: 'asc' } } },
      orderBy: { category: 'asc' },
    });
  }

  async editRecommendation(
    assessmentId: string,
    recId: string,
    dto: UpdateRecommendationDto,
    userId: string,
  ): Promise<Recommendation> {
    await this.validateOwnership(assessmentId, userId);

    const recommendation = await this.prisma.recommendation.findUnique({
      where: { id: recId },
      include: { riskScore: true },
    });

    if (!recommendation) throw new NotFoundException('Recommendation not found');
    if (recommendation.riskScore.assessmentId !== assessmentId) {
      throw new ForbiddenException('Recommendation does not belong to this assessment');
    }

    return this.prisma.recommendation.update({
      where: { id: recId },
      data: {
        isEdited: true,
        editedText: dto.text,
      },
    });
  }

  async updateAnalystComment(
    assessmentId: string,
    scoreId: string,
    dto: UpdateAnalystCommentDto,
    userId: string,
  ): Promise<RiskScore> {
    await this.validateOwnership(assessmentId, userId);

    const riskScore = await this.prisma.riskScore.findUnique({
      where: { id: scoreId },
    });

    if (!riskScore) throw new NotFoundException('Risk score not found');
    if (riskScore.assessmentId !== assessmentId) {
      throw new ForbiddenException('Risk score does not belong to this assessment');
    }

    return this.prisma.riskScore.update({
      where: { id: scoreId },
      data: { analystComment: dto.comment },
    });
  }

  async resyncCategory(
    assessmentId: string,
    category: string,
    userId: string,
  ): Promise<{ jobId: string }> {
    await this.validateOwnership(assessmentId, userId);

    // Validate category is one of the 7 valid values
    const validCategories = (RISK_ANALYSIS_CONFIG.categories as unknown as CategoryDefinition[])
      .map((c) => c.category);
    if (!validCategories.includes(category as typeof validCategories[number])) {
      throw new BadRequestException(`Invalid category: ${category}. Must be one of: ${validCategories.join(', ')}`);
    }

    // Check for existing pending/processing resync job for this assessment+category
    const existingJob = await this.prisma.job.findFirst({
      where: {
        type: 'RECALCULATE_CATEGORY' as unknown as import('@prisma/client').$Enums.JobType,
        status: { in: ['PENDING', 'PROCESSING'] },
        input: {
          path: ['assessmentId'],
          equals: assessmentId,
        },
      },
    });

    if (existingJob) {
      const existingInput = existingJob.input as { category?: string };
      if (existingInput.category === category) {
        throw new BadRequestException('A resync is already in progress for this category');
      }
    }

    const jobId = await this.jobsService.create(
      JobType.RECALCULATE_CATEGORY,
      { assessmentId, category },
      userId,
    );

    return { jobId };
  }
}
