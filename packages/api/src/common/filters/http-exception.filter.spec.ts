import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { ApplicationException } from '../exceptions';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { url: string; method: string };
  let mockHost: { switchToHttp: jest.Mock };

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = { url: '/test', method: 'GET' };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should handle HttpException with correct status and message', () => {
    const exception = new NotFoundException('Resource not found');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(404);
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toBe('Resource not found');
    expect(body.path).toBe('/test');
    expect(body.timestamp).toBeDefined();
  });

  it('should handle non-HttpException as 500', () => {
    const exception = new Error('Something broke');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('INTERNAL_SERVER_ERROR');
    expect(body.message).toBe('Something broke');
  });

  it('should preserve string[] messages from ValidationPipe', () => {
    const exception = new BadRequestException({
      message: ['field must be a string', 'field must not be empty'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, mockHost as any);

    const body = mockResponse.json.mock.calls[0][0];
    expect(body.message).toEqual([
      'field must be a string',
      'field must not be empty',
    ]);
  });

  it('should include code from ApplicationException', () => {
    const exception = new ApplicationException(
      'Model failed',
      'BEDROCK_MODEL_ERROR',
      HttpStatus.BAD_GATEWAY,
    );

    filter.catch(exception, mockHost as any);

    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(502);
    expect(body.code).toBe('BEDROCK_MODEL_ERROR');
    expect(body.error).toBe('BAD_GATEWAY');
  });

  it('should not include code field for plain HttpException', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost as any);

    const body = mockResponse.json.mock.calls[0][0];
    expect(body.code).toBeUndefined();
  });

  it('should handle non-Error thrown values as 500', () => {
    filter.catch('string error', mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
  });

  it('should use fallback error label for unmapped status codes', () => {
    const exception = new HttpException('Teapot', 418);

    filter.catch(exception, mockHost as any);

    const body = mockResponse.json.mock.calls[0][0];
    expect(body.error).toBe('ERROR_418');
  });
});
