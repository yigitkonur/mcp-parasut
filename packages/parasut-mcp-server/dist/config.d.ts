/**
 * Configuration
 *
 * Loads configuration from environment variables.
 * All Paraşüt credentials must be provided via environment.
 */
export interface ParasutConfig {
    companyId?: number;
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
    accessToken?: string;
    refreshToken?: string;
    baseUrl?: string;
}
export interface ServerConfig {
    parasut: ParasutConfig;
    debug: boolean;
}
/**
 * Loads configuration from environment variables.
 *
 * Supported authentication methods:
 * 1. Token-based:
 *    - PARASUT_ACCESS_TOKEN: Static OAuth access token
 *    - PARASUT_REFRESH_TOKEN: OAuth refresh token
 * 2. Password grant:
 *    - PARASUT_CLIENT_ID: OAuth client ID
 *    - PARASUT_CLIENT_SECRET: OAuth client secret
 *    - PARASUT_USERNAME: Your Paraşüt username (email)
 *    - PARASUT_PASSWORD: Your Paraşüt password
 *
 * Additional environment variables:
 * - PARASUT_COMPANY_ID: Your Paraşüt company ID (firma ID, integer)
 * - PARASUT_BASE_URL: API base URL (default: https://api.parasut.com/v4)
 * - DEBUG: Enable debug logging (default: false)
 */
export declare function loadConfig(): ServerConfig;
/**
 * Validates that all required configuration is present.
 * Call this early to fail fast on missing config.
 */
export declare function validateConfig(config: ServerConfig): void;
//# sourceMappingURL=config.d.ts.map