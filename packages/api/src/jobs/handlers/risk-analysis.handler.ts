import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { JobHandler } from '../job-handler.interface';

interface RiskAnalysisInput {
  assessmentId: string;
}

interface RiskAnalysisResult {
  assessmentId: string;
  categoriesScored: number;
  overallScore: number;
}

const RISK_CATEGORIES = [
  'FINANCIAL',
  'CLIMATE_ENVIRONMENTAL',
  'BEHAVIORAL',
  'OPERATIONAL',
  'MARKET',
  'GOVERNANCE_LEGAL',
  'TECHNOLOGY_DATA',
] as const;

/**
 * STUB handler for RISK_ANALYSIS jobs.
 * Creates mock RiskScore and Recommendation records.
 * Replace with actual Bedrock agent call when implementing the agent pipeline.
 */
@Injectable()
export class RiskAnalysisHandler implements JobHandler {
  private readonly logger = new Logger(RiskAnalysisHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: RiskAnalysisInput): Promise<RiskAnalysisResult> {
    this.logger.log(`[STUB] Running risk analysis for assessment: ${input.assessmentId}`);

    const riskLevels = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const;
    let totalScore = 0;
    let categoriesScored = 0;

    for (const category of RISK_CATEGORIES) {
      const score = Math.round(Math.random() * 80 + 10); // 10-90
      const levelIndex = Math.floor(score / 25);
      const level = riskLevels[Math.min(levelIndex, 3)];
      totalScore += score;
      categoriesScored++;

      const subcategories = [1, 2, 3, 4, 5].map((i) => ({
        name: `${category} Subcategory ${i}`,
        indicator: `Indicator ${i}`,
        score: Math.round(Math.random() * 80 + 10),
        level: riskLevels[Math.min(Math.floor(score / 25), 3)],
        evidence: `Mock evidence for ${category} subcategory ${i}`,
        mitigation: `Mock mitigation strategy for ${category} subcategory ${i}`,
      }));

      // Upsert risk score for idempotency
      const riskScore = await this.prisma.riskScore.upsert({
        where: { assessmentId_category: { assessmentId: input.assessmentId, category } },
        create: {
          assessmentId: input.assessmentId,
          category,
          score,
          level,
          subcategories,
          evidence: `Mock evidence for ${category} risk category`,
          narrative: `The ${category} risk level is ${level} based on analysis of available data.`,
        },
        update: {
          score,
          level,
          subcategories,
          evidence: `Mock evidence for ${category} risk category`,
          narrative: `The ${category} risk level is ${level} based on analysis of available data.`,
        },
      });

      // Create recommendations
      const priorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
      for (let i = 0; i < 2; i++) {
        await this.prisma.recommendation.create({
          data: {
            riskScoreId: riskScore.id,
            text: `Recommendation ${i + 1} for ${category}: Address the identified ${priorities[i % 3].toLowerCase()} priority risk.`,
            priority: priorities[i % 3],
            order: i,
          },
        });
      }
    }

    const overallScore = Math.round(totalScore / categoriesScored);
    const overallLevelIndex = Math.floor(overallScore / 25);
    const overallLevel = (['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const)[Math.min(overallLevelIndex, 3)];

    await this.prisma.assessment.update({
      where: { id: input.assessmentId },
      data: {
        status: 'COMPLETE',
        progress: 90,
        overallRiskScore: overallScore,
        overallRiskLevel: overallLevel,
      },
    });

    this.logger.log(`[STUB] Risk analysis complete. Overall score: ${overallScore}`);

    return { assessmentId: input.assessmentId, categoriesScored, overallScore };
  }
}
