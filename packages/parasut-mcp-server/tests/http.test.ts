import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type http from 'node:http';
import { createHttpServer } from '../src/http.js';
import type { ServerConfig } from '../src/config.js';

describe('Streamable HTTP Server Transport & OAuth 2.0 Flow', () => {
  let server: http.Server;
  let baseUrl: string;
  const testPort = 3987;

  const mockConfig: ServerConfig = {
    parasut: {
      companyId: 12345,
      accessToken: 'mock-access-token',
    },
    debug: false,
    http: {
      port: testPort,
      host: '127.0.0.1',
      apiKey: 'test-secret-key',
      corsOrigin: '*',
      publicUrl: 'http://127.0.0.1:3987',
    },
  };

  before(async () => {
    server = createHttpServer(mockConfig, { port: testPort, host: '127.0.0.1' });
    await new Promise<void>((resolve) => {
      server.listen(testPort, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${testPort}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /health returns 200 OK without requiring authentication', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const json = (await res.json()) as { status: string; server: string; oauth: boolean };
    assert.equal(json.status, 'ok');
    assert.equal(json.server, 'parasut-mcp-server');
    assert.equal(json.oauth, true);
  });

  it('GET / returns 200 OK with server metadata and oauth endpoints', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const json = (await res.json()) as { endpoint: string; authRequired: boolean; oauth: any };
    assert.equal(json.endpoint, '/mcp');
    assert.equal(json.authRequired, true);
    assert.ok(json.oauth.protectedResourceMetadata);
    assert.ok(json.oauth.authorizationServerMetadata);
  });

  it('OPTIONS /mcp returns 204 with CORS headers', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'OPTIONS',
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.ok(res.headers.get('access-control-allow-methods')?.includes('POST'));
    assert.ok(res.headers.get('access-control-expose-headers')?.includes('mcp-session-id'));
  });

  it('POST /mcp returns 401 with WWW-Authenticate header when Authorization header is missing', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      }),
    });

    assert.equal(res.status, 401);
    const wwwAuth = res.headers.get('www-authenticate');
    assert.ok(wwwAuth, 'Must include WWW-Authenticate header');
    assert.ok(wwwAuth.includes('resource_metadata='), 'Must include resource_metadata URL parameter');
    assert.ok(wwwAuth.includes('/.well-known/oauth-protected-resource'));
  });

  it('RFC 9728: GET /.well-known/oauth-protected-resource returns valid Protected Resource Metadata', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    assert.equal(res.status, 200);
    const meta = (await res.json()) as any;
    assert.equal(meta.resource, `${baseUrl}/mcp`);
    assert.ok(Array.isArray(meta.authorization_servers));
    assert.ok(meta.authorization_servers.includes(baseUrl));
    assert.ok(Array.isArray(meta.scopes_supported));
  });

  it('RFC 9728: GET /.well-known/oauth-protected-resource/mcp returns valid Protected Resource Metadata', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    assert.equal(res.status, 200);
    const meta = (await res.json()) as any;
    assert.equal(meta.resource, `${baseUrl}/mcp`);
  });

  it('RFC 8414: GET /.well-known/oauth-authorization-server returns valid AS Metadata', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    assert.equal(res.status, 200);
    const meta = (await res.json()) as any;
    assert.equal(meta.issuer, baseUrl);
    assert.equal(meta.authorization_endpoint, `${baseUrl}/oauth/authorize`);
    assert.equal(meta.token_endpoint, `${baseUrl}/oauth/token`);
    assert.equal(meta.registration_endpoint, `${baseUrl}/oauth/register`);
    assert.ok(meta.code_challenge_methods_supported.includes('S256'));
    assert.ok(meta.grant_types_supported.includes('authorization_code'));
  });

  it('RFC 7591: POST /oauth/register requires Initial Access Token and registers client when valid', async () => {
    // 1. Unauthorized attempt without token
    const unauthRes = await fetch(`${baseUrl}/oauth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'malicious-client',
      }),
    });
    assert.equal(unauthRes.status, 401);
    const wwwAuth = unauthRes.headers.get('www-authenticate');
    assert.ok(wwwAuth && wwwAuth.includes('invalid_token'));

    // 2. Authorized attempt with valid Initial Access Token
    const regRes = await fetch(`${baseUrl}/oauth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-secret-key',
      },
      body: JSON.stringify({
        client_name: 'test-dcr-client',
        redirect_uris: ['http://127.0.0.1:13316/callback'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      }),
    });

    assert.equal(regRes.status, 201);
    const client = (await regRes.json()) as any;
    assert.ok(client.client_id);
    assert.equal(client.client_name, 'test-dcr-client');
    assert.ok(client.redirect_uris.includes('http://127.0.0.1:13316/callback'));
  });

  it('Full PKCE OAuth 2.1 Flow: Authorize -> Token -> Access /mcp with Bearer token', async () => {
    // 1. Generate PKCE verifier and S256 challenge
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    // 2. GET /oauth/authorize (consent page inspection with requiresSecret)
    const consentRes = await fetch(
      `${baseUrl}/oauth/authorize?response_type=code&client_id=mcpc-default&redirect_uri=http://127.0.0.1:13316/callback&code_challenge=${challenge}&code_challenge_method=S256&state=state123`
    );
    assert.equal(consentRes.status, 200);
    const consentHtml = await consentRes.text();
    assert.ok(consentHtml.includes('Bağlantıyı Onaylayın'), 'Must render consent page');
    assert.ok(consentHtml.includes('server_secret'), 'Must require server secret input');

    // 3. Confirm authorization without valid secret (must be rejected with 403 Forbidden)
    const rejectRes = await fetch(
      `${baseUrl}/oauth/authorize?response_type=code&client_id=mcpc-default&redirect_uri=http://127.0.0.1:13316/callback&code_challenge=${challenge}&code_challenge_method=S256&state=state123&confirm=true`,
      { redirect: 'manual' }
    );
    assert.equal(rejectRes.status, 403, 'Must reject confirmation without secret');

    // 4. Confirm authorization WITH valid secret (approval redirect 302)
    const authRes = await fetch(
      `${baseUrl}/oauth/authorize?response_type=code&client_id=mcpc-default&redirect_uri=http://127.0.0.1:13316/callback&code_challenge=${challenge}&code_challenge_method=S256&state=state123&confirm=true&server_secret=test-secret-key`,
      { redirect: 'manual' }
    );
    assert.equal(authRes.status, 302);
    const location = authRes.headers.get('location');
    assert.ok(location);
    const redirectUrl = new URL(location);
    const code = redirectUrl.searchParams.get('code');
    assert.ok(code, 'Must return authorization code in redirect');
    assert.equal(redirectUrl.searchParams.get('state'), 'state123');

    // 5. POST /oauth/token exchange code for tokens
    const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code!,
        code_verifier: verifier,
        client_id: 'mcpc-default',
        redirect_uri: 'http://127.0.0.1:13316/callback',
      }).toString(),
    });

    assert.equal(tokenRes.status, 200);
    const tokens = (await tokenRes.json()) as any;
    assert.ok(tokens.access_token);
    assert.ok(tokens.refresh_token);
    assert.equal(tokens.token_type, 'Bearer');
    assert.ok(tokens.expires_in > 0);

    // 6. Use OAuth access_token to access /mcp
    const mcpRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${tokens.access_token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test-oauth-client', version: '1.0.0' },
        },
      }),
    });

    assert.equal(mcpRes.status, 200);
    const sessionId = mcpRes.headers.get('mcp-session-id');
    assert.ok(sessionId, 'OAuth-authenticated request should initialize session');

    // 7. Test Refresh Token
    const refreshRes = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: 'mcpc-default',
      }),
    });
    assert.equal(refreshRes.status, 200);
    const refreshed = (await refreshRes.json()) as any;
    assert.ok(refreshed.access_token);
    assert.notEqual(refreshed.access_token, tokens.access_token);

    // 8. Revoke Token
    const revokeRes = await fetch(`${baseUrl}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshed.access_token }).toString(),
    });
    assert.equal(revokeRes.status, 200);
  });

  it('Client Credentials Grant: strictly rejects missing/invalid secret and issues token when valid', async () => {
    // 1. Missing secret must be rejected
    const unauthRes = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: 'mcpc-default',
      }),
    });
    assert.equal(unauthRes.status, 400);
    const unauthJson = (await unauthRes.json()) as any;
    assert.equal(unauthJson.error, 'invalid_client');

    // 2. Invalid secret must be rejected
    const invalidRes = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: 'mcpc-default',
        client_secret: 'wrong-secret',
      }),
    });
    assert.equal(invalidRes.status, 400);

    // 3. Valid secret must succeed
    const validRes = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: 'mcpc-default',
        client_secret: 'test-secret-key',
      }),
    });

    assert.equal(validRes.status, 200);
    const json = (await validRes.json()) as any;
    assert.ok(json.access_token);
    assert.equal(json.token_type, 'Bearer');
  });

  it('POST /mcp performs full initialize handshake and sets mcp-session-id with apiKey', async () => {
    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer test-secret-key',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    assert.equal(initRes.status, 200);
    const sessionId = initRes.headers.get('mcp-session-id');
    assert.ok(sessionId, 'Server must return mcp-session-id header on initialize');
  });
});
