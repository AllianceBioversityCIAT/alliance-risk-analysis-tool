import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminInitiateAuthCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminRespondToAuthChallengeCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  ChangePasswordCommand,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  GetUserCommand,
  ListGroupsCommand,
  ListUsersCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoService } from './cognito.service';
import { CognitoException } from '../common/exceptions/cognito.exception';

// Mock the entire AWS SDK module
jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const original = jest.requireActual('@aws-sdk/client-cognito-identity-provider');
  return {
    ...original,
    CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  };
});

// Mock jwks-rsa
jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn(),
  })),
}));

const mockSend = jest.fn();

const createMockTokens = () => ({
  AccessToken: 'mock-access-token',
  IdToken: 'mock-id-token',
  RefreshToken: 'mock-refresh-token',
  ExpiresIn: 3600,
  TokenType: 'Bearer',
});

const createMockCognitoUser = (username = 'testuser@example.com') => ({
  Username: username,
  Enabled: true,
  UserStatus: 'CONFIRMED',
  UserCreateDate: new Date('2024-01-01'),
  UserLastModifiedDate: new Date('2024-01-02'),
  Attributes: [
    { Name: 'email', Value: username },
    { Name: 'email_verified', Value: 'true' },
  ],
  UserAttributes: [
    { Name: 'email', Value: username },
    { Name: 'email_verified', Value: 'true' },
  ],
});

const createMockGroups = (groups: string[] = []) => ({
  Groups: groups.map((GroupName) => ({ GroupName })),
});

