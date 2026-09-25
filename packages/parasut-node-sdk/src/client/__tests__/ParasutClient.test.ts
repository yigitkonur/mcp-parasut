import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParasutClient } from '../ParasutClient.js';
import { ParasutConfigError } from '../errors.js';

describe('ParasutClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('initializes with static accessToken without credentials or companyId', () => {
      const client = new ParasutClient({
        accessToken: 'static-token-123',
      });

      expect(client.companyId).toBeUndefined();
      expect(client.oauthManager).toBeUndefined();
    });

    it('initializes with refreshToken + clientId + clientSecret setting up OAuthManager', () => {
      const client = new ParasutClient({
        refreshToken: 'refresh-token-xyz',
        credentials: {
          clientId: 'cid',
          clientSecret: 'csec',
        },
      });

      expect(client.oauthManager).toBeDefined();
    });

    it('initializes with accessToken + refreshToken + clientId + clientSecret', () => {
      const client = new ParasutClient({
        accessToken: 'initial-acc',
        refreshToken: 'initial-ref',
        credentials: {
          clientId: 'cid',
          clientSecret: 'csec',
        },
      });

      expect(client.oauthManager).toBeDefined();
    });

    it('initializes with credentials including refreshToken', () => {
      const client = new ParasutClient({
        credentials: {
          clientId: 'cid',
          clientSecret: 'csec',
          refreshToken: 'cred-ref',
        },
      });

      expect(client.oauthManager).toBeDefined();
    });

    it('initializes with credentials for password grant', () => {
      const client = new ParasutClient({
        companyId: 100,
        credentials: {
          clientId: 'cid',
          clientSecret: 'csec',
          username: 'user@example.com',
          password: 'secret-password',
        },
      });

      expect(client.companyId).toBe(100);
      expect(client.oauthManager).toBeDefined();
    });

    it('throws error when no authentication method is provided', () => {
      expect(() => {
        new ParasutClient({});
      }).toThrow(ParasutConfigError);
    });
  });

  describe('Company ID Resolution & getMe()', () => {
    it('discovers and sets companyId from JSON:API included array in getMe()', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/me')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/vnd.api+json' }),
            text: async () =>
              JSON.stringify({
                data: {
                  id: '1',
                  type: 'users',
                  attributes: { email: 'user@test.com' },
                  relationships: {
                    companies: {
                      data: [{ id: '12345', type: 'companies' }],
                    },
                  },
                },
                included: [
                  {
                    id: '12345',
                    type: 'companies',
                    attributes: { name: 'Acme Corp' },
                  },
                ],
              }),
          };
        }
        return { ok: false, status: 404, headers: new Headers(), text: async () => '' };
      });

      const client = new ParasutClient({
        accessToken: 'my-token',
        fetch: mockFetch as typeof fetch,
      });

      expect(client.companyId).toBeUndefined();

      const me = await client.getMe();

      expect(me.data.id).toBe('1');
      expect(client.companyId).toBe(12345);
    });

    it('discovers and sets companyId from relationships if included is not present', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/vnd.api+json' }),
        text: async () =>
          JSON.stringify({
            data: {
              id: '1',
              type: 'users',
              relationships: {
                companies: {
                  data: [{ id: '67890', type: 'companies' }],
                },
              },
            },
          }),
      });

      const client = new ParasutClient({
        accessToken: 'my-token',
        fetch: mockFetch as typeof fetch,
      });

      await client.getMe();
      expect(client.companyId).toBe(67890);
    });

    it('preserves existing companyId if already configured and does not override', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/vnd.api+json' }),
        text: async () =>
          JSON.stringify({
            data: { id: '1', type: 'users' },
            included: [{ id: '99999', type: 'companies' }],
          }),
      });

      const client = new ParasutClient({
        companyId: 54321,
        accessToken: 'my-token',
        fetch: mockFetch as typeof fetch,
      });

      await client.getMe();
      expect(client.companyId).toBe(54321);
    });

    it('resolveCompanyId returns companyId if set or fetches getMe()', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/vnd.api+json' }),
        text: async () =>
          JSON.stringify({
            data: { id: '1', type: 'users' },
            included: [{ id: '8888', type: 'companies' }],
          }),
      });

      const client = new ParasutClient({
        accessToken: 'token',
        fetch: mockFetch as typeof fetch,
      });

      const resolved = await client.resolveCompanyId();
      expect(resolved).toBe(8888);
      expect(client.companyId).toBe(8888);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Calling again should not make additional requests
      const resolvedAgain = await client.resolveCompanyId();
      expect(resolvedAgain).toBe(8888);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws error when resolveCompanyId finds no companies', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/vnd.api+json' }),
        text: async () => JSON.stringify({ data: { id: '1', type: 'users' } }),
      });

      const client = new ParasutClient({
        accessToken: 'token',
        fetch: mockFetch as typeof fetch,
      });

      await expect(client.resolveCompanyId()).rejects.toThrow(ParasutConfigError);
    });
  });

  describe('Resource Access & Company ID Validation', () => {
    it('throws error when accessing resources without companyId set', () => {
      const client = new ParasutClient({
        accessToken: 'token',
      });

      expect(() => client.contacts).toThrow(ParasutConfigError);
      expect(() => client.trackableJobs).toThrow(ParasutConfigError);
      expect(() => client.salesInvoices).toThrow(ParasutConfigError);
    });

    it('allows accessing resources once companyId is set', () => {
      const client = new ParasutClient({
        accessToken: 'token',
      });

      client.companyId = 12345;
      expect(() => client.contacts).not.toThrow();
      expect(() => client.salesInvoices).not.toThrow();
      expect(() => client.trackableJobs).not.toThrow();
    });

    it('resets cached resources when companyId is updated', () => {
      const client = new ParasutClient({
        companyId: 100,
        accessToken: 'token',
      });

      const contactsFirst = client.contacts;
      client.companyId = 200;
      const contactsSecond = client.contacts;

      // New resource instance should have been created with updated companyId
      expect(contactsFirst).not.toBe(contactsSecond);
    });
  });

  describe('Request Authorization & Transport Interceptor', () => {
    it('adds Authorization Bearer header to requests using static accessToken', async () => {
      let authHeader: string | null = null;

      const mockFetch = vi.fn().mockImplementation(async (_url, init) => {
        authHeader = init.headers?.Authorization ?? init.headers?.['Authorization'] ?? null;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/vnd.api+json' }),
          text: async () => JSON.stringify({ data: [] }),
        };
      });

      const client = new ParasutClient({
        companyId: 123,
        accessToken: 'my-bearer-secret',
        fetch: mockFetch as typeof fetch,
      });

      await client.contacts.list();

      expect(authHeader).toBe('Bearer my-bearer-secret');
    });

    it('adds Authorization Bearer header using token refreshed from OAuthManager', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        // OAuth token refresh endpoint
        if (url.includes('/oauth/token')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              access_token: 'refreshed-bearer-token',
              refresh_token: 'next-refresh-token',
              expires_in: 7200,
              token_type: 'bearer',
            }),
            text: async () =>
              JSON.stringify({
                access_token: 'refreshed-bearer-token',
                refresh_token: 'next-refresh-token',
                expires_in: 7200,
                token_type: 'bearer',
              }),
          };
        }

        // API resource request
        const reqHeaders = (init?.headers as Record<string, string>) || {};
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/vnd.api+json' }),
          text: async () => JSON.stringify({ data: [], authUsed: reqHeaders['Authorization'] }),
        };
      });

      const client = new ParasutClient({
        companyId: 456,
        refreshToken: 'my-refresh-token',
        credentials: {
          clientId: 'cid',
          clientSecret: 'csec',
        },
        fetch: mockFetch as typeof fetch,
      });

      const response = await client.contacts.list();
      expect(response).toBeDefined();

      // Check second call was to API endpoint with refreshed token
      const [, apiCallInit] = mockFetch.mock.calls[1] as [string, RequestInit];
      const headers = apiCallInit.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer refreshed-bearer-token');
    });
  });
});
