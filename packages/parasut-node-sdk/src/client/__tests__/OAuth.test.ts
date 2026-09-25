import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OAuthManager,
  MemoryTokenStorage,
  type OAuthCredentials,
  type OAuthToken,
  type TokenStorage,
} from '../OAuth.js';
import { ParasutAuthError, ParasutConfigError } from '../errors.js';

describe('OAuthManager', () => {
  const defaultCredentials: OAuthCredentials = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    username: 'test@example.com',
    password: 'secret-password',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization and Configuration Validation', () => {
    it('throws error if clientId is missing', () => {
      expect(() => {
        new OAuthManager({
          clientId: '',
          clientSecret: 'secret',
          username: 'user',
          password: 'pw',
        });
      }).toThrow(ParasutConfigError);
    });

    it('throws error if clientSecret is missing', () => {
      expect(() => {
        new OAuthManager({
          clientId: 'id',
          clientSecret: '',
          username: 'user',
          password: 'pw',
        });
      }).toThrow(ParasutConfigError);
    });

    it('throws error if username and password are missing and no token is provided', () => {
      expect(() => {
        new OAuthManager({
          clientId: 'id',
          clientSecret: 'secret',
        });
      }).toThrow(ParasutConfigError);
    });

    it('allows initialization with refreshToken in credentials without username/password', () => {
      expect(() => {
        new OAuthManager({
          clientId: 'id',
          clientSecret: 'secret',
          refreshToken: 'refresh-token-123',
        });
      }).not.toThrow();
    });

    it('allows initialization with refreshToken in options without username/password', () => {
      expect(() => {
        new OAuthManager(
          {
            clientId: 'id',
            clientSecret: 'secret',
          },
          {
            refreshToken: 'refresh-token-123',
          }
        );
      }).not.toThrow();
    });

    it('allows initialization with accessToken in options without username/password', () => {
      expect(() => {
        new OAuthManager(
          {
            clientId: 'id',
            clientSecret: 'secret',
          },
          {
            accessToken: 'static-access-token',
          }
        );
      }).not.toThrow();
    });
  });

  describe('Preloaded Token Behavior', () => {
    it('returns preloaded valid access token without making network calls', async () => {
      const mockFetch = vi.fn();

      const oauth = new OAuthManager(
        {
          clientId: 'id',
          clientSecret: 'secret',
        },
        {
          accessToken: 'preloaded-access-token',
          refreshToken: 'preloaded-refresh-token',
          expiresIn: 7200,
          fetch: mockFetch as typeof fetch,
        }
      );

      const token = await oauth.getValidToken();
      expect(token).toBe('preloaded-access-token');
      expect(mockFetch).not.toHaveBeenCalled();

      const stored = await oauth.getToken();
      expect(stored).toEqual(
        expect.objectContaining({
          accessToken: 'preloaded-access-token',
          refreshToken: 'preloaded-refresh-token',
          tokenType: 'bearer',
        })
      );
    });

    it('preloads into custom TokenStorage', async () => {
      let savedToken: OAuthToken | null = null;
      const customStorage: TokenStorage = {
        async get() {
          return savedToken;
        },
        async set(token: OAuthToken) {
          savedToken = token;
        },
        async clear() {
          savedToken = null;
        },
      };

      const oauth = new OAuthManager(
        {
          clientId: 'id',
          clientSecret: 'secret',
        },
        {
          accessToken: 'custom-storage-token',
          refreshToken: 'custom-refresh-token',
          storage: customStorage,
        }
      );

      const token = await oauth.getValidToken();
      expect(token).toBe('custom-storage-token');
      expect(savedToken).toEqual(
        expect.objectContaining({
          accessToken: 'custom-storage-token',
          refreshToken: 'custom-refresh-token',
        })
      );
    });
  });

  describe('Refresh Token Flow', () => {
    it('automatically refreshes token when only refreshToken is provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token-from-refresh',
          refresh_token: 'new-refresh-token',
          expires_in: 7200,
          token_type: 'bearer',
        }),
      });

      const oauth = new OAuthManager(
        {
          clientId: 'my-client-id',
          clientSecret: 'my-client-secret',
          refreshToken: 'initial-refresh-token',
        },
        {
          fetch: mockFetch as typeof fetch,
        }
      );

      const token = await oauth.getValidToken();

      expect(token).toBe('new-access-token-from-refresh');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe('https://api.parasut.com/oauth/token');
      expect(calledInit.method).toBe('POST');
      expect(calledInit.headers).toEqual(
        expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        })
      );

      const bodyParams = new URLSearchParams(calledInit.body as string);
      expect(bodyParams.get('grant_type')).toBe('refresh_token');
      expect(bodyParams.get('client_id')).toBe('my-client-id');
      expect(bodyParams.get('client_secret')).toBe('my-client-secret');
      expect(bodyParams.get('refresh_token')).toBe('initial-refresh-token');

      // Subsequent calls should use cached token without additional fetch
      const tokenSecondTime = await oauth.getValidToken();
      expect(tokenSecondTime).toBe('new-access-token-from-refresh');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('refreshes token when preloaded access token has expired', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-token-after-expiry',
          refresh_token: 'refreshed-refresh-token',
          expires_in: 7200,
          token_type: 'bearer',
        }),
      });

      const storage = new MemoryTokenStorage();
      // Pre-set an expired token in storage
      await storage.set({
        accessToken: 'expired-access-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: Date.now() - 1000, // expired 1s ago
        tokenType: 'bearer',
      });

      const oauth = new OAuthManager(
        {
          clientId: 'client-id',
          clientSecret: 'client-secret',
        },
        {
          storage,
          fetch: mockFetch as typeof fetch,
          refreshToken: 'valid-refresh-token',
        }
      );

      const token = await oauth.getValidToken();
      expect(token).toBe('refreshed-token-after-expiry');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent refresh requests', async () => {
      let resolveFetch: (val: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      const mockFetch = vi.fn().mockImplementation(() => fetchPromise);

      const oauth = new OAuthManager(
        {
          clientId: 'id',
          clientSecret: 'secret',
          refreshToken: 'ref-token',
        },
        {
          fetch: mockFetch as typeof fetch,
        }
      );

      // Launch 4 concurrent getValidToken calls
      const p1 = oauth.getValidToken();
      const p2 = oauth.getValidToken();
      const p3 = oauth.getValidToken();
      const p4 = oauth.getValidToken();

      resolveFetch!({
        ok: true,
        json: async () => ({
          access_token: 'concurrent-token',
          refresh_token: 'concurrent-ref',
          expires_in: 7200,
          token_type: 'bearer',
        }),
      });

      const results = await Promise.all([p1, p2, p3, p4]);

      expect(results).toEqual([
        'concurrent-token',
        'concurrent-token',
        'concurrent-token',
        'concurrent-token',
      ]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws ParasutAuthError when refresh fails and username/password are not provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => JSON.stringify({ error: 'invalid_grant', error_description: 'Token expired' }),
      });

      const oauth = new OAuthManager(
        {
          clientId: 'id',
          clientSecret: 'secret',
          refreshToken: 'bad-token',
        },
        {
          fetch: mockFetch as typeof fetch,
        }
      );

      await expect(oauth.getValidToken()).rejects.toThrow(ParasutAuthError);
    });

    it('falls back to password grant when refresh fails and credentials are provided', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async (_url, init) => {
        callCount++;
        const body = new URLSearchParams(init.body as string);
        const grantType = body.get('grant_type');

        if (grantType === 'refresh_token') {
          return {
            ok: false,
            text: async () => JSON.stringify({ error: 'invalid_grant', error_description: 'Revoked' }),
          };
        }

        if (grantType === 'password') {
          return {
            ok: true,
            json: async () => ({
              access_token: 'password-grant-fallback-token',
              refresh_token: 'new-refresh-token',
              expires_in: 7200,
              token_type: 'bearer',
            }),
          };
        }

        return { ok: false, text: async () => 'Unknown grant' };
      });

      const oauth = new OAuthManager(
        {
          ...defaultCredentials,
          refreshToken: 'expired-ref-token',
        },
        {
          fetch: mockFetch as typeof fetch,
        }
      );

      const token = await oauth.getValidToken();
      expect(token).toBe('password-grant-fallback-token');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Password Grant Flow', () => {
    it('authenticates with username and password when no token is present', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'password-grant-token',
          refresh_token: 'pw-refresh-token',
          expires_in: 7200,
          token_type: 'bearer',
        }),
      });

      const oauth = new OAuthManager(defaultCredentials, {
        fetch: mockFetch as typeof fetch,
      });

      const token = await oauth.getValidToken();
      expect(token).toBe('password-grant-token');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
      const bodyParams = new URLSearchParams(calledInit.body as string);
      expect(bodyParams.get('grant_type')).toBe('password');
      expect(bodyParams.get('username')).toBe('test@example.com');
      expect(bodyParams.get('password')).toBe('secret-password');
    });

    it('throws error when authenticate() is called without username and password', async () => {
      const oauth = new OAuthManager({
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'ref-only',
      });

      await expect(oauth.authenticate()).rejects.toThrow(ParasutConfigError);
    });
  });
});
