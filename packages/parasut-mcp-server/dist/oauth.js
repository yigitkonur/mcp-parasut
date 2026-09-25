/**
 * Paraşüt MCP OAuth 2.0 / 2.1 Server Implementation
 *
 * Implements the official Model Context Protocol (MCP) authorization specification:
 * - RFC 9728: OAuth 2.0 Protected Resource Metadata (/.well-known/oauth-protected-resource)
 * - RFC 8414: OAuth 2.0 Authorization Server Metadata (/.well-known/oauth-authorization-server)
 * - RFC 7591: Dynamic Client Registration (/oauth/register)
 * - RFC 7636: Proof Key for Code Exchange (PKCE) with S256 challenge (/oauth/authorize & /oauth/token)
 * - RFC 6749: OAuth 2.0 Authorization Code & Refresh Token Grant (/oauth/authorize & /oauth/token)
 * - RFC 6750: Bearer Token Usage & WWW-Authenticate 401 Challenge
 * - RFC 7009: OAuth 2.0 Token Revocation (/oauth/revoke)
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
/**
 * Constant-time string comparison to protect against timing side-channel attacks.
 */
export function safeTimingEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
        return false;
    }
    return timingSafeEqual(bufA, bufB);
}
export class OAuthServer {
    clients = new Map();
    authCodes = new Map();
    accessTokens = new Map();
    refreshTokens = new Map();
    resourceName;
    scopesSupported;
    publicUrl;
    defaultApiKey;
    constructor(options = {}) {
        this.publicUrl = options.publicUrl;
        this.resourceName = options.resourceName ?? 'parasut-mcp-server';
        this.scopesSupported = options.scopesSupported ?? ['parasut', 'accounting', 'invoicing'];
        this.defaultApiKey = options.defaultApiKey;
        // Pre-register default clients (for mcpc CLI, Claude Desktop, and local development)
        this.registerClient({
            client_name: 'mcpc CLI',
            redirect_uris: [
                'http://127.0.0.1:13316/callback',
                'http://127.0.0.1:31613/callback',
                'http://127.0.0.1:16133/callback',
                'http://localhost:13316/callback',
                'http://localhost:31613/callback',
                'http://localhost:16133/callback',
                'urn:ietf:wg:oauth:2.0:oob',
            ],
            grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
            response_types: ['code'],
            token_endpoint_auth_method: this.defaultApiKey ? 'client_secret_post' : 'none',
            ...(this.defaultApiKey && { client_secret: this.defaultApiKey }),
        }, 'mcpc-default');
        this.registerClient({
            client_name: 'Paraşüt MCP Client',
            redirect_uris: [
                'http://localhost/callback',
                'http://127.0.0.1/callback',
                'urn:ietf:wg:oauth:2.0:oob',
            ],
            grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
            response_types: ['code'],
            token_endpoint_auth_method: this.defaultApiKey ? 'client_secret_post' : 'none',
            ...(this.defaultApiKey && { client_secret: this.defaultApiKey }),
        }, 'parasut-client');
    }
    /**
     * Resolves the base URL for OAuth endpoints based on configuration and request headers.
     */
    getBaseUrl(req, defaultHost = '127.0.0.1', defaultPort = 3000) {
        if (this.publicUrl) {
            return this.publicUrl.replace(/\/+$/, '');
        }
        const forwardedProto = req.headers['x-forwarded-proto'];
        const proto = typeof forwardedProto === 'string'
            ? forwardedProto.split(',')[0]?.trim() || 'http'
            : 'http';
        const host = req.headers['x-forwarded-host'] ||
            req.headers.host ||
            `${defaultHost}:${defaultPort}`;
        return `${proto}://${host}`;
    }
    /**
     * Returns RFC 9728 Protected Resource Metadata document.
     */
    getProtectedResourceMetadata(baseUrl) {
        return {
            resource: `${baseUrl}/mcp`,
            authorization_servers: [baseUrl],
            scopes_supported: this.scopesSupported,
            resource_name: this.resourceName,
            bearer_methods_supported: ['header'],
            resource_documentation: 'https://github.com/yigitkonur/mcp-parasut#readme',
        };
    }
    /**
     * Returns RFC 8414 Authorization Server Metadata document.
     */
    getAuthorizationServerMetadata(baseUrl) {
        return {
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/oauth/authorize`,
            token_endpoint: `${baseUrl}/oauth/token`,
            registration_endpoint: `${baseUrl}/oauth/register`,
            revocation_endpoint: `${baseUrl}/oauth/revoke`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
            token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
            code_challenge_methods_supported: ['S256'],
            scopes_supported: this.scopesSupported,
            service_documentation: 'https://github.com/yigitkonur/mcp-parasut#readme',
        };
    }
    /**
     * Registers a new OAuth client (RFC 7591 Dynamic Client Registration).
     */
    registerClient(data, predefinedId) {
        const clientId = predefinedId || `mcp-client-${randomUUID()}`;
        const clientSecret = data.client_secret ||
            (data.token_endpoint_auth_method && data.token_endpoint_auth_method !== 'none'
                ? `sec_${randomBytes(24).toString('base64url')}`
                : undefined);
        const client = {
            client_id: clientId,
            client_secret: clientSecret,
            client_id_issued_at: Math.floor(Date.now() / 1000),
            client_name: data.client_name || 'Generic MCP Client',
            redirect_uris: data.redirect_uris || ['http://127.0.0.1/callback'],
            grant_types: data.grant_types || ['authorization_code', 'refresh_token'],
            response_types: data.response_types || ['code'],
            token_endpoint_auth_method: data.token_endpoint_auth_method || (clientSecret ? 'client_secret_post' : 'none'),
        };
        this.clients.set(clientId, client);
        return client;
    }
    getClient(clientId) {
        return this.clients.get(clientId);
    }
    /**
     * Creates an authorization code linked to the client and PKCE challenge.
     */
    createAuthCode(params) {
        const code = `mcp_code_${randomBytes(24).toString('base64url')}`;
        const authCode = {
            code,
            clientId: params.clientId,
            redirectUri: params.redirectUri,
            codeChallenge: params.codeChallenge,
            codeChallengeMethod: params.codeChallengeMethod || 'S256',
            scope: params.scope,
            expiresAt: Date.now() + (params.ttlMs || 600000), // 10 minutes default
        };
        this.authCodes.set(code, authCode);
        return authCode;
    }
    /**
     * Exchanges authorization code for tokens (validates PKCE).
     */
    exchangeAuthCode(params) {
        const authCode = this.authCodes.get(params.code);
        if (!authCode) {
            throw new Error('invalid_grant: Invalid or expired authorization code');
        }
        if (Date.now() > authCode.expiresAt) {
            this.authCodes.delete(params.code);
            throw new Error('invalid_grant: Authorization code expired');
        }
        // Verify PKCE S256
        const calculatedChallenge = createHash('sha256')
            .update(params.codeVerifier)
            .digest('base64url');
        if (!safeTimingEqual(calculatedChallenge, authCode.codeChallenge)) {
            throw new Error('invalid_grant: PKCE verification failed');
        }
        // Single-use code consumption
        this.authCodes.delete(params.code);
        // Issue tokens
        return this.issueTokens(authCode.clientId, authCode.scope);
    }
    /**
     * Exchanges refresh token for new access and refresh tokens.
     */
    exchangeRefreshToken(refreshToken, clientId) {
        const stored = this.refreshTokens.get(refreshToken);
        if (!stored) {
            throw new Error('invalid_grant: Invalid refresh token');
        }
        if (clientId && stored.clientId !== clientId) {
            throw new Error('invalid_client: Refresh token does not belong to client');
        }
        // Revoke old tokens
        this.accessTokens.delete(stored.accessToken);
        this.refreshTokens.delete(refreshToken);
        // Issue new pair
        return this.issueTokens(stored.clientId, stored.scope);
    }
    /**
     * Issues tokens for client credentials grant.
     * Strictly enforces client authentication per RFC 6749 Section 4.4.
     */
    issueClientCredentialsToken(clientId, clientSecret, scope) {
        const client = this.clients.get(clientId);
        if (!client) {
            throw new Error('invalid_client: Unknown client ID');
        }
        const expectedSecret = client.client_secret || this.defaultApiKey;
        if (!expectedSecret) {
            throw new Error('unauthorized_client: Client credentials grant is not permitted without a configured server secret');
        }
        if (!clientSecret || !safeTimingEqual(clientSecret, expectedSecret)) {
            throw new Error('invalid_client: Client secret required and must match server secret');
        }
        return this.issueTokens(clientId, scope);
    }
    /**
     * Issues an access token and refresh token pair.
     */
    issueTokens(clientId, scope, ttlSeconds = 7200) {
        const accessToken = `mcp_at_${randomBytes(32).toString('base64url')}`;
        const refreshToken = `mcp_rt_${randomBytes(32).toString('base64url')}`;
        const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
        const token = {
            accessToken,
            refreshToken,
            clientId,
            scope: scope || 'parasut',
            expiresAt,
        };
        this.accessTokens.set(accessToken, token);
        this.refreshTokens.set(refreshToken, token);
        return token;
    }
    /**
     * Validates a bearer token.
     * Returns true if token is valid (matches stored active token or default API key).
     */
    verifyAccessToken(token) {
        if (!token)
            return false;
        // Check static API key if configured
        if (this.defaultApiKey && token === this.defaultApiKey) {
            return true;
        }
        const stored = this.accessTokens.get(token);
        if (!stored)
            return false;
        // Check expiration
        if (Math.floor(Date.now() / 1000) > stored.expiresAt) {
            this.accessTokens.delete(token);
            return false;
        }
        return true;
    }
    /**
     * Revokes a token.
     */
    revokeToken(token) {
        let revoked = false;
        if (this.accessTokens.has(token)) {
            this.accessTokens.delete(token);
            revoked = true;
        }
        if (this.refreshTokens.has(token)) {
            this.refreshTokens.delete(token);
            revoked = true;
        }
        return revoked;
    }
}
/**
 * Renders a clean, modern HTML consent page for interactive OAuth authorization.
 */
export function renderConsentPage(options) {
    const { clientName, clientId, redirectUri, scope, state, codeChallenge, codeChallengeMethod, postUrl, requiresSecret, errorMessage, } = options;
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Paraşüt MCP Sunucusu - Yetkilendirme</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --muted: #94a3b8;
      --primary: #38bdf8;
      --primary-hover: #0ea5e9;
      --success: #22c55e;
      --success-hover: #16a34a;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 2.25rem;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      background: rgba(56, 189, 248, 0.15);
      color: var(--primary);
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .alert-danger {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid var(--danger);
      color: #fca5a5;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      margin-bottom: 1.25rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
      color: #fff;
    }
    p {
      color: var(--muted);
      font-size: 0.9375rem;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .details {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 0.375rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .row:last-child { border-bottom: none; }
    .label { color: var(--muted); }
    .value { font-family: monospace; color: #fff; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
    .form-group {
      margin-bottom: 1.5rem;
      text-align: left;
    }
    .form-group label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--muted);
      margin-bottom: 0.5rem;
    }
    .form-group input {
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      background: #0f172a;
      border: 1px solid var(--border);
      color: #fff;
      font-size: 0.9375rem;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .form-group input:focus {
      border-color: var(--primary);
    }
    .actions { display: flex; gap: 0.75rem; }
    button {
      flex: 1;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }
    .btn-approve {
      background: var(--success);
      color: #fff;
    }
    .btn-approve:hover {
      background: var(--success-hover);
    }
    .btn-cancel {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
    }
    .btn-cancel:hover {
      color: #fff;
      border-color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Model Context Protocol · OAuth 2.1</div>
    <h1>Bağlantıyı Onaylayın</h1>
    <p>Aşağıdaki yapay zeka istemcisi, Paraşüt muhasebe ve faturalandırma araçlarınıza erişim izni istiyor.</p>

    ${errorMessage ? `<div class="alert-danger">${escapeHtml(errorMessage)}</div>` : ''}

    <div class="details">
      <div class="row">
        <span class="label">İstemci:</span>
        <span class="value">${escapeHtml(clientName)}</span>
      </div>
      <div class="row">
        <span class="label">Client ID:</span>
        <span class="value">${escapeHtml(clientId)}</span>
      </div>
      <div class="row">
        <span class="label">Yetki Kapsamı:</span>
        <span class="value">${escapeHtml(scope || 'parasut (tam erişim)')}</span>
      </div>
      <div class="row">
        <span class="label">Geri Dönüş URL:</span>
        <span class="value" title="${escapeHtml(redirectUri)}">${escapeHtml(redirectUri)}</span>
      </div>
    </div>

    <form method="POST" action="${escapeHtml(postUrl)}">
      <input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}">
      ${state ? `<input type="hidden" name="state" value="${escapeHtml(state)}">` : ''}
      ${scope ? `<input type="hidden" name="scope" value="${escapeHtml(scope)}">` : ''}
      <input type="hidden" name="confirm" value="true">

      ${requiresSecret
        ? `<div class="form-group">
        <label for="server_secret">Sunucu Erişim Anahtarı (API Key / Parola):</label>
        <input type="password" id="server_secret" name="server_secret" required placeholder="Sunucu API anahtarınızı girin">
      </div>`
        : ''}

      <div class="actions">
        <button type="button" class="btn-cancel" onclick="window.close()">İptal</button>
        <button type="submit" class="btn-approve">Yetkilendir ve Bağlan</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
//# sourceMappingURL=oauth.js.map