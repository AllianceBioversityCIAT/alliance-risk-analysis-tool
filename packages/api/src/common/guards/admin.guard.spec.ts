import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import type { UserClaims } from './jwt-auth.guard';

function createMockContext(user?: Partial<UserClaims>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('should allow admin users', () => {
    const ctx = createMockContext({ isAdmin: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException for non-admin users', () => {
    const ctx = createMockContext({ isAdmin: false });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is missing', () => {
    const ctx = createMockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException with correct message', () => {
    const ctx = createMockContext({ isAdmin: false });
    expect(() => guard.canActivate(ctx)).toThrow('Admin access required');
  });
});
