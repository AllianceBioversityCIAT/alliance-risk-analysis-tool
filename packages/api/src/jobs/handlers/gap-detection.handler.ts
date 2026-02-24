import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { JobHandler } from '../job-handler.interface';

interface GapDetectionInput {
  assessmentId: string;
}

interface GapDetectionResult {
  assessmentId: string;
  gapFieldsCreated: number;
}

/**
 * STUB handler for GAP_DETECTION jobs.
 * Creates mock GapField records if none exist yet.
 * Triggered when using Guided Interview or Manual Entry intake modes.
 */
@Injectable()
export class GapDetectionHandler implements JobHandler {
  private readonly logger = new Logger(GapDetectionHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: GapDetectionInput): Promise<GapDetectionResult> {
    this.logger.log(`[STUB] Running gap detection for assessment: ${input.assessmentId}`);

    const existing = await this.prisma.gapField.count({
      where: { assessmentId: input.assessmentId },
    });

    let gapFieldsCreated = 0;

    if (existing === 0) {
      const categories = [
        'FINANCIAL',
        'CLIMATE_ENVIRONMENTAL',
        'BEHAVIORAL',
        'OPERATIONAL',
        'MARKET',
        'GOVERNANCE_LEGAL',
        'TECHNOLOGY_DATA',
      ] as const;

      for (const category of categories) {
        for (let i = 0; i < 5; i++) {
          await this.prisma.gapField.create({
            data: {
              assessmentId: input.assessmentId,
              category,
              field: `${category.toLowerCase()}_field_${i + 1}`,
              label: `${category} Field ${i + 1}`,
              extractedValue: `Stub value for ${category} field ${i + 1}`,
              status: 'PARTIAL',
              isMandatory: i < 2 && category === 'FINANCIAL',
              order: i,
            },
          });
          gapFieldsCreated++;
        }
      }
    }

    await this.prisma.assessment.update({
      where: { id: input.assessmentId },
      data: { status: 'ACTION_REQUIRED', progress: 50 },
    });

    this.logger.log(`[STUB] Gap detection complete. Created ${gapFieldsCreated} fields.`);

    return { assessmentId: input.assessmentId, gapFieldsCreated };
  }
}
