import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.extractMessage(exception);
    const error = this.statusToError(statusCode);
    const code = this.extractCode(exception);

    const body: Record<string, unknown> = {
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (code) {
      body.code = code;
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} ${statusCode}`);
    }

    response.status(statusCode).json(body);
  }

  private extractMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const resp = response as Record<string, unknown>;
        if (Array.isArray(resp.message)) {
          return resp.message as string[];
        }
        if (typeof resp.message === 'string') {
          return resp.message;
        }
      }
      return exception.message;
    }
    if (exception instanceof Error) {
      // In production, hide internal error details from clients
      return process.env.ENVIRONMENT === 'production'
        ? 'An unexpected error occurred'
        : exception.message;
    }
    return 'Internal server error';
  }

  private extractCode(exception: unknown): string | undefined {
    if (
      exception !== null &&
      typeof exception === 'object' &&
      'code' in exception &&
      typeof (exception as Record<string, unknown>).code === 'string'
    ) {
      return (exception as Record<string, unknown>).code as string;
    }
    return undefined;
  }

  private statusToError(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] || `ERROR_${status}`;
  }
}
