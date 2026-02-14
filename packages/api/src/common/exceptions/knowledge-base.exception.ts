import { HttpStatus } from '@nestjs/common';
import { ApplicationException } from './application.exception';

export class KnowledgeBaseException extends ApplicationException {
  readonly kbId: string;

  constructor(
    message: string,
    kbId: string,
    details: Record<string, unknown> = {},
  ) {
    super(message, 'KNOWLEDGE_BASE_ERROR', HttpStatus.BAD_GATEWAY, {
      kbId,
      ...details,
    });
    this.kbId = kbId;
  }
}
