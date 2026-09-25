/**
 * Paraşüt MCP Streamable HTTP Server
 *
 * Implements the modern MCP Streamable HTTP transport specification.
 * Supports stateful sessions, SSE streaming, health checks, RFC 9728 Protected Resource Metadata,
 * RFC 8414 Authorization Server Discovery, RFC 7591 Dynamic Client Registration, PKCE Authorization,
 * and Bearer Token authentication.
 */
import http from 'node:http';
import { type ServerConfig } from './config.js';
export interface HttpServerOptions {
    port?: number | undefined;
    host?: string | undefined;
    apiKey?: string | undefined;
    corsOrigin?: string | undefined;
    publicUrl?: string | undefined;
    authRequired?: boolean | undefined;
}
/**
 * Creates and configures the HTTP server for MCP Streamable HTTP transport.
 */
export declare function createHttpServer(config: ServerConfig, options?: HttpServerOptions): http.Server;
/**
 * Starts the HTTP server and logs connection details.
 */
export declare function startHttpServer(config?: ServerConfig, options?: HttpServerOptions): Promise<http.Server>;
//# sourceMappingURL=http.d.ts.map