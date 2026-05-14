#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './lib/logger.js';
import { createMcpServer } from './server.js';
import { tools } from './tools/index.js';

async function main(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info({ count: tools.length, names: tools.map((t) => t.name) }, 'mcp.connected');
}

main().catch((err) => {
  logger.error({ err: (err as Error).message }, 'mcp.fatal');
  process.exit(1);
});

// Re-export para consumo in-process (a camada de API importa daqui).
export { createMcpServer } from './server.js';
export * from './tools/index.js';
