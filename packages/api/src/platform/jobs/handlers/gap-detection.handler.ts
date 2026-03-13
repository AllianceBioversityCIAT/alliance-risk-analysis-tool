import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BedrockService } from '../../../infrastructure/bedrock/bedrock.service';
import type { JobHandler } from '../job-handler.interface';
import { BEDROCK_MODELS, AgentSection } from '@alliance-risk/shared';
import { GAP_DETECTION_CONFIG } from '../../../domain/gap-detection/gap-detection.config';
import type { Core10FieldDefinition } from '../../../domain/gap-detection/gap-detection.config';

interface GapDetectionInput {
  assessmentId: string;
  reAnalyze?: boolean;
}

interface GapDetectionResult {
  assessmentId: string;
  gapFieldsCreated: number;
  bedrockTokensUsed: number;
  /** Compiled Markdown from all parsed documents — stored for frontend viewer */
  mergedMarkdown: string;
}

interface ExtractionResult {
  textContent?: string;
  markdownContent?: string;
  tables?: unknown[];
  pages?: number;
  metadata?: Record<string, unknown>;
}

interface GapDetectionAIField {
  field: string;
  status: 'VERIFIED' | 'PARTIAL' | 'MISSING';
  extractedValue: string | null;
  confidence: number;
  reasoning: string;
}

interface GapDetectionAIResponse {
  fields: GapDetectionAIField[];
}

@Injectable()
export class GapDetectionHandler implements JobHandler {
  private readonly logger = new Logger(GapDetectionHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bedrock: BedrockService,
  ) {}

  async execute(input: GapDetectionInput): Promise<GapDetectionResult> {
    const isReAnalyze = !!input.reAnalyze;
    this.logger.log(`Running gap detection for assessment: ${input.assessmentId} (reAnalyze: ${isReAnalyze})`);

    const assessment = await this.prisma.assessment.findUniqueOrThrow({
      where: { id: input.assessmentId },
    });

    if (!isReAnalyze) {
      // Delete existing gap fields (idempotent delete-then-create)
      await this.prisma.gapField.deleteMany({
        where: { assessmentId: input.assessmentId },
      });
    }

    let bedrockTokensUsed = 0;
    let mergedMarkdown = '';

    if (assessment.intakeMode === 'UPLOAD') {
      const result = await this.processUploadMode(input.assessmentId, isReAnalyze);
      bedrockTokensUsed = result.tokensUsed;
      mergedMarkdown = result.mergedMarkdown;
    } else {
      // GUIDED_INTERVIEW or MANUAL_ENTRY: create skeleton fields without Bedrock
      if (!isReAnalyze) {
        await this.createSkeletonFields(input.assessmentId);
      }
    }

    // Update assessment status to ACTION_REQUIRED, progress = 50
    await this.prisma.assessment.update({
      where: { id: input.assessmentId },
      data: { status: 'ACTION_REQUIRED', progress: 50 },
    });

    this.logger.log(
      `Gap detection complete for ${input.assessmentId}. Fields: ${GAP_DETECTION_CONFIG.core10Fields.length}, Tokens: ${bedrockTokensUsed}`,
    );

    return {
      assessmentId: input.assessmentId,
      gapFieldsCreated: GAP_DETECTION_CONFIG.core10Fields.length,
      bedrockTokensUsed,
      mergedMarkdown,
    };
  }

  // ─── Upload Mode ─────────────────────────────────────────────────────────────

