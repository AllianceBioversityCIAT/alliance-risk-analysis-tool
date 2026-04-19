import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { JobsService } from '../../platform/jobs/jobs.service';
import { BedrockService } from '../../infrastructure/bedrock/bedrock.service';
import { JobType } from '@alliance-risk/shared';
import type { InvalidField } from '@alliance-risk/shared';
import { UpdateGapFieldsDto } from './dto';
import { GAP_VALIDATION_CONFIG, FIELD_DESCRIPTIONS } from './gap-detection.config';


@Injectable()
export class GapDetectionService {
  private readonly logger = new Logger(GapDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly bedrock: BedrockService,
  ) {}

  private async validateOwnership(assessmentId: string, userId: string): Promise<void> {
    // SECURITY: Use findFirst with compound conditions to prevent IDOR and resource enumeration
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, userId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
  }

  async findByAssessment(assessmentId: string, userId: string) {
    await this.validateOwnership(assessmentId, userId);
    const fields = await this.prisma.gapField.findMany({
      where: { assessmentId },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });

    const total = fields.length;
    const verifiedCount = fields.filter((f) => f.status === 'VERIFIED').length;
    const missingCount = fields.filter((f) => f.status === 'MISSING').length;
    const mandatoryFields = fields.filter((f) => f.isMandatory);
    const allMandatoryComplete =
      mandatoryFields.length > 0 &&
      mandatoryFields.every(
        (f) => f.status === 'VERIFIED' && (f.correctedValue || f.extractedValue),
      );

    return { data: fields, total, verifiedCount, missingCount, allMandatoryComplete };
  }

  async updateBatch(
    assessmentId: string,
    dto: UpdateGapFieldsDto,
    userId: string,
  ) {
    await this.validateOwnership(assessmentId, userId);

    // Batch update using transactions
    await this.prisma.$transaction(
      dto.updates.map((update) =>
        this.prisma.gapField.update({
          where: { id: update.id },
          data: {
            correctedValue: update.correctedValue,
            status: update.correctedValue ? 'VERIFIED' : 'MISSING',
            validationFeedback: null, // Clear previous validation feedback on new edit
          },
        }),
      ),
    );

    return this.findByAssessment(assessmentId, userId);
  }

  async checkMandatoryFields(
    assessmentId: string,
  ): Promise<{ allComplete: boolean; missing: string[] }> {
    const mandatoryFields = await this.prisma.gapField.findMany({
      where: { assessmentId, isMandatory: true },
    });

    const missing = mandatoryFields
      .filter((f) => f.status === 'MISSING' || (!f.correctedValue && !f.extractedValue))
      .map((f) => f.label);

    return { allComplete: missing.length === 0, missing };
  }

  async triggerReAnalysis(assessmentId: string, userId: string): Promise<{ jobId: string }> {
    await this.validateOwnership(assessmentId, userId);
    const jobId = await this.jobsService.create(
      JobType.GAP_DETECTION,
      { assessmentId, reAnalyze: true },
      userId,
    );
    return { jobId };
  }

  async validateEditedFields(assessmentId: string, userId: string): Promise<InvalidField[]> {
    await this.validateOwnership(assessmentId, userId);

    // Find only user-edited fields (correctedValue is not null)
    const editedFields = await this.prisma.gapField.findMany({
      where: { assessmentId, correctedValue: { not: null } },
    });

    if (editedFields.length === 0) return [];

    // Build validation payload
    const fieldsJson = editedFields.map((f) => ({
      field: f.field,
      label: f.label,
      description: FIELD_DESCRIPTIONS[f.field] ?? '',
      extractedValue: f.extractedValue,
      correctedValue: f.correctedValue,
    }));

    const userPrompt = GAP_VALIDATION_CONFIG.userPromptTemplate.replace(
      '{{fields_json}}',
      JSON.stringify(fieldsJson, null, 2),
    );

    try {
      const { output } = await this.bedrock.invokeModel({
        modelId: GAP_VALIDATION_CONFIG.model,
        systemPrompt: GAP_VALIDATION_CONFIG.systemPrompt,
        userPrompt,
        temperature: GAP_VALIDATION_CONFIG.temperature,
        maxTokens: GAP_VALIDATION_CONFIG.maxTokens,
      });

      const parsed = this.parseValidationResponse(output);
      const invalidResults = parsed.results.filter((r) => !r.valid);

      if (invalidResults.length === 0) return [];

      // Map field keys back to DB IDs and set invalid fields back to PARTIAL
      const fieldKeyToId = new Map(editedFields.map((f) => [f.field, f.id]));
      const invalidFields: InvalidField[] = [];

      for (const result of invalidResults) {
        const fieldId = fieldKeyToId.get(result.field);
        if (!fieldId) continue;

        await this.prisma.gapField.update({
          where: { id: fieldId },
          data: { status: 'PARTIAL', validationFeedback: result.feedback },
        });

        invalidFields.push({
          id: fieldId,
          field: result.field,
          feedback: result.feedback ?? 'This field does not contain meaningful information.',
        });
      }

      // Clear feedback for valid fields
      const validResults = parsed.results.filter((r) => r.valid);
      for (const result of validResults) {
        const fieldId = fieldKeyToId.get(result.field);
        if (!fieldId) continue;
        await this.prisma.gapField.update({
          where: { id: fieldId },
          data: { validationFeedback: null },
        });
      }

      return invalidFields;
    } catch (error) {
      this.logger.error('Validation call failed — blocking submission', error);
      throw new BadRequestException({
        statusCode: 400,
        message: 'Field validation service is temporarily unavailable. Please try again.',
        invalidFields: [],
      });
    }
  }

  private parseValidationResponse(output: string): { results: Array<{ field: string; valid: boolean; feedback: string | null }> } {
    // Strategy 1: Direct parse
    try {
      return JSON.parse(output);
    } catch { /* noop */ }

    // Strategy 2: Strip markdown code fences
    try {
      const stripped = output.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '');
      return JSON.parse(stripped);
    } catch { /* noop */ }

    // Strategy 3: Regex extract first JSON block
    const match = output.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }

    throw new Error('Failed to parse validation response as JSON');
  }

  async triggerRiskAnalysis(assessmentId: string, userId: string): Promise<string> {
    await this.validateOwnership(assessmentId, userId);

    // Validate user-edited fields before proceeding
    const invalidFields = await this.validateEditedFields(assessmentId, userId);
    if (invalidFields.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Some fields did not pass validation',
        invalidFields,
      });
    }

    const jobId = await this.jobsService.create(
      JobType.RISK_ANALYSIS,
      { assessmentId },
      userId,
    );
    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: 'ANALYZING' },
    });
    return jobId;
  }
}
