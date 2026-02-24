import { tokenManager } from '../token-manager';

describe('TokenManager', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    tokenManager.clearTokens();
  });

  describe('setTokens with rememberMe=true', () => {
    it('should store tokens in localStorage', () => {
      tokenManager.setTokens(
        { accessToken: 'test-access', refreshToken: 'test-refresh' },
        true,
      );
      expect(localStorage.getItem('access_token')).toBe('test-access');
      expect(localStorage.getItem('refresh_token')).toBe('test-refresh');
    });
  });

  describe('setTokens with rememberMe=false', () => {
    it('should store tokens in sessionStorage', () => {
      tokenManager.setTokens(
        { accessToken: 'test-access', refreshToken: 'test-refresh' },
        false,
      );
      expect(sessionStorage.getItem('access_token')).toBe('test-access');
      expect(sessionStorage.getItem('refresh_token')).toBe('test-refresh');
    });
  });

  describe('getAccessToken', () => {
    it('should return null when no token is stored', () => {
      expect(tokenManager.getAccessToken()).toBeNull();
    });

    it('should return the stored access token', () => {
      localStorage.setItem('access_token', 'my-token');
      expect(tokenManager.getAccessToken()).toBe('my-token');
    });
  });

  describe('clearTokens', () => {
    it('should remove tokens from both storages', () => {
      localStorage.setItem('access_token', 'a');
      sessionStorage.setItem('access_token', 'b');
      tokenManager.clearTokens();
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(sessionStorage.getItem('access_token')).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token exists', () => {
      expect(tokenManager.isAuthenticated()).toBe(false);
    });

    it('should return true when a token exists', () => {
      localStorage.setItem('access_token', 'test');
      expect(tokenManager.isAuthenticated()).toBe(true);
    });
  });
});
