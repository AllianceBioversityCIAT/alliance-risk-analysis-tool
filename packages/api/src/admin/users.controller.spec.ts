import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { CognitoService } from '../auth/cognito.service';
import { AdminGuard } from '../common/guards/admin.guard';

const mockCognitoService = {
  listUsers: jest.fn(),
  createUser: jest.fn(),
  getUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  enableUser: jest.fn(),
  disableUser: jest.fn(),
  resetUserPassword: jest.fn(),
};

const mockAdminUser = {
  username: 'admin@example.com',
  email: 'admin@example.com',
  enabled: true,
  userStatus: 'CONFIRMED',
  groups: ['admin'],
  isAdmin: true,
  createdDate: new Date().toISOString(),
  lastModifiedDate: new Date().toISOString(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: CognitoService, useValue: mockCognitoService },
      ],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true }) // bypass guard in unit tests
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('listUsers()', () => {
    it('should return paginated user list wrapped in data envelope', async () => {
      const mockResponse = { users: [mockAdminUser], paginationToken: undefined };
      mockCognitoService.listUsers.mockResolvedValueOnce(mockResponse);

      const result = await controller.listUsers();

      expect(result).toEqual({
        data: {
          users: mockResponse.users,
          nextToken: undefined,
          total: mockResponse.users.length,
        },
      });
      expect(mockCognitoService.listUsers).toHaveBeenCalledWith(60, undefined);
    });

    it('should pass limit and nextToken when provided', async () => {
      mockCognitoService.listUsers.mockResolvedValueOnce({ users: [], paginationToken: undefined });

      await controller.listUsers('10', 'some-token');

      expect(mockCognitoService.listUsers).toHaveBeenCalledWith(10, 'some-token');
    });
  });

  describe('createUser()', () => {
    it('should create a user', async () => {
      mockCognitoService.createUser.mockResolvedValueOnce(mockAdminUser);

      const result = await controller.createUser({
        email: 'new@example.com',
        temporaryPassword: 'TempPass1!',
        sendWelcomeEmail: true,
      });

      expect(result).toEqual(mockAdminUser);
      expect(mockCognitoService.createUser).toHaveBeenCalledWith(
        'new@example.com',
        'TempPass1!',
        true,
      );
    });
  });

  describe('getUser()', () => {
    it('should return user details', async () => {
      mockCognitoService.getUser.mockResolvedValueOnce(mockAdminUser);

      const result = await controller.getUser('admin@example.com');

      expect(result).toEqual(mockAdminUser);
      expect(mockCognitoService.getUser).toHaveBeenCalledWith('admin@example.com');
    });
  });

  describe('updateUser()', () => {
    it('should update user attributes', async () => {
      mockCognitoService.updateUser.mockResolvedValueOnce(undefined);

      const result = await controller.updateUser('user@example.com', {
        attributes: { given_name: 'John' },
      });

      expect(result.message).toContain('User updated successfully');
      expect(mockCognitoService.updateUser).toHaveBeenCalledWith('user@example.com', {
        given_name: 'John',
      });
    });

    it('should handle empty attributes', async () => {
      mockCognitoService.updateUser.mockResolvedValueOnce(undefined);

      await controller.updateUser('user@example.com', {});

      expect(mockCognitoService.updateUser).toHaveBeenCalledWith('user@example.com', {});
    });
  });

  describe('deleteUser()', () => {
    it('should delete user and return success message', async () => {
      mockCognitoService.deleteUser.mockResolvedValueOnce(undefined);

      const result = await controller.deleteUser('user@example.com');

      expect(result.message).toContain('deleted successfully');
      expect(mockCognitoService.deleteUser).toHaveBeenCalledWith('user@example.com');
    });
  });

  describe('enableUser()', () => {
    it('should enable user', async () => {
      mockCognitoService.enableUser.mockResolvedValueOnce(undefined);

      const result = await controller.enableUser('user@example.com');

      expect(result.message).toContain('enabled successfully');
    });
  });

  describe('disableUser()', () => {
    it('should disable user', async () => {
      mockCognitoService.disableUser.mockResolvedValueOnce(undefined);

      const result = await controller.disableUser('user@example.com');

      expect(result.message).toContain('disabled successfully');
    });
  });

  describe('resetPassword()', () => {
    it('should reset user password', async () => {
      mockCognitoService.resetUserPassword.mockResolvedValueOnce(undefined);

      const result = await controller.resetPassword('user@example.com', 'TempPass1!');

      expect(result.message).toContain('Password reset successfully');
      expect(mockCognitoService.resetUserPassword).toHaveBeenCalledWith(
        'user@example.com',
        'TempPass1!',
      );
    });
  });

  describe('AdminGuard enforcement', () => {
    it('AdminGuard should throw ForbiddenException for non-admin users', () => {
      const guard = new AdminGuard();
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { isAdmin: false } }),
        }),
      } as any;

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('AdminGuard should allow admin users', () => {
      const guard = new AdminGuard();
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { isAdmin: true } }),
        }),
      } as any;

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
