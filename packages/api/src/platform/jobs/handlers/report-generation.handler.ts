import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BedrockService } from '../../../infrastructure/bedrock/bedrock.service';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { PdfService } from '../../../domain/report/pdf.service';
import type { JobHandler } from '../job-handler.interface';
import { BEDROCK_MODELS, AgentSection } from '@alliance-risk/shared';
import type { ReportResponse } from '@alliance-risk/shared';

interface ReportGenerationInput {
  assessmentId: string;
}

interface ReportGenerationResult {
  assessmentId: string;
  pdfKey: string;
  downloadUrl: string;
  bedrockTokensUsed: number;
}

interface ReportAIResponse {
  executiveSummary: string;
  strengths: string[];
  weaknesses: string[];
  keyFindings: string[];
}

@Injectable()
export class ReportGenerationHandler implements JobHandler {
  private readonly logger = new Logger(ReportGenerationHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bedrock: BedrockService,
    private readonly storageService: StorageService,
    private readonly pdfService: PdfService,
  ) {}

  async execute(input: ReportGenerationInput): Promise<ReportGenerationResult> {
    this.logger.log(`Generating report for assessment: ${input.assessmentId}`);

    // 1. Fetch assessment + all RiskScore records with recommendations
    const assessment = await this.prisma.assessment.findUniqueOrThrow({
      where: { id: input.assessmentId },
    });

    const riskScores = await this.prisma.riskScore.findMany({
      where: { assessmentId: input.assessmentId },
      include: { recommendations: { orderBy: { order: 'asc' } } },
      orderBy: { category: 'asc' },
    });

    if (riskScores.length === 0) {
      throw new Error(`No risk scores found for assessment ${input.assessmentId}. Run risk analysis first.`);
    }

    // 2. Fetch active report_generation prompt from DB
    const prompt = await this.prisma.prompt.findFirst({
      where: {
        section: 'report_generation',
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!prompt) {
      throw new Error('No active report_generation prompt found in database. Run seed first.');
    }

    // 3. Build prompt with all scores, narratives, recommendations
    const riskResultsText = riskScores
      .map((s) => {
        const recs = s.recommendations
          .map((r) => `  - [${r.priority}] ${r.isEdited ? r.editedText : r.text}`)
          .join('\n');
        return [
          `### ${s.category} — Score: ${s.score}/100 (${s.level})`,
          s.narrative ? `Narrative: ${s.narrative}` : '',
          s.evidence ? `Evidence: ${s.evidence}` : '',
          recs ? `Recommendations:\n${recs}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');

    const overallScore = assessment.overallRiskScore ?? 0;
    const overallLevel = assessment.overallRiskLevel ?? 'MODERATE';

    const contextHeader = [
      `Business Name: ${assessment.companyName}`,
      assessment.companyType ? `Business Type: ${assessment.companyType}` : '',
      `Country: ${assessment.country}`,
      `Overall Risk Score: ${overallScore}/100 (${overallLevel})`,
    ]
      .filter(Boolean)
      .join('\n');

    const userPrompt = prompt.userPromptTemplate
      .replace(/\{\{risk_results\}\}/g, `${contextHeader}\n\n${riskResultsText}`);

    // 4. Invoke Bedrock for executive summary + strengths/weaknesses
    let bedrockTokensUsed = 0;
    let reportAI: ReportAIResponse;

    try {
      const rgModel = BEDROCK_MODELS[AgentSection.REPORT_GENERATION];
      const { output, tokensUsed } = await this.bedrock.invokeModel({
        modelId: rgModel.modelId,
        systemPrompt: prompt.systemPrompt,
        userPrompt,
        temperature: rgModel.temperature,
        maxTokens: rgModel.maxTokens,
      });

      bedrockTokensUsed = tokensUsed;
      this.logger.log(`Bedrock report generation complete. Tokens: ${tokensUsed}`);

      reportAI = this.parseAIResponse(output);
    } catch (error) {
      this.logger.error(
        `Bedrock report generation failed for assessment ${input.assessmentId}: ${(error as Error).message}`,
      );
      // Fallback executive summary
      reportAI = {
        executiveSummary: `Risk assessment for ${assessment.companyName} has been completed with an overall risk score of ${overallScore} (${overallLevel}). This report requires manual review as the automated summary generation was unable to complete.`,
        strengths: ['Assessment data has been collected and analyzed'],
        weaknesses: ['Automated summary generation was not available'],
        keyFindings: [`Overall risk level: ${overallLevel}`],
      };
    }

    // 5. Build ReportResponse for PDF generation
    const reportData: ReportResponse = {
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
      executiveSummary: reportAI.executiveSummary,
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
        recommendations: s.recommendations.map((r) => ({
          id: r.id,
          text: r.text,
          priority: r.priority as unknown as import('@alliance-risk/shared').RecommendationPriority,
          isEdited: r.isEdited,
          editedText: r.editedText,
        })),
      })),
      radarData: riskScores.map((s) => ({
        category: s.category,
        score: s.score,
      })),
    };

    // 6. Generate PDF
    const pdfBuffer = await this.pdfService.generate(reportData, {
      strengths: reportAI.strengths,
      weaknesses: reportAI.weaknesses,
      keyFindings: reportAI.keyFindings,
    });

    // 7. Upload PDF to S3
    const reportId = `report-${crypto.randomUUID()}`;
    const pdfKey = this.storageService.buildReportKey(input.assessmentId, reportId);
    await this.storageService.uploadBuffer(pdfKey, pdfBuffer, 'application/pdf');

    // 8. Generate presigned download URL
    const downloadUrl = await this.storageService.generatePresignedDownloadUrl(pdfKey);

    // 9. Update assessment progress
    await this.prisma.assessment.update({
      where: { id: input.assessmentId },
      data: { progress: 100 },
    });

    this.logger.log(`Report generated and uploaded: ${pdfKey}`);

    return {
      assessmentId: input.assessmentId,
      pdfKey,
      downloadUrl,
      bedrockTokensUsed,
    };
  }

  // ─── JSON Parsing (3-Strategy Defensive) ─────────────────────────────────

  private parseAIResponse(output: string): ReportAIResponse {
    // Strategy 1: Direct JSON.parse
    try {
      const parsed = JSON.parse(output) as ReportAIResponse;
      if (parsed.executiveSummary) return this.normalizeReportResponse(parsed);
    } catch {
      // Fall through
    }

    // Strategy 2: Strip markdown code fences
    try {
      const stripped = output
        .replace(/^```(?:json)?\s*\n?/m, '')
        .replace(/\n?```\s*$/m, '');
      const parsed = JSON.parse(stripped) as ReportAIResponse;
      if (parsed.executiveSummary) return this.normalizeReportResponse(parsed);
    } catch {
      // Fall through
    }

    // Strategy 3: Extract first { ... } JSON block (string-based, no regex)
    const firstBrace = output.indexOf('{');
    const lastBrace = output.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(output.substring(firstBrace, lastBrace + 1)) as ReportAIResponse;
        if (parsed.executiveSummary) return this.normalizeReportResponse(parsed);
      } catch {
        // Fall through
      }
    }

    throw new Error(`Failed to parse report generation response. Output preview: ${output.substring(0, 200)}`);
  }

  private normalizeReportResponse(parsed: ReportAIResponse): ReportAIResponse {
    return {
      executiveSummary: parsed.executiveSummary || '',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
    };
  }
}
