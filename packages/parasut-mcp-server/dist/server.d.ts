/**
 * Paraşüt MCP Server
 *
 * Model Context Protocol server for Paraşüt API.
 * Provides tools for Turkish accounting and invoicing operations.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { type ServerConfig } from './config.js';
/**
 * Creates and configures the MCP server.
 */
export declare function createServer(config: ServerConfig): Server;
export { startHttpServer, createHttpServer, type HttpServerOptions } from './http.js';
/**
 * Starts the MCP server (stdio or HTTP depending on environment).
 */
export declare function startServer(): Promise<void>;
//# sourceMappingURL=server.d.ts.map