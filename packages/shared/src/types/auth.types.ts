export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: UserInfo;
  expiresIn?: number;
  requiresPasswordChange?: boolean;
  session?: string;
  username?: string;
}

export interface UserInfo {
  userId: string;
  email: string;
  username: string;
  role: string;
  isAdmin: boolean;
}

export interface CognitoUser {
  username: string;
  email: string;
  emailVerified?: boolean;
  enabled: boolean;
  userStatus: string;
  createdDate?: string;
  lastModifiedDate?: string;
  groups: string[];
  isAdmin?: boolean;
  attributes?: Record<string, string>;
  /** @deprecated Use userStatus */
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}
