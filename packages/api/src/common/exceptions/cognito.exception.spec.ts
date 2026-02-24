import { HttpStatus } from '@nestjs/common';
import { CognitoException } from './cognito.exception';

describe('CognitoException', () => {
  describe('fromCognitoError', () => {
    it('should map NotAuthorizedException to 401', () => {
      const ex = CognitoException.fromCognitoError({ name: 'NotAuthorizedException' });
      expect(ex.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(ex.message).toBe('Invalid credentials');
    });

    it('should map UserNotFoundException to 404', () => {
      const ex = CognitoException.fromCognitoError({ name: 'UserNotFoundException' });
      expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('should map CodeMismatchException to 400', () => {
      const ex = CognitoException.fromCognitoError({ name: 'CodeMismatchException' });
      expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should map ExpiredCodeException to 400', () => {
      const ex = CognitoException.fromCognitoError({ name: 'ExpiredCodeException' });
      expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should map InvalidPasswordException to 400', () => {
      const ex = CognitoException.fromCognitoError({ name: 'InvalidPasswordException' });
      expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should map LimitExceededException to 429', () => {
      const ex = CognitoException.fromCognitoError({ name: 'LimitExceededException' });
      expect(ex.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('should map InvalidParameterException to 400', () => {
      const ex = CognitoException.fromCognitoError({ name: 'InvalidParameterException' });
      expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should map UsernameExistsException to 409', () => {
      const ex = CognitoException.fromCognitoError({ name: 'UsernameExistsException' });
      expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
    });

    it('should map UserNotConfirmedException to 403', () => {
      const ex = CognitoException.fromCognitoError({ name: 'UserNotConfirmedException' });
      expect(ex.getStatus()).toBe(HttpStatus.FORBIDDEN);
    });

    it('should default unknown errors to 500', () => {
      const ex = CognitoException.fromCognitoError({ name: 'UnknownCognitoError' });
      expect(ex.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(ex.message).toBe('Authentication service error');
    });

    it('should use COGNITO_UNKNOWN_ERROR code for unknown errors', () => {
      const ex = CognitoException.fromCognitoError({ name: 'SomeRandomError' });
      expect(ex.code).toBe('SomeRandomError');
    });
  });
});
