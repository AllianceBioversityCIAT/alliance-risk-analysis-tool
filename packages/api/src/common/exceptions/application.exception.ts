import { HttpException, HttpStatus } from '@nestjs/common';

export class ApplicationException extends HttpException {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    details: Record<string, unknown> = {},
  ) {
    super(message, statusCode);
    this.code = code;
    this.details = details;
  }
}