describe('CognitoService', () => {
  let service: CognitoService;

  beforeEach(async () => {
    mockSend.mockReset();

    (CognitoIdentityProviderClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CognitoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: unknown) => {
              const config: Record<string, string> = {
                ENVIRONMENT: 'test',
                AWS_REGION: 'us-east-1',
                COGNITO_USER_POOL_ID: 'us-east-1_testPool',
                COGNITO_CLIENT_ID: 'testClientId',
              };
              return config[key] ?? defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CognitoService>(CognitoService);

    // Call onModuleInit to initialize the service
    await service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Auth Methods ─────────────────────────────────────────────────────────

  describe('login()', () => {
    it('should return tokens on successful login', async () => {
      mockSend.mockResolvedValueOnce({
        AuthenticationResult: createMockTokens(),
      });

      const result = await service.login('test@example.com', 'password123');

      expect(result).toMatchObject({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
        requiresPasswordChange: false,
      });
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminInitiateAuthCommand));
    });

    it('should return requiresPasswordChange: true when challenge is NEW_PASSWORD_REQUIRED', async () => {
      mockSend.mockResolvedValueOnce({
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: 'mock-session',
      });

      const result = await service.login('test@example.com', 'password123');

      expect(result).toMatchObject({
        requiresPasswordChange: true,
        session: 'mock-session',
        username: 'test@example.com',
      });
    });

    it('should throw CognitoException on NotAuthorizedException', async () => {
      const error = { name: 'NotAuthorizedException', message: 'Incorrect username or password.' };
      mockSend.mockRejectedValueOnce(error);

      await expect(service.login('test@example.com', 'wrong')).rejects.toThrow(CognitoException);
    });

    it('should throw NotAuthorizedException (401) on UserNotFoundException to prevent enumeration', async () => {
      mockSend.mockRejectedValueOnce({ name: 'UserNotFoundException' });

      try {
        await service.login('notfound@example.com', 'pass');
        fail('Expected CognitoException to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CognitoException);
        // Expect 401 instead of 404
        expect((err as CognitoException).getStatus()).toBe(401);
        expect((err as CognitoException).message).toBe('Invalid credentials');
      }
    });
  });

  describe('refreshToken()', () => {
    it('should return new tokens on successful refresh', async () => {
      mockSend.mockResolvedValueOnce({
        AuthenticationResult: {
          AccessToken: 'new-access-token',
          IdToken: 'new-id-token',
          ExpiresIn: 3600,
          TokenType: 'Bearer',
          // No RefreshToken in response — Cognito doesn't rotate refresh tokens
        },
      });

      const result = await service.refreshToken('existing-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('existing-refresh-token'); // Returns the same refresh token
      expect(result.expiresIn).toBe(3600);
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminInitiateAuthCommand));
    });

    it('should throw CognitoException on error', async () => {
      mockSend.mockRejectedValueOnce({ name: 'NotAuthorizedException' });
      await expect(service.refreshToken('bad-token')).rejects.toThrow(CognitoException);
    });
  });

  describe('forgotPassword()', () => {
    it('should send password reset code successfully', async () => {
      // ListUsers response (lookup by email)
      mockSend.mockResolvedValueOnce({
        Users: [{ Username: 'test@example.com' }],
      });
      // ForgotPassword response
      mockSend.mockResolvedValueOnce({});

      await expect(service.forgotPassword('test@example.com')).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(expect.any(ListUsersCommand));
      expect(mockSend).toHaveBeenCalledWith(expect.any(ForgotPasswordCommand));
    });

    it('should use email directly when user not found by ListUsers', async () => {
      mockSend.mockResolvedValueOnce({ Users: [] }); // Empty result
      mockSend.mockResolvedValueOnce({}); // ForgotPassword succeeds

      await service.forgotPassword('test@example.com');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should return success (silent failure) on UserNotFoundException', async () => {
      mockSend.mockResolvedValueOnce({ Users: [{ Username: 'test@example.com' }] });
      mockSend.mockRejectedValueOnce({ name: 'UserNotFoundException' });

      await expect(service.forgotPassword('test@example.com')).resolves.toBeUndefined();
    });

    it('should throw CognitoException on error', async () => {
      mockSend.mockRejectedValueOnce({ name: 'LimitExceededException' });
      await expect(service.forgotPassword('test@example.com')).rejects.toThrow(CognitoException);
    });
  });

  describe('resetPassword()', () => {
    it('should confirm forgot password successfully', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(
        service.resetPassword('user', '123456', 'NewPassword1!'),
      ).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(expect.any(ConfirmForgotPasswordCommand));
    });

    it('should throw CognitoException on CodeMismatchException', async () => {
      mockSend.mockRejectedValueOnce({ name: 'CodeMismatchException' });
      await expect(service.resetPassword('user', 'wrong', 'pass')).rejects.toThrow(CognitoException);
    });
  });

  describe('completePasswordChange()', () => {
    it('should complete the NEW_PASSWORD_REQUIRED challenge and return tokens', async () => {
      mockSend.mockResolvedValueOnce({
        AuthenticationResult: createMockTokens(),
      });

      const result = await service.completePasswordChange('user', 'session', 'NewPassword1!');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.requiresPasswordChange).toBe(false);
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminRespondToAuthChallengeCommand));
    });

    it('should throw CognitoException on error', async () => {
      mockSend.mockRejectedValueOnce({ name: 'InvalidPasswordException' });
      await expect(
        service.completePasswordChange('user', 'session', 'weak'),
      ).rejects.toThrow(CognitoException);
    });
  });

  describe('changePassword()', () => {
    it('should change password successfully', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(
        service.changePassword('access-token', 'oldPass', 'newPass'),
      ).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(expect.any(ChangePasswordCommand));
    });

    it('should throw CognitoException on NotAuthorizedException', async () => {
      mockSend.mockRejectedValueOnce({ name: 'NotAuthorizedException' });
      await expect(
        service.changePassword('token', 'wrong', 'new'),
      ).rejects.toThrow(CognitoException);
    });
  });

  describe('getCurrentUser()', () => {
    it('should return user info with groups', async () => {
      const mockUser = createMockCognitoUser();
      mockSend
        .mockResolvedValueOnce({ ...mockUser }) // GetUser
        .mockResolvedValueOnce(createMockGroups(['admin'])); // AdminListGroupsForUser

      const result = await service.getCurrentUser('access-token');

      expect(result.username).toBe('testuser@example.com');
      expect(result.groups).toContain('admin');
      expect(result.isAdmin).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetUserCommand));
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminListGroupsForUserCommand));
    });

    it('should return isAdmin: false for non-admin users', async () => {
      mockSend
        .mockResolvedValueOnce(createMockCognitoUser())
        .mockResolvedValueOnce(createMockGroups([]));

      const result = await service.getCurrentUser('access-token');
      expect(result.isAdmin).toBe(false);
    });
  });

  describe('verifyToken()', () => {
    const makeJwt = (payload: object) => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-kid' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return `${header}.${body}.fakesignature`;
    };

    it('should decode token in development/test mode', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        'cognito:username': 'test@example.com',
        'cognito:groups': ['admin'],
      };

      const token = makeJwt(payload);
      const result = await service.verifyToken(token);

      expect(result.userId).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(result.isAdmin).toBe(true);
    });

    it('should return isAdmin: false when not in admin group', async () => {
      const payload = {
        sub: 'user-456',
        email: 'user@example.com',
        'cognito:username': 'user@example.com',
        'cognito:groups': [],
      };

      const result = await service.verifyToken(makeJwt(payload));
      expect(result.isAdmin).toBe(false);
    });

    it('should throw CognitoException for invalid token format', async () => {
      await expect(service.verifyToken('not-a-valid-jwt')).rejects.toThrow(CognitoException);
    });
  });

  // ─── Admin Methods ────────────────────────────────────────────────────────

  describe('listUsers()', () => {
    it('should return paginated user list with groups', async () => {
      const mockUser = createMockCognitoUser('user1@example.com');
      mockSend
        .mockResolvedValueOnce({ Users: [mockUser], PaginationToken: 'next-page' }) // ListUsers
        .mockResolvedValueOnce(mockUser) // AdminGetUser for user1
        .mockResolvedValueOnce(createMockGroups([])); // AdminListGroupsForUser for user1

      const result = await service.listUsers(10);

      expect(result.users).toHaveLength(1);
      expect(result.paginationToken).toBe('next-page');
    });

    it('should pass pagination token when provided', async () => {
      mockSend.mockResolvedValueOnce({ Users: [] });

      await service.listUsers(10, 'some-token');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ PaginationToken: 'some-token' }),
        }),
      );
    });
  });

  describe('getUser()', () => {
    it('should return user with admin group', async () => {
      const mockUser = createMockCognitoUser('admin@example.com');
      mockSend
        .mockResolvedValueOnce(mockUser) // AdminGetUser
        .mockResolvedValueOnce(createMockGroups(['admin'])); // AdminListGroupsForUser

      const result = await service.getUser('admin@example.com');

      expect(result.username).toBe('admin@example.com');
      expect(result.isAdmin).toBe(true);
      expect(result.userStatus).toBe('CONFIRMED');
    });

    it('should throw CognitoException on UserNotFoundException', async () => {
      mockSend.mockRejectedValueOnce({ name: 'UserNotFoundException' });
      await expect(service.getUser('ghost@example.com')).rejects.toThrow(CognitoException);
    });
  });

  describe('createUser()', () => {
    it('should create user and set temporary password', async () => {
      const mockUser = createMockCognitoUser('new@example.com');
      mockSend
        .mockResolvedValueOnce({ User: { ...mockUser, Attributes: mockUser.UserAttributes } }) // AdminCreateUser
        .mockResolvedValueOnce({}); // AdminSetUserPassword

      const result = await service.createUser('new@example.com', 'TempPass1!');

      expect(result.username).toBe('new@example.com');
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminCreateUserCommand));
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminSetUserPasswordCommand));
    });

    it('should suppress welcome email when sendEmail=false', async () => {
      const mockUser = createMockCognitoUser('new@example.com');
      mockSend
        .mockResolvedValueOnce({ User: { ...mockUser, Attributes: mockUser.UserAttributes } })
        .mockResolvedValueOnce({});

      await service.createUser('new@example.com', 'TempPass1!', false);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ MessageAction: 'SUPPRESS' }),
        }),
      );
    });

    it('should throw CognitoException on UsernameExistsException', async () => {
      mockSend.mockRejectedValueOnce({ name: 'UsernameExistsException' });
      await expect(service.createUser('exists@example.com', 'pass')).rejects.toThrow(CognitoException);
    });
  });

  describe('updateUser()', () => {
    it('should update user attributes', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(
        service.updateUser('user', { given_name: 'John', family_name: 'Doe' }),
      ).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminUpdateUserAttributesCommand));
    });
  });

  describe('deleteUser()', () => {
    it('should delete user successfully', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(service.deleteUser('user@example.com')).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminDeleteUserCommand));
    });
  });

  describe('enableUser()', () => {
    it('should enable user', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(service.enableUser('user@example.com')).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminEnableUserCommand));
    });
  });

  describe('disableUser()', () => {
    it('should disable user', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(service.disableUser('user@example.com')).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminDisableUserCommand));
    });
  });

  describe('resetUserPassword()', () => {
    it('should reset user password to temporary', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(
        service.resetUserPassword('user@example.com', 'NewTemp1!'),
      ).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ Permanent: false }),
        }),
      );
    });
  });

  describe('listGroups()', () => {
    it('should return list of group names', async () => {
      mockSend.mockResolvedValueOnce({
        Groups: [{ GroupName: 'admin' }, { GroupName: 'analysts' }],
      });

      const groups = await service.listGroups();
      expect(groups).toEqual(['admin', 'analysts']);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ListGroupsCommand));
    });
  });

  describe('addUserToGroup()', () => {
    it('should add user to group', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(
        service.addUserToGroup('user@example.com', 'admin'),
      ).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminAddUserToGroupCommand));
    });
  });

  describe('removeUserFromGroup()', () => {
    it('should remove user from group', async () => {
      mockSend.mockResolvedValueOnce({});
      await expect(
        service.removeUserFromGroup('user@example.com', 'admin'),
      ).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(expect.any(AdminRemoveUserFromGroupCommand));
    });
  });

  // ─── Error Mapping Coverage ───────────────────────────────────────────────

  describe('Error mapping — COGNITO_ERROR_MAP coverage', () => {
    const errorCases = [
      { name: 'NotAuthorizedException', expectedStatus: 401 },
      { name: 'UserNotFoundException', expectedStatus: 404 },
      { name: 'CodeMismatchException', expectedStatus: 400 },
      { name: 'ExpiredCodeException', expectedStatus: 400 },
      { name: 'InvalidPasswordException', expectedStatus: 400 },
      { name: 'LimitExceededException', expectedStatus: 429 },
      { name: 'InvalidParameterException', expectedStatus: 400 },
      { name: 'UsernameExistsException', expectedStatus: 409 },
      { name: 'UserNotConfirmedException', expectedStatus: 403 },
    ];

    errorCases.forEach(({ name, expectedStatus }) => {
      it(`should map ${name} to HTTP ${expectedStatus}`, async () => {
        mockSend.mockRejectedValueOnce({ name });
        try {
          // Use getUser instead of login, as login now has special handling for UserNotFoundException
          await service.getUser('test@example.com');
          fail('Expected CognitoException to be thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(CognitoException);
          expect((err as CognitoException).getStatus()).toBe(expectedStatus);
        }
      });
    });

    it('should map unknown errors to HTTP 500', async () => {
      mockSend.mockRejectedValueOnce({ name: 'SomeUnknownError' });
      try {
        await service.getUser('test@example.com');
        fail('Expected CognitoException to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CognitoException);
        expect((err as CognitoException).getStatus()).toBe(500);
      }
    });
  });

  // ─── Production mode safety check ────────────────────────────────────────

  describe('onModuleInit() production safety', () => {
    it('should throw if ENVIRONMENT=production and no Cognito config', async () => {
      const module = await Test.createTestingModule({
        providers: [
          CognitoService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultVal?: unknown) => {
                if (key === 'ENVIRONMENT') return 'production';
                if (key === 'AWS_REGION') return 'us-east-1';
                return defaultVal ?? '';
              }),
            },
          },
        ],
      }).compile();

      const prodService = module.get<CognitoService>(CognitoService);
      expect(() => prodService.onModuleInit()).toThrow(
        'COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set',
      );
    });

    it('should NOT throw if ENVIRONMENT=production and Cognito config is provided', async () => {
      const module = await Test.createTestingModule({
        providers: [
          CognitoService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultVal?: unknown) => {
                const config: Record<string, string> = {
                  ENVIRONMENT: 'production',
                  AWS_REGION: 'us-east-1',
                  COGNITO_USER_POOL_ID: 'us-east-1_prod',
                  COGNITO_CLIENT_ID: 'prodClientId',
                };
                return config[key] ?? defaultVal;
              }),
            },
          },
        ],
      }).compile();

      const prodService = module.get<CognitoService>(CognitoService);
      expect(() => prodService.onModuleInit()).not.toThrow();
    });
  });
});
