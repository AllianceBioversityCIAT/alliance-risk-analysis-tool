import { HttpStatus } from '@nestjs/common';
import { ApplicationException } from './application.exception';

export class RiskScoringException extends ApplicationException {
  readonly category: string;
  readonly indicator?: string;

  constructor(
    message: string,
    category: string,
    indicator?: string,
    details: Record<string, unknown> = {},
  ) {
    super(message, 'RISK_SCORING_ERROR', HttpStatus.UNPROCESSABLE_ENTITY, {
      category,
      ...(indicator !== undefined && { indicator }),
      ...details,
    });
    this.category = category;
    this.indicator = indicator;
  }
}
