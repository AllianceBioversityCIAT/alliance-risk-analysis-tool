import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateRecommendationDto } from './dto';
import type { RiskScore, Recommendation } from '@prisma/client';

export type RiskScoreWithRecommendations = RiskScore & {
  recommendations: Recommendation[];
};

@Injectable()
export class RiskAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateOwnership(assessmentId: string, userId: string): Promise<void> {
    // SECURITY: Use findFirst with userId to prevent IDOR and resource enumeration (returns 404 instead of 403)
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

    // SECURITY: Use findFirst with nested conditions to prevent IDOR and resource enumeration (returns 404 instead of 403)
    const recommendation = await this.prisma.recommendation.findFirst({
      where: { id: recId, riskScore: { assessmentId } },
      include: { riskScore: true },
    });

    if (!recommendation) throw new NotFoundException('Recommendation not found');

    return this.prisma.recommendation.update({
      where: { id: recId },
      data: {
        isEdited: true,
        editedText: dto.text,
      },
    });
  }
}
