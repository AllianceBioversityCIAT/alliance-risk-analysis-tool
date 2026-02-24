'use client';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

class TokenManager {
  private storage: Storage | null = null;

  private getStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    return this.storage ?? localStorage;
  }

  setTokens(tokens: Tokens, rememberMe: boolean): void {
    if (typeof window === 'undefined') return;
    this.storage = rememberMe ? localStorage : sessionStorage;
    this.storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    this.storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }

  getAccessToken(): string | null {
    const storage = this.getStorage();
    if (!storage) return null;
    return (
      localStorage.getItem(ACCESS_TOKEN_KEY) ??
      sessionStorage.getItem(ACCESS_TOKEN_KEY)
    );
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return (
      localStorage.getItem(REFRESH_TOKEN_KEY) ??
      sessionStorage.getItem(REFRESH_TOKEN_KEY)
    );
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    this.storage = null;
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

export const tokenManager = new TokenManager();
