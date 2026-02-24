import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateRecommendationDto } from './dto';
import type { RiskScore, Recommendation } from '@prisma/client';

export type RiskScoreWithRecommendations = RiskScore & {
  recommendations: Recommendation[];
};

@Injectable()
export class RiskAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateOwnership(assessmentId: string, userId: string): Promise<void> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.userId !== userId) throw new ForbiddenException('Access denied');
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
}