  private async processUploadMode(assessmentId: string, isReAnalyze = false): Promise<{ tokensUsed: number; mergedMarkdown: string }> {
    // 1. Fetch ALL completed PARSE_DOCUMENT jobs for this assessment
    const parseJobs = await this.prisma.job.findMany({
      where: {
        type: 'PARSE_DOCUMENT',
        status: 'COMPLETED',
        input: { path: ['assessmentId'], equals: assessmentId },
      },
      orderBy: { completedAt: 'asc' },
    });

    if (parseJobs.length === 0) {
      this.logger.warn(`No completed PARSE_DOCUMENT jobs found for assessment ${assessmentId}. Creating skeleton fields.`);
      await this.createSkeletonFields(assessmentId);
      return { tokensUsed: 0, mergedMarkdown: '' };
    }

    // 2. Merge all markdownContent with document separators
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

    this.logger.log(
      `Merged ${parseJobs.length} document(s) for assessment ${assessmentId}. Total chars: ${extractedText.length}`,
    );

    // 3. Truncate to maxInputCharacters (generous with Sonnet 4.6's 1M token window)
    if (extractedText.length > GAP_DETECTION_CONFIG.maxInputCharacters) {
      this.logger.log(
        `Truncating merged text from ${extractedText.length} to ${GAP_DETECTION_CONFIG.maxInputCharacters} chars`,
      );
      extractedText = extractedText.substring(0, GAP_DETECTION_CONFIG.maxInputCharacters);
    }

    // 3. Retrieve active gap_detector prompt directly from DB
    //    (PromptsModule imports JobsModule creating a circular dependency, so we query Prisma directly)
    const prompt = await this.prisma.prompt.findFirst({
      where: {
        section: 'gap_detector',
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!prompt) {
      throw new Error('No active gap_detector prompt found in database. Run seed first.');
    }

    // 4. Inject extracted data into user prompt template
    let userPrompt = prompt.userPromptTemplate.replace(
      /\{\{extracted_data\}\}/g,
      extractedText,
    );

    // 4b. In re-analyze mode, fetch existing corrections and append to prompt
    if (isReAnalyze) {
      const existingFields = await this.prisma.gapField.findMany({
        where: { assessmentId },
      });
      const corrections = existingFields
        .filter((f) => f.correctedValue)
        .map((f) => `- ${f.field}: "${f.correctedValue}"`)
        .join('\n');
      if (corrections) {
        userPrompt += `\n\nUSER-PROVIDED CORRECTIONS (treat as ground truth, do not override):\n${corrections}`;
      }
    }

    // 5. Invoke Bedrock with IGAD-pattern config
    try {
      const startedAt = Date.now();

      const gapModel = BEDROCK_MODELS[AgentSection.GAP_DETECTOR];
      const { output, tokensUsed } = await this.bedrock.invokeModel({
        modelId: gapModel.modelId,
        systemPrompt: prompt.systemPrompt,
        userPrompt,
        temperature: gapModel.temperature,
        maxTokens: gapModel.maxTokens,
      });

      const elapsed = Date.now() - startedAt;
      this.logger.log(
        `Bedrock gap detection complete. Tokens: ${tokensUsed}, Time: ${elapsed}ms`,
      );

      // 6. Parse JSON response using 3-strategy defensive parsing
      const parsed = this.parseAIResponse(output);

      // 7. Create or update Core 10 GapField records from AI response
      if (isReAnalyze) {
        await this.updateFieldsFromAIResponse(assessmentId, parsed);
      } else {
        await this.createFieldsFromAIResponse(assessmentId, parsed);
      }

      return { tokensUsed, mergedMarkdown: extractedText };
    } catch (error) {
      // On Bedrock failure: create all-MISSING fields with error reasoning
      this.logger.error(
        `Bedrock invocation failed for assessment ${assessmentId}: ${(error as Error).message}`,
      );
      if (!isReAnalyze) {
        await this.createErrorFields(assessmentId, error);
      } else {
        // In re-analyze mode, log the error on existing fields so the user knows
        this.logger.warn(`Re-analyze Bedrock failure for ${assessmentId} — existing fields preserved with no update`);
      }
      return { tokensUsed: 0, mergedMarkdown: extractedText };
    }
  }

  // ─── JSON Parsing (3-Strategy Defensive) ─────────────────────────────────────

  private parseAIResponse(output: string): GapDetectionAIResponse {
    // Strategy 1: Direct JSON.parse
    try {
      const parsed = JSON.parse(output) as GapDetectionAIResponse;
      if (parsed.fields && Array.isArray(parsed.fields)) return parsed;
    } catch {
      // Fall through to next strategy
    }

    // Strategy 2: Strip markdown code fences (```json ... ```)
    try {
      const stripped = output
        .replace(/^```(?:json)?\s*\n?/m, '')
        .replace(/\n?```\s*$/m, '');
      const parsed = JSON.parse(stripped) as GapDetectionAIResponse;
      if (parsed.fields && Array.isArray(parsed.fields)) return parsed;
    } catch {
      // Fall through to next strategy
    }

    // Strategy 3: Extract first { ... } JSON block (string-based, no regex)
    const firstBrace = output.indexOf('{');
    const lastBrace = output.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(output.substring(firstBrace, lastBrace + 1)) as GapDetectionAIResponse;
        if (parsed.fields && Array.isArray(parsed.fields)) return parsed;
      } catch {
        // Fall through
      }
    }

    throw new Error(`Failed to parse Bedrock response as JSON. Output preview: ${output.substring(0, 200)}`);
  }

