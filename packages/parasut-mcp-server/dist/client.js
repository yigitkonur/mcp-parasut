/**
 * Paraşüt SDK Client
 *
 * Singleton client for the Paraşüt API.
 * Initialized once at server startup and reused for all tool calls.
 */
import { ParasutClient, } from '@yigitkonur/parasut-node-sdk';
let client = null;
/**
 * Initializes the Paraşüt client singleton.
 * Must be called once at server startup with valid configuration.
 */
export function initializeClient(config) {
    if (client) {
        return client;
    }
    const clientOptions = {
        ...(config.companyId !== undefined && { companyId: config.companyId }),
        ...(config.baseUrl !== undefined && { baseUrl: config.baseUrl }),
    };
    if (config.clientId && config.clientSecret) {
        clientOptions.credentials = {
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            ...(config.username !== undefined && { username: config.username }),
            ...(config.password !== undefined && { password: config.password }),
            ...(config.refreshToken !== undefined && { refreshToken: config.refreshToken }),
        };
    }
    if (config.accessToken) {
        clientOptions.accessToken = config.accessToken;
    }
    if (config.refreshToken) {
        clientOptions.refreshToken = config.refreshToken;
    }
    client = new ParasutClient(clientOptions);
    return client;
}
/**
 * Gets the Paraşüt client singleton.
 * Throws if client has not been initialized.
 */
export function getClient() {
    if (!client) {
        throw new Error('Paraşüt client not initialized. Call initializeClient() first.');
    }
    return client;
}
/**
 * Resets the client singleton.
 * Primarily used for testing.
 */
export function resetClient() {
    client = null;
}
//# sourceMappingURL=client.js.map