import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BedrockService } from '../../../infrastructure/bedrock/bedrock.service';
import type { JobHandler } from '../job-handler.interface';
import { BEDROCK_MODELS, AgentSection } from '@alliance-risk/shared';
import { RISK_ANALYSIS_CONFIG } from '../../../domain/risk-analysis/risk-analysis.config';
import type { CategoryDefinition } from '../../../domain/risk-analysis/risk-analysis.config';

interface RiskAnalysisInput {
  assessmentId: string;
  category?: string;
}

interface RiskAnalysisResult {
  assessmentId: string;
  categoriesScored: number;
  overallScore: number;
  bedrockTokensUsed: number;
}

interface ExtractionResult {
  textContent?: string;
  markdownContent?: string;
  tables?: unknown[];
  pages?: number;
  metadata?: Record<string, unknown>;
}

interface RiskAnalysisAICategory {
  category: string;
  score: number;
  level: string;
  narrative: string;
  evidence: string;
  subcategories: Array<{
    name: string;
    indicator: string;
    score: number;
    level: string;
    evidence: string | null;
    mitigation: string | null;
  }>;
  recommendations: Array<{
    text: string;
    priority: string;
  }>;
}

interface RiskAnalysisAIResponse {
  categories: RiskAnalysisAICategory[];
}

@Injectable()
export class RiskAnalysisHandler implements JobHandler {
  private readonly logger = new Logger(RiskAnalysisHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bedrock: BedrockService,
  ) {}

