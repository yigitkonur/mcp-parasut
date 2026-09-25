/**
 * Paraşüt SDK Client
 *
 * Singleton client for the Paraşüt API.
 * Initialized once at server startup and reused for all tool calls.
 */

import {
  ParasutClient,
  type ParasutClientConfig,
  MemoryTokenStorage,
} from '@yigitkonur/parasut-node-sdk';
import type { ParasutConfig } from './config.js';

let client: ParasutClient | null = null;

/**
 * Initializes the Paraşüt client singleton.
 * Must be called once at server startup with valid configuration.
 */
export function initializeClient(config: ParasutConfig): ParasutClient {
  if (client) {
    return client;
  }

  const clientOptions: ParasutClientConfig & {
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
  } = {
    companyId: config.companyId ?? 0,
    ...(config.baseUrl !== undefined && { baseUrl: config.baseUrl }),
  };

  if (config.clientId && config.clientSecret && config.username && config.password) {
    clientOptions.credentials = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password,
    };
  }

  if (config.accessToken) {
    clientOptions.accessToken = config.accessToken;
  } else if (config.refreshToken && !clientOptions.credentials) {
    clientOptions.accessToken = config.refreshToken;
  }

  if (config.refreshToken) {
    clientOptions.refreshToken = config.refreshToken;
  }

  if (config.clientId) {
    clientOptions.clientId = config.clientId;
  }

  if (config.clientSecret) {
    clientOptions.clientSecret = config.clientSecret;
  }

  if (config.refreshToken && clientOptions.credentials) {
    const tokenStorage = new MemoryTokenStorage();
    tokenStorage.set({
      accessToken: config.accessToken ?? '',
      refreshToken: config.refreshToken,
      expiresAt: config.accessToken ? Date.now() + 7200 * 1000 : 0,
      tokenType: 'Bearer',
    });
    clientOptions.tokenStorage = tokenStorage;
  }

  client = new ParasutClient(clientOptions as ParasutClientConfig);

  return client;
}

/**
 * Gets the Paraşüt client singleton.
 * Throws if client has not been initialized.
 */
export function getClient(): ParasutClient {
  if (!client) {
    throw new Error(
      'Paraşüt client not initialized. Call initializeClient() first.'
    );
  }
  return client;
}

/**
 * Resets the client singleton.
 * Primarily used for testing.
 */
export function resetClient(): void {
  client = null;
}
