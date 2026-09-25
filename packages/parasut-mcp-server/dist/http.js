/**
 * Paraşüt MCP Streamable HTTP Server
 *
 * Implements the modern MCP Streamable HTTP transport specification.
 * Supports stateful sessions, SSE streaming, health checks, RFC 9728 Protected Resource Metadata,
 * RFC 8414 Authorization Server Discovery, RFC 7591 Dynamic Client Registration, PKCE Authorization,
 * and Bearer Token authentication.
 */
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig, validateConfig } from './config.js';
import { createServer } from './server.js';
import { OAuthServer, renderConsentPage } from './oauth.js';
/**
 * Creates and configures the HTTP server for MCP Streamable HTTP transport.
 */
export function createHttpServer(config, options = {}) {
    const port = options.port ?? config.http?.port ?? 3000;
    const host = options.host ?? config.http?.host ?? '0.0.0.0';
    const apiKey = options.apiKey ?? config.http?.apiKey ?? process.env['MCP_API_KEY'];
    const corsOrigin = options.corsOrigin ?? config.http?.corsOrigin ?? '*';
    const publicUrl = options.publicUrl ?? config.http?.publicUrl;
    const authRequired = options.authRequired ?? (process.env['MCP_ALLOW_ANONYMOUS'] === 'true' ? false : true);
    // In authRequired mode, ensure there is an effective key (generate ephemeral if none provided)
    const effectiveApiKey = apiKey || (authRequired ? `mcp_sec_${randomBytes(24).toString('base64url')}` : undefined);
    if (authRequired && !apiKey) {
        console.error(`[Paraşüt MCP] NOTICE: No MCP_API_KEY configured. A secure random server key was generated: ${effectiveApiKey}`);
    }
    // Initialize OAuth Server with RFC 9728, RFC 8414, RFC 7591, and PKCE support
    const oauthServer = new OAuthServer({
        publicUrl: publicUrl ?? undefined,
        resourceName: 'parasut-mcp-server',
        defaultApiKey: effectiveApiKey,
    });
    // Active stateful session transports keyed by session ID
    const transports = new Map();
    const server = http.createServer(async (req, res) => {
        // 1. CORS headers
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, mcp-session-id, mcp-protocol-version, last-event-id');
        res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id, mcp-protocol-version');
        // Handle preflight OPTIONS
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        const hostHeader = req.headers.host ?? `${host}:${port}`;
        const url = new URL(req.url ?? '/', `http://${hostHeader}`);
        const baseUrl = oauthServer.getBaseUrl(req, host, port);
        // 2. Health check endpoints (open for Docker / Traefik / Dokploy health checks)
        if (url.pathname === '/health' || url.pathname === '/healthz' || url.pathname === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                server: 'parasut-mcp-server',
                version: '1.0.0',
                transport: 'streamable-http',
                activeSessions: transports.size,
                oauth: true,
            }));
            return;
        }
        // 3. RFC 9728 OAuth 2.0 Protected Resource Metadata
        if (url.pathname === '/.well-known/oauth-protected-resource' ||
            url.pathname === '/.well-known/oauth-protected-resource/mcp') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(oauthServer.getProtectedResourceMetadata(baseUrl), null, 2));
            return;
        }
        // 4. RFC 8414 OAuth 2.0 Authorization Server Metadata
        if (url.pathname === '/.well-known/oauth-authorization-server') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(oauthServer.getAuthorizationServerMetadata(baseUrl), null, 2));
            return;
        }
        // 5. RFC 7591 Dynamic Client Registration Endpoint (/oauth/register)
        if (url.pathname === '/oauth/register') {
            if (req.method !== 'POST') {
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'method_not_allowed', message: 'POST required' }));
                return;
            }
            // Require Initial Access Token if server has an effective API key configured
            if (effectiveApiKey) {
                const authHeader = req.headers.authorization;
                const regToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
                if (!regToken || regToken !== effectiveApiKey) {
                    const metadataUrl = `${baseUrl}/.well-known/oauth-protected-resource`;
                    res.setHeader('WWW-Authenticate', `Bearer error="invalid_token", error_description="Dynamic Client Registration requires a valid Initial Access Token", resource_metadata="${metadataUrl}"`);
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'unauthorized', message: 'Registration requires Initial Access Token' }));
                    return;
                }
            }
            let rawBody = '';
            try {
                for await (const chunk of req)
                    rawBody += chunk;
                const body = rawBody ? JSON.parse(rawBody) : {};
                const client = oauthServer.registerClient(body);
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(client));
            }
            catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'invalid_client_metadata', error_description: err.message }));
            }
            return;
        }
        // 6. RFC 6749 & RFC 7636 Authorization Endpoint (/oauth/authorize)
        if (url.pathname === '/oauth/authorize') {
            let params = {};
            for (const [k, v] of url.searchParams.entries()) {
                params[k] = v;
            }
            if (req.method === 'POST') {
                let rawBody = '';
                for await (const chunk of req)
                    rawBody += chunk;
                if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
                    const parsed = new URLSearchParams(rawBody);
                    for (const [k, v] of parsed.entries())
                        params[k] = v;
                }
                else {
                    try {
                        const parsed = JSON.parse(rawBody);
                        for (const [k, v] of Object.entries(parsed))
                            params[k] = String(v);
                    }
                    catch {
                        // Ignore parse errors, fallback to query params
                    }
                }
            }
            const clientId = params['client_id'];
            const redirectUri = params['redirect_uri'];
            const responseType = params['response_type'] || 'code';
            const codeChallenge = params['code_challenge'] || '';
            const codeChallengeMethod = params['code_challenge_method'] || 'S256';
            const state = params['state'];
            const scope = params['scope'];
            const confirm = params['confirm'] === 'true' || params['auto_approve'] === 'true';
            if (!clientId || !redirectUri) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'invalid_request',
                    error_description: 'client_id and redirect_uri are required',
                }));
                return;
            }
            if (responseType !== 'code') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'unsupported_response_type',
                    error_description: 'Only code response_type is supported',
                }));
                return;
            }
            // If user confirmed authorization or auto-approve requested: verify secret before issuing code
            if (confirm) {
                const providedSecret = params['server_secret'] || params['api_key'] || params['client_secret'];
                if (effectiveApiKey && (!providedSecret || providedSecret !== effectiveApiKey)) {
                    const client = oauthServer.getClient(clientId);
                    const clientName = client?.client_name || clientId;
                    const html = renderConsentPage({
                        clientName,
                        clientId,
                        redirectUri,
                        scope: scope ?? undefined,
                        state: state ?? undefined,
                        codeChallenge,
                        codeChallengeMethod,
                        postUrl: `${baseUrl}/oauth/authorize`,
                        requiresSecret: Boolean(effectiveApiKey),
                        errorMessage: 'Yetkilendirme Reddedildi: Geçersiz veya eksik Sunucu Erişim Anahtarı (Invalid API Key).',
                    });
                    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(html);
                    return;
                }
                const authCode = oauthServer.createAuthCode({
                    clientId,
                    redirectUri,
                    codeChallenge,
                    codeChallengeMethod,
                    scope: scope ?? undefined,
                });
                // Redirect back to client with code and state per OAuth 2.1 & RFC 9207 (iss)
                let redirectTarget;
                try {
                    const redirectUrl = new URL(redirectUri);
                    redirectUrl.searchParams.set('code', authCode.code);
                    if (state)
                        redirectUrl.searchParams.set('state', state);
                    redirectUrl.searchParams.set('iss', baseUrl);
                    redirectTarget = redirectUrl.toString();
                }
                catch {
                    // If redirectUri is custom or oob
                    const separator = redirectUri.includes('?') ? '&' : '?';
                    redirectTarget = `${redirectUri}${separator}code=${encodeURIComponent(authCode.code)}${state ? `&state=${encodeURIComponent(state)}` : ''}&iss=${encodeURIComponent(baseUrl)}`;
                }
                res.writeHead(302, { Location: redirectTarget });
                res.end();
                return;
            }
            // Render interactive HTML consent page
            const client = oauthServer.getClient(clientId);
            const clientName = client?.client_name || clientId;
            const html = renderConsentPage({
                clientName,
                clientId,
                redirectUri,
                scope: scope ?? undefined,
                state: state ?? undefined,
                codeChallenge,
                codeChallengeMethod,
                postUrl: `${baseUrl}/oauth/authorize`,
                requiresSecret: Boolean(effectiveApiKey),
            });
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }
        // 7. RFC 6749 Token Endpoint (/oauth/token)
        if (url.pathname === '/oauth/token') {
            if (req.method !== 'POST') {
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'method_not_allowed', message: 'POST required' }));
                return;
            }
            let rawBody = '';
            try {
                for await (const chunk of req)
                    rawBody += chunk;
            }
            catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Failed to read request' }));
                return;
            }
            const params = {};
            if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
                const parsed = new URLSearchParams(rawBody);
                for (const [k, v] of parsed.entries())
                    params[k] = v;
            }
            else {
                try {
                    const parsed = JSON.parse(rawBody);
                    for (const [k, v] of Object.entries(parsed))
                        params[k] = String(v);
                }
                catch {
                    // Fallback to query if body was not json
                    for (const [k, v] of url.searchParams.entries())
                        params[k] = v;
                }
            }
            // Support HTTP Basic Authentication for client credentials
            if (req.headers.authorization?.startsWith('Basic ')) {
                try {
                    const decoded = Buffer.from(req.headers.authorization.slice(6), 'base64').toString('utf8');
                    const [u, p] = decoded.split(':');
                    if (u)
                        params['client_id'] = u;
                    if (p)
                        params['client_secret'] = p;
                }
                catch {
                    // Ignore header decode error
                }
            }
            const grantType = params['grant_type'];
            try {
                if (grantType === 'authorization_code') {
                    const code = params['code'];
                    const codeVerifier = params['code_verifier'];
                    const clientId = params['client_id'] || 'generic';
                    const redirectUri = params['redirect_uri'];
                    if (!code || !codeVerifier) {
                        throw new Error('invalid_request: code and code_verifier are required');
                    }
                    const token = oauthServer.exchangeAuthCode({
                        code,
                        codeVerifier,
                        redirectUri: redirectUri ?? undefined,
                        clientId,
                    });
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store',
                        Pragma: 'no-cache',
                    });
                    res.end(JSON.stringify({
                        access_token: token.accessToken,
                        token_type: 'Bearer',
                        expires_in: token.expiresAt - Math.floor(Date.now() / 1000),
                        refresh_token: token.refreshToken,
                        scope: token.scope,
                    }));
                    return;
                }
                if (grantType === 'refresh_token') {
                    const refreshToken = params['refresh_token'];
                    if (!refreshToken) {
                        throw new Error('invalid_request: refresh_token is required');
                    }
                    const token = oauthServer.exchangeRefreshToken(refreshToken, params['client_id']);
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store',
                        Pragma: 'no-cache',
                    });
                    res.end(JSON.stringify({
                        access_token: token.accessToken,
                        token_type: 'Bearer',
                        expires_in: token.expiresAt - Math.floor(Date.now() / 1000),
                        refresh_token: token.refreshToken,
                        scope: token.scope,
                    }));
                    return;
                }
                if (grantType === 'client_credentials') {
                    const clientId = params['client_id'];
                    if (!clientId) {
                        throw new Error('invalid_request: client_id is required');
                    }
                    const token = oauthServer.issueClientCredentialsToken(clientId, params['client_secret'], params['scope']);
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store',
                        Pragma: 'no-cache',
                    });
                    res.end(JSON.stringify({
                        access_token: token.accessToken,
                        token_type: 'Bearer',
                        expires_in: token.expiresAt - Math.floor(Date.now() / 1000),
                        scope: token.scope,
                    }));
                    return;
                }
                throw new Error(`unsupported_grant_type: Unsupported grant_type: ${grantType}`);
            }
            catch (err) {
                const [errorCode, ...descParts] = err.message.split(': ');
                const errorDescription = descParts.join(': ') || err.message;
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: errorCode || 'invalid_request',
                    error_description: errorDescription,
                }));
                return;
            }
        }
        // 8. RFC 7009 Token Revocation Endpoint (/oauth/revoke)
        if (url.pathname === '/oauth/revoke') {
            let rawBody = '';
            try {
                for await (const chunk of req)
                    rawBody += chunk;
            }
            catch {
                // Continue
            }
            const params = new URLSearchParams(rawBody);
            const token = params.get('token') || (rawBody ? JSON.parse(rawBody).token : undefined);
            if (token) {
                oauthServer.revokeToken(token);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'revoked' }));
            return;
        }
        // 9. Root informational endpoint
        if (url.pathname === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                name: 'parasut-mcp-server',
                version: '1.0.0',
                status: 'running',
                endpoint: '/mcp',
                health: '/health',
                transport: 'streamable-http',
                authRequired,
                oauth: {
                    protectedResourceMetadata: `${baseUrl}/.well-known/oauth-protected-resource`,
                    authorizationServerMetadata: `${baseUrl}/.well-known/oauth-authorization-server`,
                    authorizationEndpoint: `${baseUrl}/oauth/authorize`,
                    tokenEndpoint: `${baseUrl}/oauth/token`,
                    registrationEndpoint: `${baseUrl}/oauth/register`,
                },
            }));
            return;
        }
        // 10. Verify endpoint is /mcp
        if (url.pathname !== '/mcp') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found', message: 'Use /mcp for MCP requests' }));
            return;
        }
        // 11. Authentication check (OAuth Bearer Token / API Key)
        const authHeader = req.headers.authorization;
        const bearerToken = authHeader?.startsWith('Bearer ')
            ? authHeader.slice(7).trim()
            : url.searchParams.get('api_key') || url.searchParams.get('token');
        if (authRequired) {
            const isValid = Boolean(bearerToken && ((effectiveApiKey && bearerToken === effectiveApiKey) ||
                oauthServer.verifyAccessToken(bearerToken)));
            if (!isValid) {
                const metadataUrl = `${baseUrl}/.well-known/oauth-protected-resource`;
                res.setHeader('WWW-Authenticate', `Bearer error="invalid_token", error_description="Missing or invalid Bearer token", resource_metadata="${metadataUrl}"`);
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    error: {
                        code: -32000,
                        message: 'Unauthorized: Authentication required. Use OAuth 2.0 or supply a valid Bearer token.',
                    },
                    id: null,
                }));
                return;
            }
        }
        else if (bearerToken) {
            // Optional auth provided: validate if supplied
            const isValid = (effectiveApiKey && bearerToken === effectiveApiKey) || oauthServer.verifyAccessToken(bearerToken);
            if (!isValid) {
                const metadataUrl = `${baseUrl}/.well-known/oauth-protected-resource`;
                res.setHeader('WWW-Authenticate', `Bearer error="invalid_token", error_description="Invalid Bearer token", resource_metadata="${metadataUrl}"`);
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    error: { code: -32000, message: 'Unauthorized: Invalid Bearer token' },
                    id: null,
                }));
                return;
            }
        }
        const sessionId = req.headers['mcp-session-id'];
        // 12. POST /mcp Handling
        if (req.method === 'POST') {
            let body = '';
            try {
                for await (const chunk of req) {
                    body += chunk;
                }
            }
            catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    error: { code: -32700, message: 'Request stream read error' },
                    id: null,
                }));
                return;
            }
            let parsed;
            try {
                parsed = JSON.parse(body);
            }
            catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    error: { code: -32700, message: 'Parse error: invalid JSON' },
                    id: null,
                }));
                return;
            }
            // Initialize request (always create new session even if client passed an old session id header)
            if (isInitializeRequest(parsed)) {
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (newSid) => {
                        transports.set(newSid, transport);
                        if (config.debug) {
                            // eslint-disable-next-line no-console
                            console.error(`[MCP-HTTP] Session initialized: ${newSid}`);
                        }
                    },
                });
                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid && transports.has(sid)) {
                        transports.delete(sid);
                        if (config.debug) {
                            // eslint-disable-next-line no-console
                            console.error(`[MCP-HTTP] Session closed: ${sid}`);
                        }
                    }
                };
                const mcpServer = createServer(config);
                await mcpServer.connect(transport);
                await transport.handleRequest(req, res, parsed);
                return;
            }
            // Existing active session
            if (sessionId && transports.has(sessionId)) {
                const transport = transports.get(sessionId);
                await transport.handleRequest(req, res, parsed);
                return;
            }
            // Unknown or expired session ID (MCP Streamable HTTP spec requires HTTP 404)
            if (sessionId && !transports.has(sessionId)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    error: {
                        code: -32001,
                        message: 'Session not found or expired. Please re-initialize session.',
                    },
                    id: parsed?.id ?? null,
                }));
                return;
            }
            // Neither initialize nor valid session
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Session ID required for non-initialize requests. Pass mcp-session-id header.',
                },
                id: parsed?.id ?? null,
            }));
            return;
        }
        // 13. GET /mcp Handling (SSE Event Stream)
        if (req.method === 'GET') {
            if (sessionId && transports.has(sessionId)) {
                const transport = transports.get(sessionId);
                await transport.handleRequest(req, res);
                return;
            }
            if (sessionId && !transports.has(sessionId)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    error: {
                        code: -32001,
                        message: 'Session not found or expired',
                    },
                    id: null,
                }));
                return;
            }
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Invalid or missing session ID for GET stream',
                },
                id: null,
            }));
            return;
        }
        // 14. DELETE /mcp Handling (Session Termination)
        if (req.method === 'DELETE') {
            if (sessionId && transports.has(sessionId)) {
                const transport = transports.get(sessionId);
                await transport.handleRequest(req, res);
                transports.delete(sessionId);
                return;
            }
            if (sessionId && !transports.has(sessionId)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    error: {
                        code: -32001,
                        message: 'Session not found',
                    },
                    id: null,
                }));
                return;
            }
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Invalid or missing session ID for session termination',
                },
                id: null,
            }));
            return;
        }
        // 15. Unsupported methods
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Method not allowed',
            allowedMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        }));
    });
    return server;
}
/**
 * Starts the HTTP server and logs connection details.
 */
