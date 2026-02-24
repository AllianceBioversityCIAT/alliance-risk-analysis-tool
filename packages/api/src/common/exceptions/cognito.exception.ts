import { HttpStatus } from '@nestjs/common';
import { ApplicationException } from './application.exception';

const COGNITO_ERROR_MAP: Record<string, { status: HttpStatus; message: string }> = {
  NotAuthorizedException: { status: HttpStatus.UNAUTHORIZED, message: 'Invalid credentials' },
  UserNotFoundException: { status: HttpStatus.NOT_FOUND, message: 'User not found' },
  CodeMismatchException: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid verification code',
  },
  ExpiredCodeException: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Verification code expired',
  },
  InvalidPasswordException: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Password does not meet requirements',
  },
  LimitExceededException: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Too many requests, try again later',
  },
  InvalidParameterException: { status: HttpStatus.BAD_REQUEST, message: 'Invalid parameter' },
  UsernameExistsException: { status: HttpStatus.CONFLICT, message: 'User already exists' },
  UserNotConfirmedException: { status: HttpStatus.FORBIDDEN, message: 'User not confirmed' },
};

export class CognitoException extends ApplicationException {
  static fromCognitoError(error: { name: string; message?: string }): CognitoException {
    const mapped = COGNITO_ERROR_MAP[error.name];
    if (mapped) {
      return new CognitoException(mapped.message, error.name, mapped.status);
    }
    return new CognitoException(
      'Authentication service error',
      error.name || 'COGNITO_UNKNOWN_ERROR',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  constructor(message: string, code: string, status: HttpStatus) {
    super(message, code, status);
  }
}
