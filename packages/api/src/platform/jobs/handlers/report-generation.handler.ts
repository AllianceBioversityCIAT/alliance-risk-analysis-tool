import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BedrockService } from '../../../infrastructure/bedrock/bedrock.service';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { PdfService } from '../../../domain/report/pdf.service';
import type { JobHandler } from '../job-handler.interface';
import { BEDROCK_MODELS, AgentSection } from '@alliance-risk/shared';
import type {
  ReportResponse,
  ReportConfig,
  FinancialMetrics,
  ActionPlanItem,
  ActionPlanTimeframe,
  DocumentSource,
  GapSummaryItem,
  ReportGenerationStage,
  ReportGenerationProgress,
} from '@alliance-risk/shared';
import {
  injectCountry,
  warnIfHardcodedKenyaWithoutPlaceholder,
} from '../../prompts/variable-injection.service';

interface ReportGenerationInput {
  assessmentId: string;
  reportConfig?: ReportConfig;
}

interface ReportGenerationContext {
  jobId?: string;
}

interface StageDefinition {
  stage: ReportGenerationStage;
  label: string;
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

interface ActionPlanAssignmentResponse {
  assignments: Array<{
    index: number;
    timeframe: ActionPlanTimeframe;
  }>;
}

interface RecommendationForActionPlan {
  category: string;
  priority: string;
  text: string;
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

