import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { JobsService } from '../../platform/jobs/jobs.service';
import { JobType } from '@alliance-risk/shared';
import type { ReportResponse } from '@alliance-risk/shared';
import type { ReportConfigDto } from './dto/report-config.dto';

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  private async validateOwnership(assessmentId: string, userId: string) {
    // SECURITY: Use findFirst to prevent IDOR and resource enumeration
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, userId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async getReport(assessmentId: string, userId: string): Promise<ReportResponse> {
    const assessment = await this.validateOwnership(assessmentId, userId);

    const riskScores = await this.prisma.riskScore.findMany({
      where: { assessmentId },
      include: { recommendations: { orderBy: { order: 'asc' } } },
      orderBy: { category: 'asc' },
    });

    const radarData = riskScores.map((s) => ({
      category: s.category,
      score: s.score,
    }));

    const overallScore = assessment.overallRiskScore ?? 0;
    const overallLevel = assessment.overallRiskLevel ?? 'LOW';

    // Build executive summary from category narratives if available
    const narratives = riskScores.filter((s) => s.narrative).map((s) => s.narrative);
    const executiveSummary = narratives.length > 0
      ? `Risk assessment for ${assessment.companyName} has been completed with an overall risk score of ${overallScore} (${overallLevel}). ` +
        `The analysis evaluated 7 risk categories across 35 indicators. ` +
        narratives.slice(0, 3).join(' ')
      : `Risk assessment for ${assessment.companyName} has been completed with an overall risk score of ${overallScore} (${overallLevel}).`;

    return {
      assessment: {
        id: assessment.id,
        name: assessment.name,
        companyName: assessment.companyName,
        companyType: assessment.companyType,
        country: assessment.country,
        status: assessment.status as unknown as import('@alliance-risk/shared').AssessmentStatus,
        intakeMode: assessment.intakeMode as unknown as import('@alliance-risk/shared').IntakeMode,
        progress: assessment.progress,
        version: assessment.version,
        overallRiskScore: assessment.overallRiskScore,
        overallRiskLevel: assessment.overallRiskLevel as unknown as import('@alliance-risk/shared').RiskLevel | null,
        updatedAt: assessment.updatedAt.toISOString(),
        createdAt: assessment.createdAt.toISOString(),
      },
      executiveSummary,
      overallScore,
      overallLevel: overallLevel as unknown as import('@alliance-risk/shared').RiskLevel,
      categories: riskScores.map((s) => ({
        id: s.id,
        category: s.category,
        score: s.score,
        level: s.level as unknown as import('@alliance-risk/shared').RiskLevel,
        subcategories: (s.subcategories as unknown as import('@alliance-risk/shared').SubcategoryScore[]) ?? [],
        evidence: s.evidence,
        narrative: s.narrative,
        analystComment: s.analystComment,
        recommendations: s.recommendations.map((r) => ({
          id: r.id,
          text: r.text,
          priority: r.priority as unknown as import('@alliance-risk/shared').RecommendationPriority,
          isEdited: r.isEdited,
          editedText: r.editedText,
        })),
      })),
      radarData,
    };
  }

  async generatePdf(assessmentId: string, userId: string, configDto?: ReportConfigDto): Promise<{ jobId: string }> {
    await this.validateOwnership(assessmentId, userId);
    // Normalize DTO optional fields to ReportConfig defaults
    const reportConfig = configDto ? {
      includeRadarChart: configDto.includeRadarChart ?? true,
      includeCategoryDetails: configDto.includeCategoryDetails ?? true,
      includeSubcategoryCharts: configDto.includeSubcategoryCharts ?? false,
      subcategoryChartType: configDto.subcategoryChartType ?? 'bar' as const,
      includeFinancialCharts: configDto.includeFinancialCharts ?? false,
      includeRecommendations: configDto.includeRecommendations ?? true,
      includeEvidenceTraces: configDto.includeEvidenceTraces ?? false,
      includeMethodology: configDto.includeMethodology ?? true,
      includeCompanyProfile: configDto.includeCompanyProfile ?? true,
      includeRiskHeatmap: configDto.includeRiskHeatmap ?? true,
      includeActionPlan: configDto.includeActionPlan ?? true,
      includeAppendix: configDto.includeAppendix ?? false,
    } : undefined;
    const jobId = await this.jobsService.create(
      JobType.REPORT_GENERATION,
      { assessmentId, reportConfig },
      userId,
    );
    return { jobId };
  }
}
