#!/usr/bin/env node

import { createServer as createHttpServer } from 'node:http';
import { NodeStreamableHTTPServerTransport, localhostHostValidation, localhostOriginValidation } from '@modelcontextprotocol/node';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import type { McpServer } from '@modelcontextprotocol/server';
import { closeBrowser } from './puppeteer/pool.js';
import { createServer } from './server.js';
import { loadConfig, parseCliArgs } from './config.js';
import type { IAuditorMcpConfig } from './config.js';

async function startSseServer(server: McpServer, config: IAuditorMcpConfig): Promise<void> {
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();

  const httpServer = createHttpServer(async (req, res) => {
    if (!validateHost(req, res) || !validateOrigin(req, res)) {
      return;
    }

    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('[auditor-mcp] Request handling error:', error instanceof Error ? error.message : String(error));

      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('Internal Server Error');
      }
    }
  });

  httpServer.listen(config.port, '127.0.0.1', () => {
    console.log(`[auditor-mcp] SSE server listening on http://127.0.0.1:${config.port}/`);
  });

  const shutdown = async (): Promise<void> => {
    console.log('[auditor-mcp] Shutting down...');

    await closeBrowser();

    httpServer.close();

    process.exit(0);
  };

  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });
}

async function main(): Promise<void> {
  const envConfig = loadConfig();
  const cliOverrides = parseCliArgs(process.argv.slice(2));
  const config = { ...envConfig, ...cliOverrides };

  const server = createServer(config);

  if (config.transport === 'sse') {
    await startSseServer(server, config);
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error('[auditor-mcp] Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
