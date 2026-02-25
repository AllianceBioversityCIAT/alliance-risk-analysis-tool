import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminRespondToAuthChallengeCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ChangePasswordCommand,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  GetUserCommand,
  ListGroupsCommand,
  ListUsersCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { CognitoException } from '../common/exceptions/cognito.exception';
import { TokenClaims } from '../common/guards/jwt-auth.guard';
import { CognitoUser, LoginResponse } from '@alliance-risk/shared';

export interface PaginatedUsers {
  users: CognitoUser[];
  paginationToken?: string;
}

@Injectable()
export class CognitoService implements OnModuleInit {
  private readonly logger = new Logger(CognitoService.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;
  private readonly region: string;
  private jwksClient?: JwksClient;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.userPoolId = this.configService.get<string>('COGNITO_USER_POOL_ID', '');
    this.clientId = this.configService.get<string>('COGNITO_CLIENT_ID', '');

    this.client = new CognitoIdentityProviderClient({ region: this.region });
  }

  onModuleInit(): void {
    const environment = this.configService.get<string>('ENVIRONMENT', 'development');

    if (!environment) {
      this.logger.warn('ENVIRONMENT is not set — defaulting to development mode (no JWT verification)');
    }

    if (environment === 'production') {
      if (!this.userPoolId || !this.clientId) {
        throw new Error(
          'COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set when ENVIRONMENT=production',
        );
      }

      // Initialize JWKS client for production token verification
      const jwksUri = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}/.well-known/jwks.json`;
      this.jwksClient = new JwksClient({
        jwksUri,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 600000, // 10 minutes
      });

      this.logger.log(`Production mode: JWKS verification enabled (pool: ${this.userPoolId})`);
    } else {
      this.logger.warn(
        `Running in ${environment} mode — JWT tokens are decoded without signature verification`,
      );
    }
  }

  // ─── Auth Methods ────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const command = new AdminInitiateAuthCommand({
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const response = await this.client.send(command);

      // Handle NEW_PASSWORD_REQUIRED challenge
      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        return {
          requiresPasswordChange: true,
          session: response.Session!,
          username: email,
        };
      }

      const tokens = response.AuthenticationResult!;
      return {
        accessToken: tokens.AccessToken!,
        refreshToken: tokens.RefreshToken!,
        expiresIn: tokens.ExpiresIn!,
        requiresPasswordChange: false,
      };
    } catch (error) {
      const err = error as { name: string; message?: string };
      if (err.name === 'UserNotFoundException') {
        // Return generic credential error to prevent user enumeration
        throw new CognitoException('Invalid credentials', 'NotAuthorizedException', 401);
      }
      throw CognitoException.fromCognitoError(err);
    }
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      const command = new AdminInitiateAuthCommand({
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const response = await this.client.send(command);
      const tokens = response.AuthenticationResult!;

      return {
        accessToken: tokens.AccessToken!,
        refreshToken: refreshToken, // Cognito doesn't return a new refresh token
        expiresIn: tokens.ExpiresIn!,
        requiresPasswordChange: false,
      };
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      // Look up username by email
      const listCommand = new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Filter: `email = "${email}"`,
        Limit: 1,
      });
      const listResponse = await this.client.send(listCommand);

      const username =
        listResponse.Users?.[0]?.Username ?? email;

      const command = new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: username,
      });

      await this.client.send(command);
    } catch (error) {
      const err = error as { name: string; message?: string };
      // Silently fail if user not found to prevent enumeration
      if (err.name === 'UserNotFoundException') {
        return;
      }
      throw CognitoException.fromCognitoError(err);
    }
  }

  async resetPassword(username: string, code: string, newPassword: string): Promise<void> {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: username,
        ConfirmationCode: code,
        Password: newPassword,
      });

      await this.client.send(command);
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async completePasswordChange(
    username: string,
    session: string,
    newPassword: string,
  ): Promise<LoginResponse> {
    try {
      const command = new AdminRespondToAuthChallengeCommand({
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: newPassword,
        },
        Session: session,
      });

      const response = await this.client.send(command);
      const tokens = response.AuthenticationResult!;

      return {
        accessToken: tokens.AccessToken!,
        refreshToken: tokens.RefreshToken!,
        expiresIn: tokens.ExpiresIn!,
        requiresPasswordChange: false,
      };
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async changePassword(
    accessToken: string,
    previousPassword: string,
    proposedPassword: string,
  ): Promise<void> {
    try {
      const command = new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: previousPassword,
        ProposedPassword: proposedPassword,
      });

      await this.client.send(command);
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async getCurrentUser(accessToken: string): Promise<CognitoUser> {
    try {
      const userCommand = new GetUserCommand({ AccessToken: accessToken });
      const userResponse = await this.client.send(userCommand);

      const username = userResponse.Username!;
      const attrs = userResponse.UserAttributes ?? [];
      const email = attrs.find((a) => a.Name === 'email')?.Value ?? '';

      // Get groups for admin check
      const groupsCommand = new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });
      const groupsResponse = await this.client.send(groupsCommand);
      const groups = (groupsResponse.Groups ?? []).map((g) => g.GroupName!);

      return {
        username,
        email,
        enabled: true,
        userStatus: 'CONFIRMED',
        groups,
        attributes: Object.fromEntries(attrs.map((a) => [a.Name!, a.Value ?? ''])),
        isAdmin: groups.includes('admin'),
        createdDate: new Date().toISOString(),
        lastModifiedDate: new Date().toISOString(),
      };
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async verifyToken(token: string): Promise<TokenClaims> {
    const environment = this.configService.get<string>('ENVIRONMENT', 'development');

    if (environment === 'production') {
      return this.verifyWithJwks(token);
    }

    // Development/testing: decode without verification
    return this.decodeToken(token);
  }

  // ─── Admin Methods ───────────────────────────────────────────────────────────

  async listUsers(limit = 60, paginationToken?: string): Promise<PaginatedUsers> {
    if (!this.userPoolId) {
      return { users: [], paginationToken: undefined };
    }
    try {
      const command = new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Limit: limit,
        PaginationToken: paginationToken,
      });

      const response = await this.client.send(command);
      const users = await Promise.all(
        (response.Users ?? []).map((u) => this.mapCognitoUserWithGroups(u.Username!)),
      );

      return {
        users,
        paginationToken: response.PaginationToken,
      };
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async getUser(username: string): Promise<CognitoUser> {
    try {
      const userCommand = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });
      const userResponse = await this.client.send(userCommand);

      const groupsCommand = new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });
      const groupsResponse = await this.client.send(groupsCommand);
      const groups = (groupsResponse.Groups ?? []).map((g) => g.GroupName!);

      const attrs = userResponse.UserAttributes ?? [];
      const email = attrs.find((a) => a.Name === 'email')?.Value ?? '';

      return {
        username,
        email,
        enabled: userResponse.Enabled ?? true,
        userStatus: userResponse.UserStatus ?? 'UNKNOWN',
        groups,
        attributes: Object.fromEntries(attrs.map((a) => [a.Name!, a.Value ?? ''])),
        isAdmin: groups.includes('admin'),
        createdDate: userResponse.UserCreateDate?.toISOString() ?? new Date().toISOString(),
        lastModifiedDate: userResponse.UserLastModifiedDate?.toISOString() ?? new Date().toISOString(),
      };
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async createUser(
    email: string,
    tempPassword: string,
    sendEmail = true,
  ): Promise<CognitoUser> {
    try {
      const createCommand = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        TemporaryPassword: tempPassword,
        MessageAction: sendEmail ? undefined : MessageActionType.SUPPRESS,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
      });

      const createResponse = await this.client.send(createCommand);
      const cognitoUser = createResponse.User!;

      // Set password as non-permanent (force change on first login)
      const setPwCommand = new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        Password: tempPassword,
        Permanent: false,
      });
      await this.client.send(setPwCommand);

      const attrs = cognitoUser.Attributes ?? [];

      return {
        username: cognitoUser.Username!,
        email,
        enabled: cognitoUser.Enabled ?? true,
        userStatus: cognitoUser.UserStatus ?? 'FORCE_CHANGE_PASSWORD',
        groups: [],
        attributes: Object.fromEntries(attrs.map((a) => [a.Name!, a.Value ?? ''])),
        isAdmin: false,
        createdDate: cognitoUser.UserCreateDate?.toISOString() ?? new Date().toISOString(),
        lastModifiedDate: cognitoUser.UserLastModifiedDate?.toISOString() ?? new Date().toISOString(),
      };
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async updateUser(
    username: string,
    attributes: Record<string, string>,
  ): Promise<void> {
    try {
      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({ Name, Value })),
      });

      await this.client.send(command);
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async deleteUser(username: string): Promise<void> {
    try {
      const command = new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      await this.client.send(command);
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async enableUser(username: string): Promise<void> {
    try {
      const command = new AdminEnableUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      await this.client.send(command);
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async disableUser(username: string): Promise<void> {
    try {
      const command = new AdminDisableUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      await this.client.send(command);
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async resetUserPassword(username: string, tempPassword: string): Promise<void> {
    try {
      const command = new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        Password: tempPassword,
        Permanent: false,
      });

      await this.client.send(command);
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async listGroups(): Promise<string[]> {
    if (!this.userPoolId) {
      return [];
    }
    try {
      const command = new ListGroupsCommand({
        UserPoolId: this.userPoolId,
      });

      const response = await this.client.send(command);
      return (response.Groups ?? []).map((g) => g.GroupName!);
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async addUserToGroup(username: string, groupName: string): Promise<void> {
    try {
      const command = new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: groupName,
      });

      await this.client.send(command);
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  async removeUserFromGroup(username: string, groupName: string): Promise<void> {
    try {
      const command = new AdminRemoveUserFromGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: groupName,
      });

      await this.client.send(command);
    } catch (error) {
      throw CognitoException.fromCognitoError(error as { name: string; message?: string });
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async mapCognitoUserWithGroups(username: string): Promise<CognitoUser> {
    try {
      const userCommand = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });
      const userResponse = await this.client.send(userCommand);

      const groupsCommand = new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });
      const groupsResponse = await this.client.send(groupsCommand);
      const groups = (groupsResponse.Groups ?? []).map((g) => g.GroupName!);

      const attrs = userResponse.UserAttributes ?? [];
      const email = attrs.find((a) => a.Name === 'email')?.Value ?? '';

      return {
        username,
        email,
        enabled: userResponse.Enabled ?? true,
        userStatus: userResponse.UserStatus ?? 'UNKNOWN',
        groups,
        attributes: Object.fromEntries(attrs.map((a) => [a.Name!, a.Value ?? ''])),
        isAdmin: groups.includes('admin'),
        createdDate: userResponse.UserCreateDate?.toISOString() ?? new Date().toISOString(),
        lastModifiedDate: userResponse.UserLastModifiedDate?.toISOString() ?? new Date().toISOString(),
      };
    } catch {
      // Return minimal user info on error
      return {
        username,
        email: '',
        enabled: true,
        userStatus: 'UNKNOWN',
        groups: [],
        attributes: {},
        isAdmin: false,
        createdDate: new Date().toISOString(),
        lastModifiedDate: new Date().toISOString(),
      };
    }
  }

  private decodeToken(token: string): TokenClaims {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as Record<string, unknown>;

      // Always validate expiry, even in dev mode
      const exp = payload['exp'] as number | undefined;
      if (exp && Date.now() / 1000 > exp) {
        throw new CognitoException('Token expired', 'TOKEN_EXPIRED', 401);
      }

      return this.mapPayloadToUser(payload);
    } catch (error) {
      if (error instanceof CognitoException) throw error;
      throw new CognitoException('Invalid token format', 'INVALID_TOKEN', 401);
    }
  }

  private async verifyWithJwks(token: string): Promise<TokenClaims> {
    if (!this.jwksClient) {
      throw new Error('JWKS client not initialized — verifyToken called before onModuleInit');
    }

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header?.kid) {
      throw new CognitoException('Invalid token', 'INVALID_TOKEN', 401);
    }

    const key = await this.jwksClient.getSigningKey(decoded.header.kid);
    const publicKey = key.getPublicKey();

    try {
      const payload = jwt.verify(token, publicKey, {
        issuer: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`,
      }) as Record<string, unknown>;

      return this.mapPayloadToUser(payload);
    } catch {
      throw new CognitoException('Token verification failed', 'TOKEN_VERIFICATION_FAILED', 401);
    }
  }

  private mapPayloadToUser(payload: Record<string, unknown>): TokenClaims {
    const sub = payload['sub'] as string | undefined;
    const email =
      (payload['email'] as string | undefined) ??
      (payload['username'] as string | undefined) ??
      '';
    const username =
      (payload['cognito:username'] as string | undefined) ??
      (payload['username'] as string | undefined) ??
      email;
    const groups =
      (payload['cognito:groups'] as string[] | undefined) ?? [];
    const isAdmin = groups.includes('admin');

    return {
      userId: sub ?? username,
      email,
      username,
      isAdmin,
    };
  }
}
