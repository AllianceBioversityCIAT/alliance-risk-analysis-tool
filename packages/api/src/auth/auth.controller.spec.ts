import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { CognitoService } from './cognito.service';
import { CognitoException } from '../common/exceptions/cognito.exception';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const mockCognitoService = {
  login: jest.fn(),
  refreshToken: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  completePasswordChange: jest.fn(),
  changePassword: jest.fn(),
  getCurrentUser: jest.fn(),
};

const mockLoginResponse = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  requiresPasswordChange: false,
};

const mockCognitoUser = {
  username: 'test@example.com',
  email: 'test@example.com',
  enabled: true,
  userStatus: 'CONFIRMED',
  groups: [],
  isAdmin: false,
  createdDate: new Date().toISOString(),
  lastModifiedDate: new Date().toISOString(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: CognitoService, useValue: mockCognitoService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login()', () => {
    it('should return tokens on successful login', async () => {
      mockCognitoService.login.mockResolvedValueOnce(mockLoginResponse);

      const result = await controller.login({
        email: 'test@example.com',
        password: 'Password1!',
      });

      expect(result).toEqual(mockLoginResponse);
      expect(mockCognitoService.login).toHaveBeenCalledWith(
        'test@example.com',
        'Password1!',
      );
    });

    it('should return requiresPasswordChange on first login', async () => {
      const challengeResponse = {
        requiresPasswordChange: true,
        session: 'mock-session',
        username: 'test@example.com',
      };
      mockCognitoService.login.mockResolvedValueOnce(challengeResponse);

      const result = await controller.login({
        email: 'test@example.com',
        password: 'TempPass1!',
      });

      expect(result.requiresPasswordChange).toBe(true);
      expect(result.session).toBe('mock-session');
    });

    it('should throw CognitoException on invalid credentials', async () => {
      mockCognitoService.login.mockRejectedValueOnce(
        new CognitoException('Invalid credentials', 'NotAuthorizedException', 401),
      );

      await expect(
        controller.login({ email: 'test@example.com', password: 'WrongPass1!' }),
      ).rejects.toThrow(CognitoException);
    });
  });

  describe('refreshToken()', () => {
    it('should return new tokens', async () => {
      mockCognitoService.refreshToken.mockResolvedValueOnce(mockLoginResponse);

      const result = await controller.refreshToken({ refreshToken: 'old-refresh-token' });

      expect(result).toEqual(mockLoginResponse);
      expect(mockCognitoService.refreshToken).toHaveBeenCalledWith('old-refresh-token');
    });
  });

  describe('logout()', () => {
    it('should return success message', async () => {
      const result = await controller.logout();
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('forgotPassword()', () => {
    it('should return generic success message', async () => {
      mockCognitoService.forgotPassword.mockResolvedValueOnce(undefined);

      const result = await controller.forgotPassword({ email: 'user@example.com' });

      expect(result.message).toContain('reset code has been sent');
      expect(mockCognitoService.forgotPassword).toHaveBeenCalledWith('user@example.com');
    });

    it('should return same message even for non-existent email (security)', async () => {
      mockCognitoService.forgotPassword.mockResolvedValueOnce(undefined);

      const result = await controller.forgotPassword({ email: 'notfound@example.com' });

      // Should NOT reveal whether email exists
      expect(result.message).toContain('If this email is registered');
    });
  });

  describe('resetPassword()', () => {
    it('should reset password and return success message', async () => {
      mockCognitoService.resetPassword.mockResolvedValueOnce(undefined);

      const result = await controller.resetPassword({
        username: 'test@example.com',
        code: '123456',
        newPassword: 'NewPassword1!',
      });

      expect(result.message).toContain('Password reset successfully');
      expect(mockCognitoService.resetPassword).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
        'NewPassword1!',
      );
    });

    it('should throw CognitoException on invalid code', async () => {
      mockCognitoService.resetPassword.mockRejectedValueOnce(
        new CognitoException('Invalid verification code', 'CodeMismatchException', 400),
      );

      await expect(
        controller.resetPassword({
          username: 'test@example.com',
          code: 'wrong',
          newPassword: 'NewPassword1!',
        }),
      ).rejects.toThrow(CognitoException);
    });
  });

  describe('completePasswordChange()', () => {
    it('should complete password change and return tokens', async () => {
      mockCognitoService.completePasswordChange.mockResolvedValueOnce(mockLoginResponse);

      const result = await controller.completePasswordChange({
        username: 'test@example.com',
        session: 'mock-session',
        newPassword: 'NewPassword1!',
      });

      expect(result).toEqual(mockLoginResponse);
      expect(mockCognitoService.completePasswordChange).toHaveBeenCalledWith(
        'test@example.com',
        'mock-session',
        'NewPassword1!',
      );
    });
  });

  describe('changePassword()', () => {
    it('should change password and return success message', async () => {
      mockCognitoService.changePassword.mockResolvedValueOnce(undefined);

      const result = await controller.changePassword(
        { previousPassword: 'OldPass1!', proposedPassword: 'NewPass1!' },
        { headers: { authorization: 'Bearer mock-access-token' } },
      );

      expect(result.message).toContain('Password changed successfully');
      expect(mockCognitoService.changePassword).toHaveBeenCalledWith(
        'mock-access-token',
        'OldPass1!',
        'NewPass1!',
      );
    });

    it('should handle missing authorization header gracefully', async () => {
      mockCognitoService.changePassword.mockResolvedValueOnce(undefined);

      await controller.changePassword(
        { previousPassword: 'old', proposedPassword: 'NewPass1!' },
        { headers: {} },
      );

      expect(mockCognitoService.changePassword).toHaveBeenCalledWith('', 'old', 'NewPass1!');
    });
  });

  describe('getMe()', () => {
    it('should return current user profile', async () => {
      mockCognitoService.getCurrentUser.mockResolvedValueOnce(mockCognitoUser);

      const result = await controller.getMe(
        { userId: 'user-1', cognitoId: 'cognito-sub-1', email: 'test@example.com', username: 'test@example.com', isAdmin: false },
        { headers: { authorization: 'Bearer mock-access-token' } },
      );

      expect(result).toEqual(mockCognitoUser);
      expect(mockCognitoService.getCurrentUser).toHaveBeenCalledWith('mock-access-token');
    });
  });

  // ─── DTO validation tests (integration-style with ValidationPipe) ─────────

  describe('DTO validation', () => {
    let pipeValidated: ValidationPipe;

    beforeEach(() => {
      pipeValidated = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    });

    it('should reject login with invalid email', async () => {
      await expect(
        pipeValidated.transform({ email: 'not-an-email', password: 'Password1!' }, {
          type: 'body',
          metatype: LoginDto,
        } as any),
      ).rejects.toBeDefined();
    });

    it('should reject login with password shorter than 8 chars', async () => {
      await expect(
        pipeValidated.transform({ email: 'test@example.com', password: 'short' }, {
          type: 'body',
          metatype: LoginDto,
        } as any),
      ).rejects.toBeDefined();
    });

    it('should reject login with password longer than 128 chars', async () => {
      const longPassword = 'a'.repeat(129);
      await expect(
        pipeValidated.transform({ email: 'test@example.com', password: longPassword }, {
          type: 'body',
          metatype: LoginDto,
        } as any),
      ).rejects.toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      const result = await pipeValidated.transform(
        { email: 'TEST@EXAMPLE.COM', password: 'Password1!' },
        {
          type: 'body',
          metatype: LoginDto,
        } as any,
      );
      expect(result.email).toBe('test@example.com');
    });

    it('should reject forgotPassword with invalid email', async () => {
      await expect(
        pipeValidated.transform({ email: 'invalid' }, {
          type: 'body',
          metatype: ForgotPasswordDto,
        } as any),
      ).rejects.toBeDefined();
    });

    it('should reject resetPassword with missing code', async () => {
      await expect(
        pipeValidated.transform({ username: 'user', newPassword: 'Password1!' }, {
          type: 'body',
          metatype: ResetPasswordDto,
        } as any),
      ).rejects.toBeDefined();
    });
  });
});
