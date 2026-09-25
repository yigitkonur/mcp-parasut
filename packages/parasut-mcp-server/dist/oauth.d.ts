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
import type { IncomingMessage } from 'node:http';
/**
 * Constant-time string comparison to protect against timing side-channel attacks.
 */
export declare function safeTimingEqual(a: string | undefined | null, b: string | undefined | null): boolean;
export interface OAuthClient {
    client_id: string;
    client_secret?: string | undefined;
    client_id_issued_at: number;
    client_secret_expires_at?: number | undefined;
    client_name?: string | undefined;
    redirect_uris: string[];
    grant_types: string[];
    response_types: string[];
    token_endpoint_auth_method: string;
}
export interface AuthCode {
    code: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    scope?: string | undefined;
    expiresAt: number;
}
export interface StoredToken {
    accessToken: string;
    refreshToken: string;
    clientId: string;
    scope?: string | undefined;
    expiresAt: number;
}
export interface OAuthServerOptions {
    publicUrl?: string | undefined;
    resourceName?: string | undefined;
    scopesSupported?: string[] | undefined;
    defaultApiKey?: string | undefined;
}
export declare class OAuthServer {
    private clients;
    private authCodes;
    private accessTokens;
    private refreshTokens;
    readonly resourceName: string;
    readonly scopesSupported: string[];
    readonly publicUrl?: string | undefined;
    readonly defaultApiKey?: string | undefined;
    constructor(options?: OAuthServerOptions);
    /**
     * Resolves the base URL for OAuth endpoints based on configuration and request headers.
     */
    getBaseUrl(req: IncomingMessage, defaultHost?: string, defaultPort?: number): string;
    /**
     * Returns RFC 9728 Protected Resource Metadata document.
     */
    getProtectedResourceMetadata(baseUrl: string): {
        resource: string;
        authorization_servers: string[];
        scopes_supported: string[];
        resource_name: string;
        bearer_methods_supported: string[];
        resource_documentation: string;
    };
    /**
     * Returns RFC 8414 Authorization Server Metadata document.
     */
    getAuthorizationServerMetadata(baseUrl: string): {
        issuer: string;
        authorization_endpoint: string;
        token_endpoint: string;
        registration_endpoint: string;
        revocation_endpoint: string;
        response_types_supported: string[];
        grant_types_supported: string[];
        token_endpoint_auth_methods_supported: string[];
        code_challenge_methods_supported: string[];
        scopes_supported: string[];
        service_documentation: string;
    };
    /**
     * Registers a new OAuth client (RFC 7591 Dynamic Client Registration).
     */
    registerClient(data: {
        client_name?: string | undefined;
        redirect_uris?: string[] | undefined;
        grant_types?: string[] | undefined;
        response_types?: string[] | undefined;
        token_endpoint_auth_method?: string | undefined;
        client_secret?: string | undefined;
    }, predefinedId?: string): OAuthClient;
    getClient(clientId: string): OAuthClient | undefined;
    /**
     * Creates an authorization code linked to the client and PKCE challenge.
     */
    createAuthCode(params: {
        clientId: string;
        redirectUri: string;
        codeChallenge: string;
        codeChallengeMethod?: string | undefined;
        scope?: string | undefined;
        ttlMs?: number | undefined;
    }): AuthCode;
    /**
     * Exchanges authorization code for tokens (validates PKCE).
     */
    exchangeAuthCode(params: {
        code: string;
        codeVerifier: string;
        redirectUri?: string | undefined;
        clientId: string;
    }): StoredToken;
    /**
     * Exchanges refresh token for new access and refresh tokens.
     */
    exchangeRefreshToken(refreshToken: string, clientId?: string): StoredToken;
    /**
     * Issues tokens for client credentials grant.
     * Strictly enforces client authentication per RFC 6749 Section 4.4.
     */
    issueClientCredentialsToken(clientId: string, clientSecret?: string, scope?: string): StoredToken;
    /**
     * Issues an access token and refresh token pair.
     */
    private issueTokens;
    /**
     * Validates a bearer token.
     * Returns true if token is valid (matches stored active token or default API key).
     */
    verifyAccessToken(token: string): boolean;
    /**
     * Revokes a token.
     */
    revokeToken(token: string): boolean;
}
/**
 * Renders a clean, modern HTML consent page for interactive OAuth authorization.
 */
export declare function renderConsentPage(options: {
    clientName: string;
    clientId: string;
    redirectUri: string;
    scope?: string | undefined;
    state?: string | undefined;
    codeChallenge: string;
    codeChallengeMethod: string;
    postUrl: string;
    requiresSecret?: boolean | undefined;
    errorMessage?: string | undefined;
}): string;
//# sourceMappingURL=oauth.d.ts.map