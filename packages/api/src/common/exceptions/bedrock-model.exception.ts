import { HttpStatus } from '@nestjs/common';
import { ApplicationException } from './application.exception';

export class BedrockModelException extends ApplicationException {
  readonly modelId: string;

  constructor(
    message: string,
    modelId: string,
    details: Record<string, unknown> = {},
  ) {
    super(message, 'BEDROCK_MODEL_ERROR', HttpStatus.BAD_GATEWAY, {
      modelId,
      ...details,
    });
    this.modelId = modelId;
  }
}
