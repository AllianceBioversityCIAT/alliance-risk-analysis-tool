'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import type { UserInfo, LoginResponse, CognitoUser } from '@alliance-risk/shared';
import apiClient from '@/lib/api-client';
import { tokenManager } from '@/lib/token-manager';

interface LoginResult {
  success: boolean;
  requiresPasswordChange?: boolean;
  session?: string;
  username?: string;
}

interface AuthContextValue {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    rememberMe: boolean,
  ) => Promise<LoginResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function cognitoUserToUserInfo(u: CognitoUser): UserInfo {
  return {
    userId: u.username,
    email: u.email,
    username: u.username,
    role: u.isAdmin ? 'admin' : 'user',
    isAdmin: u.isAdmin ?? false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Initialize user from existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      if (tokenManager.isAuthenticated()) {
        try {
          const response = await apiClient.get<CognitoUser>('/api/auth/me');
          setUser(cognitoUserToUserInfo(response.data));
        } catch {
          tokenManager.clearTokens();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Cross-tab sync: detect logout from another tab
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'access_token' && event.newValue === null) {
        setUser(null);
        router.push('/login');
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [router]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      rememberMe: boolean,
    ): Promise<LoginResult> => {
      const response = await apiClient.post<LoginResponse>(
        '/api/auth/login',
        { email, password },
      );

      const data = response.data;

      if (data.requiresPasswordChange) {
        return {
          success: true,
          requiresPasswordChange: true,
          session: data.session,
          username: data.username,
        };
      }

      tokenManager.setTokens(
        {
          accessToken: data.accessToken ?? '',
          refreshToken: data.refreshToken ?? '',
        },
        rememberMe,
      );

      // Fetch the full user profile now that we have a valid token
      const meResponse = await apiClient.get<CognitoUser>('/api/auth/me');
      setUser(cognitoUserToUserInfo(meResponse.data));
      return { success: true };
    },
    [],
  );

  const logout = useCallback(() => {
    tokenManager.clearTokens();
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.isAdmin ?? false,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
