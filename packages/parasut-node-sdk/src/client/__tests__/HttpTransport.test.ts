import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpTransport, getProxyUrl } from '../HttpTransport.js';

describe('HttpTransport', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Proxy URL Detection', () => {
    it('detects HTTPS_PROXY from environment', () => {
      process.env['HTTPS_PROXY'] = 'http://proxy.corporate.local:8080';
      expect(getProxyUrl()).toBe('http://proxy.corporate.local:8080');
    });

    it('detects https_proxy from environment', () => {
      delete process.env['HTTPS_PROXY'];
      process.env['https_proxy'] = 'http://proxy2.corporate.local:8080';
      expect(getProxyUrl()).toBe('http://proxy2.corporate.local:8080');
    });

    it('returns undefined when no proxy env is set', () => {
      delete process.env['HTTPS_PROXY'];
      delete process.env['https_proxy'];
      delete process.env['HTTP_PROXY'];
      delete process.env['http_proxy'];
      delete process.env['ALL_PROXY'];
      delete process.env['all_proxy'];
      expect(getProxyUrl()).toBeUndefined();
    });
  });

  describe('Custom Fetch and Options', () => {
    it('uses custom fetch and passes custom fetchOptions', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/vnd.api+json' }),
        text: async () => JSON.stringify({ data: 'ok' }),
      });

      const transport = new HttpTransport({
        baseUrl: 'https://api.parasut.com/v4',
        timeout: 5000,
        fetch: mockFetch as typeof fetch,
        fetchOptions: {
          customOption: 'test-value',
        },
      });

      const result = await transport.get('/contacts');
      expect(result).toEqual({ data: 'ok' });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, Record<string, any>];
      expect(calledUrl).toBe('https://api.parasut.com/v4/contacts');
      expect(calledInit['customOption']).toBe('test-value');
      expect(calledInit['headers']).toEqual(
        expect.objectContaining({
          Accept: 'application/vnd.api+json',
        })
      );
    });
  });
});