  // ─── Field Creation Helpers ───────────────────────────────────────────────────

  private async createFieldsFromAIResponse(
    assessmentId: string,
    response: GapDetectionAIResponse,
  ): Promise<void> {
    const responseMap = new Map(response.fields.map((f) => [f.field, f]));

    const data = (GAP_DETECTION_CONFIG.core10Fields as unknown as Core10FieldDefinition[]).map((def) => {
      const aiField = responseMap.get(def.field);
      return {
        assessmentId,
        category: def.category,
        field: def.field,
        label: def.label,
        extractedValue: aiField?.extractedValue ?? null,
        status: (aiField?.status ?? 'MISSING') as 'VERIFIED' | 'PARTIAL' | 'MISSING',
        confidence: aiField?.confidence ?? 0,
        aiReasoning: aiField?.reasoning ?? null,
        isMandatory: true,
        order: def.order,
      };
    });

    await this.prisma.gapField.createMany({ data });
    this.logger.log(`Created ${data.length} Core 10 gap fields from AI response for assessment ${assessmentId}`);
  }

  private async updateFieldsFromAIResponse(
    assessmentId: string,
    response: GapDetectionAIResponse,
  ): Promise<void> {
    const existingFields = await this.prisma.gapField.findMany({
      where: { assessmentId },
    });
    const responseMap = new Map(response.fields.map((f) => [f.field, f]));

    const updates = existingFields.map((existing) => {
      const aiField = responseMap.get(existing.field);
      if (!aiField) return null;

      // If user provided a correction, keep it and only refresh AI metadata
      if (existing.correctedValue) {
        return this.prisma.gapField.update({
          where: { id: existing.id },
          data: {
            confidence: aiField.confidence,
            aiReasoning: aiField.reasoning,
            // Keep status VERIFIED since user corrected it
          },
        });
      }

      // No user correction — update everything from AI
      return this.prisma.gapField.update({
        where: { id: existing.id },
        data: {
          extractedValue: aiField.extractedValue,
          status: aiField.status,
          confidence: aiField.confidence,
          aiReasoning: aiField.reasoning,
        },
      });
    }).filter((u): u is NonNullable<typeof u> => u !== null);

    await this.prisma.$transaction(updates);
    this.logger.log(`Updated ${updates.length} gap fields from re-analysis for assessment ${assessmentId}`);
  }

  private async createSkeletonFields(assessmentId: string): Promise<void> {
    const data = (GAP_DETECTION_CONFIG.core10Fields as unknown as Core10FieldDefinition[]).map((def) => ({
      assessmentId,
      category: def.category,
      field: def.field,
      label: def.label,
      extractedValue: null,
      status: 'MISSING' as const,
      confidence: 0,
      aiReasoning: null,
      isMandatory: true,
      order: def.order,
    }));

    await this.prisma.gapField.createMany({ data });
    this.logger.log(`Created ${data.length} skeleton Core 10 gap fields for assessment ${assessmentId}`);
  }

  private async createErrorFields(assessmentId: string, error: unknown): Promise<void> {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during gap detection';
    const data = (GAP_DETECTION_CONFIG.core10Fields as unknown as Core10FieldDefinition[]).map((def) => ({
      assessmentId,
      category: def.category,
      field: def.field,
      label: def.label,
      extractedValue: null,
      status: 'MISSING' as const,
      confidence: 0,
      aiReasoning: `AI analysis failed: ${errorMessage}`,
      isMandatory: true,
      order: def.order,
    }));

    await this.prisma.gapField.createMany({ data });
    this.logger.warn(`Created ${data.length} error fallback Core 10 gap fields for assessment ${assessmentId}`);
  }
}