  async execute(input: RiskAnalysisInput): Promise<RiskAnalysisResult> {
    const isSingleCategory = !!input.category;
    this.logger.log(
      isSingleCategory
        ? `Resyncing category ${input.category} for assessment: ${input.assessmentId}`
        : `Running risk analysis for assessment: ${input.assessmentId}`,
    );

    // 1. Verify assessment exists (throws if not found)
    await this.prisma.assessment.findUniqueOrThrow({
      where: { id: input.assessmentId },
    });

    // 2. Fetch all gap fields → build structured business profile
    const gapFields = await this.prisma.gapField.findMany({
      where: { assessmentId: input.assessmentId },
      orderBy: { order: 'asc' },
    });

    const businessData = gapFields
      .map((f) => {
        const value = f.correctedValue || f.extractedValue || 'Not available';
        return `### ${f.label}\n${value}`;
      })
      .join('\n\n');

    // 3. Fetch merged document content (same pattern as gap-detection.handler)
    const documentContent = await this.fetchMergedDocumentContent(input.assessmentId);

    // 4. Fetch interview answers + data entries (if any)
    const interviewAnswers = await this.prisma.interviewAnswer.findMany({
      where: { assessmentId: input.assessmentId },
      orderBy: { step: 'asc' },
    });

    const dataEntries = await this.prisma.dataEntry.findMany({
      where: { assessmentId: input.assessmentId },
    });

    let additionalContext = '';
    if (interviewAnswers.length > 0) {
      additionalContext += '\n\n## Interview Answers\n\n';
      additionalContext += interviewAnswers
        .map((a) => `**${a.question}**\n${a.answer}`)
        .join('\n\n');
    }
    if (dataEntries.length > 0) {
      additionalContext += '\n\n## Additional Data Entries\n\n';
      additionalContext += dataEntries
        .map((d) => `- ${d.field} (${d.category}): ${d.value}${d.unit ? ' ' + d.unit : ''}${d.currency ? ' ' + d.currency : ''}`)
        .join('\n');
    }

    // 5. Fetch active risk_analysis prompt from DB
    const prompt = await this.prisma.prompt.findFirst({
      where: {
        section: 'risk_analysis',
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!prompt) {
      throw new Error('No active risk_analysis prompt found in database. Run seed first.');
    }

    // 6. Determine target categories
    const allCategories = RISK_ANALYSIS_CONFIG.categories as unknown as CategoryDefinition[];
    const targetCategories = isSingleCategory
      ? allCategories.filter((c) => c.category === input.category)
      : allCategories;

    // 6b. Build category definitions for prompt injection
    const categoriesText = targetCategories
      .map((cat) => {
        const subs = cat.subcategories.map((s) => `  - ${s.name}: ${s.indicator}`).join('\n');
        return `${cat.label} (${cat.category}):\n${subs}`;
      })
      .join('\n\n');

    // 7. Inject placeholders into both system and user prompt templates
    const systemPrompt = prompt.systemPrompt
      .replace(/\{\{categories\}\}/g, categoriesText);

    const userPrompt = prompt.userPromptTemplate
      .replace(/\{\{business_data\}\}/g, businessData + additionalContext)
      .replace(/\{\{document_content\}\}/g, documentContent)
      .replace(/\{\{categories\}\}/g, categoriesText);

    // 7b. Update progress only for full runs
    if (!isSingleCategory) {
      await this.prisma.assessment.update({
        where: { id: input.assessmentId },
        data: { progress: 55 },
      });
    }

    // 8. Invoke Bedrock
    let bedrockTokensUsed = 0;
    let parsed: RiskAnalysisAIResponse;

    try {
      const raModel = BEDROCK_MODELS[AgentSection.RISK_ANALYSIS];
      const { output, tokensUsed } = await this.bedrock.invokeModel({
        modelId: raModel.modelId,
        systemPrompt,
        userPrompt,
        temperature: raModel.temperature,
        maxTokens: raModel.maxTokens,
      });

      bedrockTokensUsed = tokensUsed;
      this.logger.log(
        `Bedrock risk analysis complete. Tokens: ${tokensUsed}, Output length: ${output.length} chars`,
      );

      // 8b. Update progress only for full runs
      if (!isSingleCategory) {
        await this.prisma.assessment.update({
          where: { id: input.assessmentId },
          data: { progress: 75 },
        });
      }

      // 9. Parse JSON response (3-strategy defensive parsing)
      parsed = this.parseAIResponse(output);
      this.logger.log(`Parsed ${parsed.categories.length} categories from AI response`);
    } catch (error) {
      this.logger.error(
        `Bedrock invocation or parsing failed for assessment ${input.assessmentId}: ${(error as Error).message}`,
      );
      if (isSingleCategory) {
        throw error; // Don't create fallback for single-category resync
      }
      return this.createFallbackScores(input.assessmentId);
    }

    // 10. Delete existing recommendations for target categories only
    if (isSingleCategory) {
      const targetScore = await this.prisma.riskScore.findUnique({
        where: {
          assessmentId_category: {
            assessmentId: input.assessmentId,
            category: input.category! as import('@prisma/client').$Enums.RiskCategory,
          },
        },
        select: { id: true },
      });
      if (targetScore) {
        await this.prisma.recommendation.deleteMany({
          where: { riskScoreId: targetScore.id },
        });
      }
    } else {
      const existingScores = await this.prisma.riskScore.findMany({
        where: { assessmentId: input.assessmentId },
        select: { id: true },
      });
      if (existingScores.length > 0) {
        await this.prisma.recommendation.deleteMany({
          where: { riskScoreId: { in: existingScores.map((s) => s.id) } },
        });
      }
    }

    // 11. Upsert RiskScore records + create Recommendations for target categories
    const categoryMap = new Map(parsed.categories.map((c) => [c.category, c]));
    let categoriesScored = 0;

    for (const catDef of targetCategories) {
      const aiCat = categoryMap.get(catDef.category);

      const score = this.clampScore(aiCat?.score ?? 50);
      const level = this.scoreToLevel(score);
      categoriesScored++;

      // Build subcategories with defaults for missing ones
      const subcategories = catDef.subcategories.map((subDef) => {
        const aiSub = aiCat?.subcategories?.find(
          (s) => s.name.toLowerCase() === subDef.name.toLowerCase(),
        );
        return {
          name: subDef.name,
          indicator: aiSub?.indicator || subDef.indicator,
          score: this.clampScore(aiSub?.score ?? score),
          level: this.scoreToLevel(aiSub?.score ?? score),
          evidence: aiSub?.evidence ?? null,
          mitigation: aiSub?.mitigation ?? null,
        };
      });

      const riskScore = await this.prisma.riskScore.upsert({
        where: {
          assessmentId_category: {
            assessmentId: input.assessmentId,
            category: catDef.category,
          },
        },
        create: {
          assessmentId: input.assessmentId,
          category: catDef.category,
          score,
          level,
          subcategories,
          evidence: aiCat?.evidence ?? null,
          narrative: aiCat?.narrative ?? null,
        },
        update: {
          score,
          level,
          subcategories,
          evidence: aiCat?.evidence ?? null,
          narrative: aiCat?.narrative ?? null,
        },
      });

      // Create Recommendation records
      const recommendations = aiCat?.recommendations ?? [];
      if (recommendations.length > 0) {
        await this.prisma.recommendation.createMany({
          data: recommendations.map((rec, i) => ({
            riskScoreId: riskScore.id,
            text: rec.text,
            priority: this.normalizeRecommendationPriority(rec.priority),
            order: i,
          })),
        });
      }
    }

    // 12. Compute overall score (always from all 7 categories in DB)
    const allScores = await this.prisma.riskScore.findMany({
      where: { assessmentId: input.assessmentId },
      select: { score: true },
    });
    const totalScore = allScores.reduce((sum, s) => sum + s.score, 0);
    const overallScore = Math.round(totalScore / allScores.length);
    const overallLevel = this.scoreToLevel(overallScore);

    // 13. Update assessment — only set status/progress for full runs
    if (isSingleCategory) {
      await this.prisma.assessment.update({
        where: { id: input.assessmentId },
        data: {
          overallRiskScore: overallScore,
          overallRiskLevel: overallLevel,
        },
      });
    } else {
      await this.prisma.assessment.update({
        where: { id: input.assessmentId },
        data: {
          status: 'COMPLETE',
          progress: 90,
          overallRiskScore: overallScore,
          overallRiskLevel: overallLevel,
        },
      });
    }

    this.logger.log(
      `Risk analysis complete for ${input.assessmentId}. Overall: ${overallScore} (${overallLevel}). Categories: ${categoriesScored}`,
    );

    return {
      assessmentId: input.assessmentId,
      categoriesScored,
      overallScore,
      bedrockTokensUsed,
    };
  }

  // ─── Merged Document Content (same pattern as gap-detection.handler) ─────

  private async fetchMergedDocumentContent(assessmentId: string): Promise<string> {
    const parseJobs = await this.prisma.job.findMany({
      where: {
        type: 'PARSE_DOCUMENT',
        status: 'COMPLETED',
        input: { path: ['assessmentId'], equals: assessmentId },
      },
      orderBy: { completedAt: 'asc' },
    });

    if (parseJobs.length === 0) {
      return '';
    }

    const mergedParts: string[] = [];
    for (const parseJob of parseJobs) {
      const extraction = parseJob.result as ExtractionResult;
      const content = extraction?.markdownContent || extraction?.textContent || '';
      const jobInput = parseJob.input as { fileName?: string };
      if (content) {
        mergedParts.push(`## Document: ${jobInput.fileName ?? 'Unknown'}\n\n${content}`);
      }
    }

    let extractedText = mergedParts.join('\n\n---\n\n');

    if (extractedText.length > RISK_ANALYSIS_CONFIG.maxInputCharacters) {
      this.logger.log(
        `Truncating merged text from ${extractedText.length} to ${RISK_ANALYSIS_CONFIG.maxInputCharacters} chars`,
      );
      extractedText = extractedText.substring(0, RISK_ANALYSIS_CONFIG.maxInputCharacters);
    }

    return extractedText;
  }

  // ─── JSON Parsing (4-Strategy Defensive) ─────────────────────────────────

  private tryParseRiskResponse(text: string): RiskAnalysisAIResponse | null {
    try {
      const parsed = JSON.parse(text) as RiskAnalysisAIResponse;
      if (parsed.categories && Array.isArray(parsed.categories)) return parsed;
    } catch {
      // Not valid JSON
    }
    return null;
  }

  private stripMarkdownFences(output: string): string {
    return output
      .replace(/^```(?:json)?\s*\n?/gm, '')
      .replace(/\n?```\s*$/gm, '')
      .trim();
  }

  private countUnclosedDelimiters(text: string): { braces: number; brackets: number } {
    let braces = 0;
    let brackets = 0;
    let inString = false;
    let escape = false;
    for (const ch of text) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;
    }
    return { braces, brackets };
  }

  private repairTruncatedJson(jsonText: string): RiskAnalysisAIResponse | null {
    let { braces, brackets } = this.countUnclosedDelimiters(jsonText);
    if (braces <= 0 && brackets <= 0) return null;

    this.logger.warn(
      `Attempting to repair truncated JSON (${braces} unclosed braces, ${brackets} unclosed brackets)`,
    );

    let repaired = jsonText.replace(/,\s*"[^"]*"?\s*:?\s*[^,\]}]*$/, '');
    while (brackets > 0) { repaired += ']'; brackets--; }
    while (braces > 0) { repaired += '}'; braces--; }

    const result = this.tryParseRiskResponse(repaired);
    if (result) {
      this.logger.warn(`Repaired truncated JSON — got ${result.categories.length} categories`);
    }
    return result;
  }

  private parseAIResponse(output: string): RiskAnalysisAIResponse {
    // Strategy 1: Direct JSON.parse
    const direct = this.tryParseRiskResponse(output);
    if (direct) return direct;

    // Strategy 2: Strip markdown code fences
    const stripped = this.tryParseRiskResponse(this.stripMarkdownFences(output));
    if (stripped) return stripped;

    // Strategy 3: Extract first { ... } JSON block (string-based, no regex)
    const firstBrace = output.indexOf('{');
    const lastBrace = output.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonBlock = output.substring(firstBrace, lastBrace + 1);
      const extracted = this.tryParseRiskResponse(jsonBlock);
      if (extracted) return extracted;

      // Strategy 4: Repair truncated JSON
      const repaired = this.repairTruncatedJson(jsonBlock);
      if (repaired) return repaired;
    }

    this.logger.error(
      `All JSON parse strategies failed. Output length: ${output.length}, ` +
      `starts with: ${JSON.stringify(output.substring(0, 100))}, ` +
      `ends with: ${JSON.stringify(output.substring(output.length - 100))}`,
    );
    throw new Error(`Failed to parse Bedrock risk analysis response as JSON. Output preview: ${output.substring(0, 200)}`);
  }