  async execute(
    input: ReportGenerationInput,
    context: ReportGenerationContext = {},
  ): Promise<ReportGenerationResult> {
    this.logger.log(`Generating report for assessment: ${input.assessmentId}`);

    // Compute the ordered list of stages this run will execute so the client
    // sees a coherent "Step N of M" counter that matches reality (e.g. skips
    // financial extraction when financial charts are disabled).
    const stages = this.buildStageTimeline(input.reportConfig);
    await this.reportStage(context.jobId, stages, 'LOADING_DATA');

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

    warnIfHardcodedKenyaWithoutPlaceholder(
      this.logger,
      assessment.country,
      prompt.systemPrompt,
      prompt.userPromptTemplate,
    );

    const systemPrompt = injectCountry(prompt.systemPrompt, assessment.country);

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

    const userPrompt = injectCountry(
      prompt.userPromptTemplate.replace(
        /\{\{risk_results\}\}/g,
        `${contextHeader}\n\n${riskResultsText}`,
      ),
      assessment.country,
    );

    // 4. Invoke Bedrock for executive summary + strengths/weaknesses
    await this.reportStage(context.jobId, stages, 'GENERATING_SUMMARY');
    let bedrockTokensUsed = 0;
    let reportAI: ReportAIResponse;

    try {
      const rgModel = BEDROCK_MODELS[AgentSection.REPORT_GENERATION];
      const { output, tokensUsed } = await this.bedrock.invokeModel({
        modelId: rgModel.modelId,
        systemPrompt,
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

    // 5. Extract financial metrics if requested
    let financialMetrics: FinancialMetrics | undefined;
    if (input.reportConfig?.includeFinancialCharts) {
      await this.reportStage(context.jobId, stages, 'EXTRACTING_FINANCIAL');
      financialMetrics = await this.extractFinancialMetrics(input.assessmentId, assessment.country);
      if (financialMetrics) {
        bedrockTokensUsed += 500; // approximate tokens for financial extraction
      }
    }

    // 6. Assign action plan timeframes when requested
    let actionPlanItems: ActionPlanItem[] | undefined;
    if (input.reportConfig?.includeActionPlan) {
      await this.reportStage(context.jobId, stages, 'PLANNING_ACTIONS');
      const recommendations = riskScores.flatMap((score) =>
        score.recommendations.map((recommendation) => ({
          category: score.category,
          priority: recommendation.priority,
          text: recommendation.isEdited && recommendation.editedText ? recommendation.editedText : recommendation.text,
        })),
      );

      actionPlanItems = recommendations.length > 0
        ? await this.assignActionPlanTimeframes(recommendations)
        : undefined;
    }

    // 7. Fetch appendix data when requested
    let documentSources: DocumentSource[] | undefined;
    let gapSummary: GapSummaryItem[] | undefined;
    if (input.reportConfig?.includeAppendix) {
      await this.reportStage(context.jobId, stages, 'FETCHING_APPENDIX');
      const [fetchedDocumentSources, fetchedGapSummary] = await Promise.all([
        this.fetchDocumentSources(input.assessmentId),
        this.fetchGapSummary(input.assessmentId),
      ]);
      documentSources = fetchedDocumentSources.length > 0 ? fetchedDocumentSources : undefined;
      gapSummary = fetchedGapSummary.length > 0 ? fetchedGapSummary : undefined;
    }

    // 8. Build ReportResponse for PDF generation
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
        analystComment: s.analystComment,
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
      financialMetrics,
      actionPlanItems,
      documentSources,
      gapSummary,
      reportConfig: input.reportConfig,
    };

    // 9. Generate PDF
    await this.reportStage(context.jobId, stages, 'RENDERING_PDF');
    const pdfBuffer = await this.pdfService.generate(reportData, {
      strengths: reportAI.strengths,
      weaknesses: reportAI.weaknesses,
      keyFindings: reportAI.keyFindings,
    }, input.reportConfig);

    // 10. Upload PDF to S3
    await this.reportStage(context.jobId, stages, 'UPLOADING');
    const reportId = `report-${crypto.randomUUID()}`;
    const pdfKey = this.storageService.buildReportKey(input.assessmentId, reportId);
    await this.storageService.uploadBuffer(pdfKey, pdfBuffer, 'application/pdf');

    // 11. Generate presigned download URL
    const downloadUrl = await this.storageService.generatePresignedDownloadUrl(pdfKey);

    // 12. Update assessment progress
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

  private async fetchDocumentSources(assessmentId: string): Promise<DocumentSource[]> {
    const documents = await this.prisma.assessmentDocument.findMany({
      where: { assessmentId },
      orderBy: { uploadedAt: 'asc' },
    });

    return documents.map((document) => ({
      fileName: document.fileName,
      fileType: document.mimeType,
      extractedLength: document.fileSize,
    }));
  }

  private async fetchGapSummary(assessmentId: string): Promise<GapSummaryItem[]> {
    const gapFields = await this.prisma.gapField.findMany({
      where: { assessmentId },
      orderBy: [
        { category: 'asc' },
        { order: 'asc' },
      ],
    });

    return gapFields.map((field) => ({
      fieldKey: field.field,
      status: field.status,
      detectedValue: field.extractedValue,
      correctedValue: field.correctedValue,
    }));
  }

  private async assignActionPlanTimeframes(
    recommendations: RecommendationForActionPlan[],
  ): Promise<ActionPlanItem[]> {
    if (recommendations.length === 0) {
      return [];
    }

    try {
      const rgModel = BEDROCK_MODELS[AgentSection.REPORT_GENERATION];
      const promptLines = recommendations.map((recommendation, index) => (
        `${index}. [${recommendation.priority}] ${recommendation.category}: ${recommendation.text}`
      ));
      const { output } = await this.bedrock.invokeModel({
        modelId: rgModel.modelId,
        systemPrompt: 'You assign implementation timeframes to risk recommendations. Return ONLY valid JSON.',
        userPrompt: `Given these recommendations from a risk assessment, assign each one an implementation timeframe: IMMEDIATE (0-3 months), SHORT_TERM (3-6 months), or MEDIUM_TERM (6-12 months).

Consider urgency based on priority, implementation complexity, dependencies between recommendations, and typical agricultural business cycles.

Return JSON in this exact shape:
{
  "assignments": [{"index": 0, "timeframe": "IMMEDIATE"}]
}

Recommendations:
${promptLines.join('\n')}`,
        temperature: 0.1,
        maxTokens: 1000,
      });

      const parsed = this.parseActionPlanAssignments(output);
      const assignments = new Map<number, ActionPlanTimeframe>();
      parsed.assignments.forEach((assignment) => {
        assignments.set(assignment.index, assignment.timeframe);
      });

      return recommendations.map((recommendation, index) => ({
        ...recommendation,
        timeframe: assignments.get(index) ?? this.getFallbackTimeframe(recommendation.priority),
      }));
    } catch (error) {
      this.logger.warn(`Action plan timeframe assignment failed, falling back to priority mapping: ${(error as Error).message}`);
      return recommendations.map((recommendation) => ({
        ...recommendation,
        timeframe: this.getFallbackTimeframe(recommendation.priority),
      }));
    }
  }

  // ─── Financial Metrics Extraction ────────────────────────────────────────

  private async extractFinancialMetrics(
    assessmentId: string,
    country: string,
  ): Promise<FinancialMetrics | undefined> {
    try {
      // Fetch merged document content from completed parse jobs
      const parseJobs = await this.prisma.job.findMany({
        where: {
          type: 'PARSE_DOCUMENT',
          status: 'COMPLETED',
          input: { path: ['assessmentId'], equals: assessmentId },
        },
        orderBy: { completedAt: 'asc' },
      });

      if (parseJobs.length === 0) return undefined;

      const mergedContent = parseJobs
        .map((job) => {
          const extraction = job.result as { markdownContent?: string; textContent?: string } | null;
          const jobInput = job.input as { fileName?: string };
          const content = extraction?.markdownContent || extraction?.textContent || '';
          return content ? `--- ${jobInput?.fileName ?? 'Unknown'} ---\n${content}` : '';
        })
        .filter(Boolean)
        .join('\n\n')
        .substring(0, 50000);

      const rgModel = BEDROCK_MODELS[AgentSection.REPORT_GENERATION];
      const { output } = await this.bedrock.invokeModel({
        modelId: rgModel.modelId,
        systemPrompt: 'You are a financial data extraction specialist. Extract structured financial metrics from documents. Return ONLY valid JSON.',
        userPrompt: `Extract financial metrics for an agricultural business operating in ${country}. Return a JSON object with this exact structure:
{
  "revenue": [{"year": 2024, "amount": 1000000, "currency": "USD"}],
  "costs": [{"category": "Operations", "amount": 500000}],
  "margins": {"gross": 0.45, "operating": 0.20}
}

If no financial data is found, return: {"revenue": [], "costs": [], "margins": {"gross": null, "operating": null}}

Documents:
${mergedContent}`,
        temperature: 0.1,
        maxTokens: 2000,
      });

      return this.parseFinancialMetrics(output);
    } catch (error) {
      this.logger.warn(`Financial metrics extraction failed: ${(error as Error).message}`);
      return undefined;
    }
  }

  private parseFinancialMetrics(output: string): FinancialMetrics | undefined {
    // 3-strategy defensive JSON parsing
    const strategies = [
      () => JSON.parse(output),
      () => JSON.parse(output.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '')),
      () => {
        const first = output.indexOf('{');
        const last = output.lastIndexOf('}');
        if (first !== -1 && last > first) return JSON.parse(output.substring(first, last + 1));
        throw new Error('No JSON block found');
      },
    ];

    for (const strategy of strategies) {
      try {
        const parsed = strategy();
        return {
          revenue: Array.isArray(parsed.revenue) ? parsed.revenue : [],
          costs: Array.isArray(parsed.costs) ? parsed.costs : [],
          margins: {
            gross: parsed.margins?.gross ?? null,
            operating: parsed.margins?.operating ?? null,
          },
        };
      } catch {
        // Fall through to next strategy
      }
    }

    this.logger.warn(`Failed to parse financial metrics. Output: ${output.substring(0, 200)}`);
    return undefined;
  }

  private parseActionPlanAssignments(output: string): ActionPlanAssignmentResponse {
    const strategies = [
      () => JSON.parse(output),
      () => JSON.parse(output.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '')),
      () => {
        const first = output.indexOf('{');
        const last = output.lastIndexOf('}');
        if (first !== -1 && last > first) return JSON.parse(output.substring(first, last + 1));
        throw new Error('No JSON block found');
      },
    ];

    for (const strategy of strategies) {
      try {
        const parsed = strategy() as ActionPlanAssignmentResponse;
        const assignments = Array.isArray(parsed.assignments)
          ? parsed.assignments.filter((assignment) => (
            Number.isInteger(assignment?.index)
            && this.isActionPlanTimeframe(assignment?.timeframe)
          ))
          : [];

        if (assignments.length > 0) {
          return { assignments };
        }
      } catch {
        // Fall through to next strategy
      }
    }

    throw new Error(`Failed to parse action plan assignments. Output preview: ${output.substring(0, 200)}`);
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

  private getFallbackTimeframe(priority: string): ActionPlanTimeframe {
    switch (priority) {
      case 'HIGH':
        return 'IMMEDIATE';
      case 'MEDIUM':
        return 'SHORT_TERM';
      default:
        return 'MEDIUM_TERM';
    }
  }

  private isActionPlanTimeframe(value: unknown): value is ActionPlanTimeframe {
    return value === 'IMMEDIATE' || value === 'SHORT_TERM' || value === 'MEDIUM_TERM';
  }

  // ─── Progress Reporting ──────────────────────────────────────────────────

  private buildStageTimeline(cfg?: ReportConfig): StageDefinition[] {
    const stages: StageDefinition[] = [
      { stage: 'LOADING_DATA', label: 'Loading assessment data' },
      { stage: 'GENERATING_SUMMARY', label: 'Generating executive summary' },
    ];
    if (cfg?.includeFinancialCharts) {
      stages.push({ stage: 'EXTRACTING_FINANCIAL', label: 'Extracting financial metrics' });
    }
    if (cfg?.includeActionPlan) {
      stages.push({ stage: 'PLANNING_ACTIONS', label: 'Planning action timeline' });
    }
    if (cfg?.includeAppendix) {
      stages.push({ stage: 'FETCHING_APPENDIX', label: 'Compiling appendix data' });
    }
    stages.push(
      { stage: 'RENDERING_PDF', label: 'Rendering PDF document' },
      { stage: 'UPLOADING', label: 'Uploading report' },
    );
    return stages;
  }

  private async reportStage(
    jobId: string | undefined,
    stages: StageDefinition[],
    stage: ReportGenerationStage,
  ): Promise<void> {
    if (!jobId) return;

    const index = stages.findIndex((entry) => entry.stage === stage);
    if (index === -1) return;

    const definition = stages[index];
    const progress: ReportGenerationProgress = {
      stage: definition.stage,
      stageLabel: definition.label,
      stageIndex: index + 1,
      stageTotal: stages.length,
      updatedAt: new Date().toISOString(),
    };

    try {
      await this.prisma.job.update({
        where: { id: jobId },
        data: { result: progress as unknown as object },
      });
    } catch (error) {
      // Progress updates are best-effort — never fail the job over a stage write.
      this.logger.warn(
        `Failed to write report generation stage "${stage}" for job ${jobId}: ${(error as Error).message}`,
      );
    }
  }
}
