import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { JobHandler } from '../job-handler.interface';

interface ParseDocumentInput {
  assessmentId: string;
  documentId: string;
}

interface ParseDocumentResult {
  assessmentId: string;
  documentId: string;
  gapFieldsCreated: number;
}

/**
 * STUB handler for PARSE_DOCUMENT jobs.
 * Creates mock GapField records for all 7 risk categories.
 * Replace with actual Bedrock agent call when implementing the agent pipeline.
 */
@Injectable()
export class ParseDocumentHandler implements JobHandler {
  private readonly logger = new Logger(ParseDocumentHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ParseDocumentInput): Promise<ParseDocumentResult> {
    this.logger.log(`[STUB] Parsing document for assessment: ${input.assessmentId}`);

    const categories = [
      'FINANCIAL',
      'CLIMATE_ENVIRONMENTAL',
      'BEHAVIORAL',
      'OPERATIONAL',
      'MARKET',
      'GOVERNANCE_LEGAL',
      'TECHNOLOGY_DATA',
    ] as const;

    const stubFields = [
      { field: 'annual_revenue', label: 'Annual Revenue', isMandatory: true },
      { field: 'funding_stage', label: 'Funding Stage', isMandatory: true },
      { field: 'debt_ratio', label: 'Debt-to-Equity Ratio', isMandatory: false },
      { field: 'cash_runway', label: 'Cash Runway (months)', isMandatory: false },
      { field: 'profit_margin', label: 'Profit Margin (%)', isMandatory: false },
    ];

    let totalCreated = 0;

    for (const category of categories) {
      for (let i = 0; i < stubFields.length; i++) {
        const field = stubFields[i];
        try {
          await this.prisma.gapField.create({
            data: {
              assessmentId: input.assessmentId,
              category,
              field: `${category.toLowerCase()}_${field.field}`,
              label: field.label,
              extractedValue: Math.random() > 0.4 ? `Mock extracted value for ${field.label}` : null,
              status: Math.random() > 0.4 ? 'PARTIAL' : 'MISSING',
              isMandatory: field.isMandatory && category === 'FINANCIAL',
              order: i,
            },
          });
          totalCreated++;
        } catch {
          // Field may already exist (idempotency)
        }
      }
    }

    // Update assessment status to ACTION_REQUIRED (gaps need review)
    await this.prisma.assessment.update({
      where: { id: input.assessmentId },
      data: { status: 'ACTION_REQUIRED', progress: 30 },
    });

    this.logger.log(`[STUB] Created ${totalCreated} gap fields for assessment ${input.assessmentId}`);

    return {
      assessmentId: input.assessmentId,
      documentId: input.documentId,
      gapFieldsCreated: totalCreated,
    };
  }
}