  // ─── Fallback Scores (Bedrock failure) ───────────────────────────────────

  private async createFallbackScores(assessmentId: string): Promise<RiskAnalysisResult> {
    this.logger.warn(`Creating fallback risk scores for assessment ${assessmentId}`);

    // Delete existing recommendations for idempotency
    const existingScores = await this.prisma.riskScore.findMany({
      where: { assessmentId },
      select: { id: true },
    });
    if (existingScores.length > 0) {
      await this.prisma.recommendation.deleteMany({
        where: { riskScoreId: { in: existingScores.map((s) => s.id) } },
      });
    }

    let totalScore = 0;

    for (const catDef of RISK_ANALYSIS_CONFIG.categories as unknown as CategoryDefinition[]) {
      const score = 50;
      totalScore += score;

      const subcategories = catDef.subcategories.map((subDef) => ({
        name: subDef.name,
        indicator: subDef.indicator,
        score: 50,
        level: 'MODERATE' as const,
        evidence: null,
        mitigation: null,
      }));

      const riskScore = await this.prisma.riskScore.upsert({
        where: {
          assessmentId_category: {
            assessmentId,
            category: catDef.category,
          },
        },
        create: {
          assessmentId,
          category: catDef.category,
          score,
          level: 'MODERATE',
          subcategories,
          evidence: null,
          narrative: 'Analysis failed — manual review required. The AI risk analysis could not be completed. Please review the data and re-run the analysis.',
        },
        update: {
          score,
          level: 'MODERATE',
          subcategories,
          evidence: null,
          narrative: 'Analysis failed — manual review required. The AI risk analysis could not be completed. Please review the data and re-run the analysis.',
        },
      });

      await this.prisma.recommendation.create({
        data: {
          riskScoreId: riskScore.id,
          text: 'Manual review required — automated analysis was unable to complete. Please review the business data and consider re-running the analysis.',
          priority: 'HIGH',
          order: 0,
        },
      });
    }

    const overallScore = Math.round(totalScore / 7);

    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: 'COMPLETE',
        progress: 90,
        overallRiskScore: overallScore,
        overallRiskLevel: 'MODERATE',
      },
    });

    return {
      assessmentId,
      categoriesScored: 7,
      overallScore,
      bedrockTokensUsed: 0,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private clampScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private scoreToLevel(score: number): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    if (score <= 30) return 'LOW';
    if (score <= 60) return 'MODERATE';
    if (score <= 80) return 'HIGH';
    return 'CRITICAL';
  }

  private normalizeRecommendationPriority(priority: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    const upper = priority?.toUpperCase() ?? 'MEDIUM';
    if (upper === 'HIGH') return 'HIGH';
    if (upper === 'LOW') return 'LOW';
    return 'MEDIUM';
  }
}
