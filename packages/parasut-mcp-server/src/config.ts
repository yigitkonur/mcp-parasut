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

function getEnv(name: string, required: true): string;
function getEnv(name: string, required?: false): string | undefined;
function getEnv(name: string, required = false): string | undefined {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnvInt(name: string, required: true): number;
function getEnvInt(name: string, required?: false): number | undefined;
function getEnvInt(name: string, required = false): number | undefined {
  const value = getEnv(name, required as true);
  if (value === undefined || value === '') return undefined;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid integer`);
  }
  return parsed;
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
export function loadConfig(): ServerConfig {
  const companyId = getEnvInt('PARASUT_COMPANY_ID');
  const clientId = getEnv('PARASUT_CLIENT_ID');
  const clientSecret = getEnv('PARASUT_CLIENT_SECRET');
  const username = getEnv('PARASUT_USERNAME');
  const password = getEnv('PARASUT_PASSWORD');
  const accessToken = getEnv('PARASUT_ACCESS_TOKEN');
  const refreshToken = getEnv('PARASUT_REFRESH_TOKEN');
  const baseUrl = getEnv('PARASUT_BASE_URL');

  const hasToken = Boolean(accessToken || refreshToken);
  const hasPasswordCredentials = Boolean(username && password);

  if (!hasToken && !hasPasswordCredentials) {
    throw new Error(
      'At least one authentication method must be provided: (PARASUT_ACCESS_TOKEN / PARASUT_REFRESH_TOKEN) or (PARASUT_USERNAME and PARASUT_PASSWORD)'
    );
  }

  return {
    parasut: {
      ...(companyId !== undefined && { companyId }),
      ...(clientId !== undefined && { clientId }),
      ...(clientSecret !== undefined && { clientSecret }),
      ...(username !== undefined && { username }),
      ...(password !== undefined && { password }),
      ...(accessToken !== undefined && { accessToken }),
      ...(refreshToken !== undefined && { refreshToken }),
      ...(baseUrl !== undefined && { baseUrl }),
    },
    debug: getEnv('DEBUG') === 'true',
  };
}

/**
 * Validates that all required configuration is present.
 * Call this early to fail fast on missing config.
 */
export function validateConfig(config: ServerConfig): void {
  const { parasut } = config;

  if (parasut.companyId !== undefined && parasut.companyId <= 0) {
    throw new Error('PARASUT_COMPANY_ID must be a positive integer');
  }

  const hasToken = Boolean(parasut.accessToken || parasut.refreshToken);
  const hasPasswordCredentials = Boolean(parasut.username && parasut.password);

  if (!hasToken && !hasPasswordCredentials) {
    throw new Error(
      'At least one authentication method must be provided: (accessToken/refreshToken) or (username and password)'
    );
  }

  if (hasPasswordCredentials) {
    if (!parasut.username?.trim()) {
      throw new Error('PARASUT_USERNAME cannot be empty');
    }
    if (!parasut.password?.trim()) {
      throw new Error('PARASUT_PASSWORD cannot be empty');
    }
    if (parasut.clientId !== undefined && !parasut.clientId.trim()) {
      throw new Error('PARASUT_CLIENT_ID cannot be empty');
    }
    if (parasut.clientSecret !== undefined && !parasut.clientSecret.trim()) {
      throw new Error('PARASUT_CLIENT_SECRET cannot be empty');
    }
  }
}
