/**
 * OAuth Token Manager
 *
 * Handles OAuth2 authentication with password grant and token refresh.
 * Supports pluggable token storage for persistence.
 */
export interface OAuthCredentials {
    clientId: string;
    clientSecret: string;
    username?: string | undefined;
    password?: string | undefined;
    refreshToken?: string | undefined;
}
export interface OAuthOptions {
    tokenUrl?: string | undefined;
    storage?: TokenStorage | undefined;
    accessToken?: string | undefined;
    refreshToken?: string | undefined;
    expiresIn?: number | undefined;
    fetch?: typeof fetch | undefined;
    fetchOptions?: (RequestInit & Record<string, any>) | undefined;
}
export interface OAuthToken {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    tokenType: string;
}
/**
 * Interface for pluggable token storage.
 * Implement this to persist tokens (e.g., to Redis, file, etc.)
 */
export interface TokenStorage {
    get(): Promise<OAuthToken | null>;
    set(token: OAuthToken): Promise<void>;
    clear(): Promise<void>;
}
export declare class MemoryTokenStorage implements TokenStorage {
    private token;
    get(): Promise<OAuthToken | null>;
    set(token: OAuthToken): Promise<void>;
    clear(): Promise<void>;
}
export declare class OAuthManager {
    private readonly tokenUrl;
    private readonly credentials;
    private readonly storage;
    private readonly customFetch?;
    private readonly fetchOptions?;
    private refreshPromise;
    private initialTokenPromise?;
    /**
     * Buffer time before token expiry to trigger refresh (60 seconds)
     */
    private readonly expiryBuffer;
    constructor(credentials: OAuthCredentials, options?: OAuthOptions);
    /**
     * Returns a valid access token, refreshing if necessary.
     * Handles concurrent refresh requests to prevent multiple refreshes.
     */
    getValidToken(): Promise<string>;
    /**
     * Returns current token from storage.
     */
    getToken(): Promise<OAuthToken | null>;
    /**
     * Performs password grant authentication.
     */
    authenticate(): Promise<OAuthToken>;
    /**
     * Refreshes the token using the refresh token.
     */
    refreshToken(refreshToken?: string): Promise<OAuthToken>;
    /**
     * Clears the stored token.
     */
    clearToken(): Promise<void>;
    /**
     * Checks if a token is still valid.
     */
    private isTokenValid;
    /**
     * Performs the password grant flow.
     */
    private performPasswordGrant;
    /**
     * Performs the refresh token flow.
     */
    private performRefresh;
    /**
     * Makes the token request to the OAuth server.
     */
    private requestToken;
}
export interface AuthCodeConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    tokenUrl?: string | undefined;
    authorizeUrl?: string | undefined;
    storage?: TokenStorage | undefined;
    accessToken?: string | undefined;
    refreshToken?: string | undefined;
    expiresIn?: number | undefined;
    fetch?: typeof fetch | undefined;
    fetchOptions?: (RequestInit & Record<string, any>) | undefined;
}
export declare class AuthCodeManager {
    private readonly config;
    private readonly tokenUrl;
    private readonly authorizeUrl;
    private readonly storage;
    private refreshPromise;
    private initialTokenPromise?;
    private readonly expiryBuffer;
    constructor(config: AuthCodeConfig);
    /**
     * Generates the authorization URL for the user to visit.
     */
    getAuthorizationUrl(state?: string): string;
    /**
     * Exchanges an authorization code for tokens.
     */
    exchangeCode(code: string): Promise<OAuthToken>;
    /**
     * Returns a valid access token, refreshing if necessary.
     */
    getValidToken(): Promise<string>;
    /**
     * Refreshes the token using the refresh token.
     */
    refreshToken(refreshToken: string): Promise<OAuthToken>;
    clearToken(): Promise<void>;
    private isTokenValid;
    private requestToken;
}
//# sourceMappingURL=OAuth.d.ts.map