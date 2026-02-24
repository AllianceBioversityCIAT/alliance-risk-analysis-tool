import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, CognitoVerifier, TokenClaims } from './jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';

const mockClaims: TokenClaims = {
  userId: 'cognito-sub-1',
  email: 'test@example.com',
  username: 'test@example.com',
  isAdmin: false,
};

const mockDbUser = { id: 'db-uuid-1' };

const mockVerifier: CognitoVerifier = {
  verifyToken: jest.fn().mockResolvedValue(mockClaims),
};

const mockPrisma = {
  user: {
    upsert: jest.fn().mockResolvedValue(mockDbUser),
  },
} as unknown as PrismaService;

function createMockContext(
  authHeader?: string,
  handlers: object[] = [],
): ExecutionContext {
  return {
    getHandler: () => handlers[0] ?? {},
    getClass: () => handlers[1] ?? {},
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authHeader ? { authorization: authHeader } : {},
        user: undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector, mockVerifier, mockPrisma);
  });

  it('should allow @Public() routes without a token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = createMockContext();
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should throw UnauthorizedException when no Authorization header', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const ctx = createMockContext();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when header does not start with Bearer', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const ctx = createMockContext('Basic sometoken');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should attach user to request with DB id and return true for valid token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const request = { headers: { authorization: 'Bearer valid-token' }, user: undefined as unknown };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(request.user).toMatchObject({
      userId: mockDbUser.id,
      cognitoId: mockClaims.userId,
      email: mockClaims.email,
      isAdmin: mockClaims.isAdmin,
    });
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cognitoId: mockClaims.userId } }),
    );
  });

  it('should throw UnauthorizedException for an invalid token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    (mockVerifier.verifyToken as jest.Mock).mockRejectedValueOnce(
      new Error('invalid token'),
    );
    const ctx = createMockContext('Bearer bad-token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
