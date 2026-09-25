/**
 * Paraşüt MCP Server
 *
 * Model Context Protocol server for Paraşüt API.
 * Provides tools for Turkish accounting and invoicing operations.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig, validateConfig } from './config.js';
import { initializeClient, getClient } from './client.js';
import { getAllTools, handleToolCall } from './tools/index.js';
// Server metadata
const SERVER_NAME = 'parasut-mcp-server';
const SERVER_VERSION = '1.0.0';
/**
 * Creates and configures the MCP server.
 */
export function createServer(config) {
    // Initialize SDK client
    initializeClient(config.parasut);
    // Create MCP server
    const server = new Server({
        name: SERVER_NAME,
        version: SERVER_VERSION,
    }, {
        capabilities: {
            tools: {},
        },
    });
    // Handle tool listing
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools = getAllTools();
        return { tools };
    });
    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const client = getClient();
        if (!client.companyId) {
            await client.resolveCompanyId();
        }
        return handleToolCall(name, args ?? {});
    });
    return server;
}
export { startHttpServer, createHttpServer } from './http.js';
/**
 * Starts the MCP server (stdio or HTTP depending on environment).
 */
export async function startServer() {
    const isHttp = process.env['MCP_TRANSPORT'] === 'http' ||
        process.env['PORT'] !== undefined ||
        process.argv.includes('--http');
    if (isHttp) {
        const config = loadConfig();
        const { startHttpServer } = await import('./http.js');
        await startHttpServer(config);
        return;
    }
    // Load and validate configuration
    const config = loadConfig();
    validateConfig(config);
    // Create server
    const server = createServer(config);
    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Log to stderr (stdout is reserved for MCP protocol)
    if (config.debug) {
        console.error(`${SERVER_NAME} v${SERVER_VERSION} started (stdio transport)`);
        console.error(`Company ID: ${config.parasut.companyId}`);
    }
}
//# sourceMappingURL=server.js.map