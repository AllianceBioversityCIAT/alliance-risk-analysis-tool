import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BedrockService } from '../../bedrock/bedrock.service';
import type { JobHandler } from '../job-handler.interface';
import { GAP_DETECTION_CONFIG } from '../../gap-detection/gap-detection.config';
import type { Core10FieldDefinition } from '../../gap-detection/gap-detection.config';

interface GapDetectionInput {
  assessmentId: string;
}

interface GapDetectionResult {
  assessmentId: string;
  gapFieldsCreated: number;
  bedrockTokensUsed: number;
}

interface ExtractionResult {
  textContent?: string;
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
    this.logger.log(`Running gap detection for assessment: ${input.assessmentId}`);

    const assessment = await this.prisma.assessment.findUniqueOrThrow({
      where: { id: input.assessmentId },
    });

    // Delete existing gap fields (idempotent delete-then-create)
    await this.prisma.gapField.deleteMany({
      where: { assessmentId: input.assessmentId },
    });

    let bedrockTokensUsed = 0;

    if (assessment.intakeMode === 'UPLOAD') {
      bedrockTokensUsed = await this.processUploadMode(input.assessmentId);
    } else {
      // GUIDED_INTERVIEW or MANUAL_ENTRY: create skeleton fields without Bedrock
      await this.createSkeletonFields(input.assessmentId);
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
    };
  }

  // ─── Upload Mode ─────────────────────────────────────────────────────────────

  private async processUploadMode(assessmentId: string): Promise<number> {
    // 1. Fetch extraction result from the most recent completed PARSE_DOCUMENT job
    const parseJob = await this.prisma.job.findFirst({
      where: {
        type: 'PARSE_DOCUMENT',
        status: 'COMPLETED',
        input: { path: ['assessmentId'], equals: assessmentId },
      },
      orderBy: { completedAt: 'desc' },
    });

    if (!parseJob?.result) {
      this.logger.warn(`No completed PARSE_DOCUMENT job found for assessment ${assessmentId}. Creating skeleton fields.`);
      await this.createSkeletonFields(assessmentId);
      return 0;
    }

    const extraction = parseJob.result as ExtractionResult;
    let extractedText = extraction.textContent ?? '';

    // 2. Truncate to maxInputCharacters (generous with Sonnet 4.6's 1M token window)
    if (extractedText.length > GAP_DETECTION_CONFIG.maxInputCharacters) {
      this.logger.log(
        `Truncating extracted text from ${extractedText.length} to ${GAP_DETECTION_CONFIG.maxInputCharacters} chars`,
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
    const userPrompt = prompt.userPromptTemplate.replace(
      /\{\{extracted_data\}\}/g,
      extractedText,
    );

    // 5. Invoke Bedrock with IGAD-pattern config
    try {
      const startedAt = Date.now();

      const { output, tokensUsed } = await this.bedrock.invokeModel({
        modelId: GAP_DETECTION_CONFIG.model,
        systemPrompt: prompt.systemPrompt,
        userPrompt,
        temperature: GAP_DETECTION_CONFIG.temperature,
        maxTokens: GAP_DETECTION_CONFIG.maxTokens,
      });

      const elapsed = Date.now() - startedAt;
      this.logger.log(
        `Bedrock gap detection complete. Tokens: ${tokensUsed}, Time: ${elapsed}ms`,
      );

      // 6. Parse JSON response using 3-strategy defensive parsing
      const parsed = this.parseAIResponse(output);

      // 7. Create Core 10 GapField records from AI response
      await this.createFieldsFromAIResponse(assessmentId, parsed);

      return tokensUsed;
    } catch (error) {
      // On Bedrock failure: create all-MISSING fields with error reasoning
      this.logger.error(
        `Bedrock invocation failed for assessment ${assessmentId}: ${(error as Error).message}`,
      );
      await this.createErrorFields(assessmentId, error);
      return 0;
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

    // Strategy 3: Regex extract first { ... } JSON block
    const match = output.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as GapDetectionAIResponse;
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