export function startHttpServer(config, options = {}) {
    return new Promise((resolve, reject) => {
        const resolvedConfig = config ?? loadConfig();
        validateConfig(resolvedConfig);
        const port = options.port ?? resolvedConfig.http?.port ?? 3000;
        const host = options.host ?? resolvedConfig.http?.host ?? '0.0.0.0';
        const server = createHttpServer(resolvedConfig, options);
        server.on('error', (err) => {
            reject(err);
        });
        server.listen(port, host, () => {
            const publicUrl = options.publicUrl ?? resolvedConfig.http?.publicUrl ?? `http://${host}:${port}`;
            // eslint-disable-next-line no-console
            console.log(`[Paraşüt MCP] Streamable HTTP server listening on http://${host}:${port}/mcp`);
            // eslint-disable-next-line no-console
            console.log(`[Paraşüt MCP] Health check available at http://${host}:${port}/health`);
            // eslint-disable-next-line no-console
            console.log(`[Paraşüt MCP] OAuth Protected Resource Metadata at ${publicUrl}/.well-known/oauth-protected-resource`);
            // eslint-disable-next-line no-console
            console.log(`[Paraşüt MCP] OAuth Authorization Server Metadata at ${publicUrl}/.well-known/oauth-authorization-server`);
            resolve(server);
        });
    });
}
//# sourceMappingURL=http.js.map