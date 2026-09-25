/**
 * OAuth Token Manager
 *
 * Handles OAuth2 authentication with password grant and token refresh.
 * Supports pluggable token storage for persistence.
 */
import { ParasutAuthError, ParasutConfigError, ParasutNetworkError } from './errors.js';
import { getOrInitProxyDispatcher } from './HttpTransport.js';
// ============================================================================
// In-Memory Token Storage
// ============================================================================
export class MemoryTokenStorage {
    token = null;
    async get() {
        return this.token;
    }
    async set(token) {
        this.token = token;
    }
    async clear() {
        this.token = null;
    }
}
// ============================================================================
// OAuth Manager
// ============================================================================
export class OAuthManager {
    tokenUrl;
    credentials;
    storage;
    customFetch;
    fetchOptions;
    refreshPromise = null;
    initialTokenPromise;
    /**
     * Buffer time before token expiry to trigger refresh (60 seconds)
     */
    expiryBuffer = 60_000;
    constructor(credentials, options) {
        this.credentials = credentials;
        this.tokenUrl = options?.tokenUrl ?? 'https://api.parasut.com/oauth/token';
        this.storage = options?.storage ?? new MemoryTokenStorage();
        this.customFetch = options?.fetch;
        this.fetchOptions = options?.fetchOptions;
        // Validate credentials
        if (!credentials.clientId || !credentials.clientSecret) {
            throw new ParasutConfigError('clientId and clientSecret are required');
        }
        const hasInitialToken = Boolean(options?.refreshToken ||
            credentials.refreshToken ||
            options?.accessToken);
        if (!hasInitialToken && (!credentials.username || !credentials.password)) {
            throw new ParasutConfigError('username and password are required');
        }
        // Preload initial tokens into storage if provided
        const initialAccessToken = options?.accessToken;
        const initialRefreshToken = options?.refreshToken ?? credentials.refreshToken;
        if (initialAccessToken || initialRefreshToken) {
            const initialToken = {
                accessToken: initialAccessToken ?? '',
                refreshToken: initialRefreshToken ?? '',
                expiresAt: initialAccessToken
                    ? Date.now() + (options?.expiresIn ?? 7200) * 1000
                    : 0,
                tokenType: 'bearer',
            };
            this.initialTokenPromise = this.storage.set(initialToken);
        }
    }
    /**
     * Returns a valid access token, refreshing if necessary.
     * Handles concurrent refresh requests to prevent multiple refreshes.
     */
    async getValidToken() {
        if (this.initialTokenPromise) {
            await this.initialTokenPromise;
            this.initialTokenPromise = undefined;
        }
        // Check if we have a cached token
        const token = await this.storage.get();
        if (token && this.isTokenValid(token)) {
            return token.accessToken;
        }
        // If refresh is already in progress, wait for it
        if (this.refreshPromise) {
            const refreshedToken = await this.refreshPromise;
            return refreshedToken.accessToken;
        }
        // If we have a refresh token, try to refresh
        const refreshTokenToUse = token?.refreshToken || this.credentials.refreshToken;
        if (refreshTokenToUse) {
            try {
                const newToken = await this.refreshToken(refreshTokenToUse);
                return newToken.accessToken;
            }
            catch (error) {
                // If refresh fails, fall through to password grant ONLY if credentials are provided
                if (this.credentials.username && this.credentials.password) {
                    console.warn('Token refresh failed, attempting password grant');
                }
                else {
                    throw error;
                }
            }
        }
        // No valid token, perform password grant if credentials available
        if (!this.credentials.username || !this.credentials.password) {
            throw new ParasutAuthError([
                {
                    title: 'Authentication Failed',
                    detail: 'No valid token available and username/password credentials were not provided for password grant.',
                },
            ]);
        }
        const newToken = await this.authenticate();
        return newToken.accessToken;
    }
    /**
     * Returns current token from storage.
     */
    async getToken() {
        if (this.initialTokenPromise) {
            await this.initialTokenPromise;
            this.initialTokenPromise = undefined;
        }
        return this.storage.get();
    }
    /**
     * Performs password grant authentication.
     */
    async authenticate() {
        if (!this.credentials.username || !this.credentials.password) {
            throw new ParasutConfigError('username and password are required for password grant authentication');
        }
        // Prevent concurrent authentication attempts
        if (this.refreshPromise) {
            return this.refreshPromise;
        }
        this.refreshPromise = this.performPasswordGrant();
        try {
            const token = await this.refreshPromise;
            return token;
        }
        finally {
            this.refreshPromise = null;
        }
    }
    /**
     * Refreshes the token using the refresh token.
     */
    async refreshToken(refreshToken) {
        const tokenToUse = refreshToken ??
            (await this.storage.get())?.refreshToken ??
            this.credentials.refreshToken;
        if (!tokenToUse) {
            throw new ParasutAuthError([
                {
                    title: 'No Refresh Token',
                    detail: 'No refresh token available to refresh access token',
                },
            ]);
        }
        // Prevent concurrent refresh attempts
        if (this.refreshPromise) {
            return this.refreshPromise;
        }
        this.refreshPromise = this.performRefresh(tokenToUse);
        try {
            const token = await this.refreshPromise;
            return token;
        }
        finally {
            this.refreshPromise = null;
        }
    }
    /**
     * Clears the stored token.
     */
    async clearToken() {
        await this.storage.clear();
    }
    /**
     * Checks if a token is still valid.
     */
    isTokenValid(token) {
        if (!token.accessToken) {
            return false;
        }
        return Date.now() < token.expiresAt - this.expiryBuffer;
    }
    /**
     * Performs the password grant flow.
     */
    async performPasswordGrant() {
        const body = new URLSearchParams({
            grant_type: 'password',
            client_id: this.credentials.clientId,
            client_secret: this.credentials.clientSecret,
            username: this.credentials.username ?? '',
            password: this.credentials.password ?? '',
            redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        });
        return this.requestToken(body);
    }
    /**
     * Performs the refresh token flow.
     */
    async performRefresh(refreshToken) {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: this.credentials.clientId,
            client_secret: this.credentials.clientSecret,
            refresh_token: refreshToken,
        });
        return this.requestToken(body);
    }
    /**
     * Makes the token request to the OAuth server.
     */
    async requestToken(body) {
        try {
            const fetchFn = this.customFetch ?? fetch;
            const proxyDispatcher = !this.fetchOptions?.['dispatcher']
                ? await getOrInitProxyDispatcher()
                : undefined;
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(this.fetchOptions?.headers ?? {}),
            };
            const fetchOptions = {
                ...this.fetchOptions,
                method: 'POST',
                headers,
                body: body.toString(),
            };
            if (proxyDispatcher) {
                fetchOptions['dispatcher'] = proxyDispatcher;
            }
            const response = await fetchFn(this.tokenUrl, fetchOptions);
            if (!response.ok) {
                const errorBody = await response.text();
                let errorDetail;
                try {
                    const parsed = JSON.parse(errorBody);
                    errorDetail = parsed.error_description ?? parsed.error ?? errorBody;
                }
                catch {
                    errorDetail = errorBody;
                }
                throw new ParasutAuthError([{ title: 'Authentication Failed', detail: errorDetail }], undefined, errorBody);
            }
            const data = (await response.json());
            const token = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + data.expires_in * 1000,
                tokenType: data.token_type,
            };
            // Store the new token
            await this.storage.set(token);
            return token;
        }
        catch (error) {
            if (error instanceof ParasutAuthError) {
                throw error;
            }
            if (error instanceof Error) {
                throw new ParasutNetworkError(`OAuth request failed: ${error.message}`, 'OAUTH_ERROR', error);
            }
            throw error;
        }
    }
}
export class AuthCodeManager {
    config;
    tokenUrl;
    authorizeUrl;
    storage;
    refreshPromise = null;
    initialTokenPromise;
    expiryBuffer = 60_000;
    constructor(config) {
        this.config = config;
        this.tokenUrl = config.tokenUrl ?? 'https://api.parasut.com/oauth/token';
        this.authorizeUrl = config.authorizeUrl ?? 'https://api.parasut.com/oauth/authorize';
        this.storage = config.storage ?? new MemoryTokenStorage();
        const initialAccessToken = config.accessToken;
        const initialRefreshToken = config.refreshToken;
        if (initialAccessToken || initialRefreshToken) {
            const initialToken = {
                accessToken: initialAccessToken ?? '',
                refreshToken: initialRefreshToken ?? '',
                expiresAt: initialAccessToken
                    ? Date.now() + (config.expiresIn ?? 7200) * 1000
                    : 0,
                tokenType: 'bearer',
            };
            this.initialTokenPromise = this.storage.set(initialToken);
        }
    }
    /**
     * Generates the authorization URL for the user to visit.
     */
    getAuthorizationUrl(state) {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
        });
        if (state) {
            params.set('state', state);
        }
        return `${this.authorizeUrl}?${params.toString()}`;
    }
    /**
     * Exchanges an authorization code for tokens.
     */
    async exchangeCode(code) {
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: this.config.redirectUri,
        });
        return this.requestToken(body);
    }
    /**
     * Returns a valid access token, refreshing if necessary.
     */
    async getValidToken() {
        if (this.initialTokenPromise) {
            await this.initialTokenPromise;
            this.initialTokenPromise = undefined;
        }
        const token = await this.storage.get();
        if (token && this.isTokenValid(token)) {
            return token.accessToken;
        }
        if (this.refreshPromise) {
            const refreshedToken = await this.refreshPromise;
            return refreshedToken.accessToken;
        }
        if (token?.refreshToken) {
            const newToken = await this.refreshToken(token.refreshToken);
            return newToken.accessToken;
        }
        throw new ParasutAuthError([{ title: 'No Valid Token', detail: 'No token available. Please authenticate first.' }]);
    }
    /**
     * Refreshes the token using the refresh token.
     */
    async refreshToken(refreshToken) {
        if (this.refreshPromise) {
            return this.refreshPromise;
        }
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            refresh_token: refreshToken,
        });
        this.refreshPromise = this.requestToken(body);
        try {
            return await this.refreshPromise;
        }
        finally {
            this.refreshPromise = null;
        }
    }
    async clearToken() {
        await this.storage.clear();
    }
    isTokenValid(token) {
        if (!token.accessToken) {
            return false;
        }
        return Date.now() < token.expiresAt - this.expiryBuffer;
    }
    async requestToken(body) {
        try {
            const fetchFn = this.config.fetch ?? fetch;
            const proxyDispatcher = !this.config.fetchOptions?.['dispatcher']
                ? await getOrInitProxyDispatcher()
                : undefined;
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(this.config.fetchOptions?.headers ?? {}),
            };
            const fetchOptions = {
                ...this.config.fetchOptions,
                method: 'POST',
                headers,
                body: body.toString(),
            };
            if (proxyDispatcher) {
                fetchOptions['dispatcher'] = proxyDispatcher;
            }
            const response = await fetchFn(this.tokenUrl, fetchOptions);
            if (!response.ok) {
                const errorBody = await response.text();
                let errorDetail;
                try {
                    const parsed = JSON.parse(errorBody);
                    errorDetail = parsed.error_description ?? parsed.error ?? errorBody;
                }
                catch {
                    errorDetail = errorBody;
                }
                throw new ParasutAuthError([{ title: 'Authentication Failed', detail: errorDetail }], undefined, errorBody);
            }
            const data = (await response.json());
            const token = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + data.expires_in * 1000,
                tokenType: data.token_type,
            };
            await this.storage.set(token);
            return token;
        }
        catch (error) {
            if (error instanceof ParasutAuthError) {
                throw error;
            }
            if (error instanceof Error) {
                throw new ParasutNetworkError(`OAuth request failed: ${error.message}`, 'OAUTH_ERROR', error);
            }
            throw error;
        }
    }
}
//# sourceMappingURL=OAuth.js.map