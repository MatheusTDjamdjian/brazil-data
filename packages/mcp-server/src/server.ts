import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolError } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { tools } from './tools/index.js';

export interface ServerInfo {
  name: string;
  version: string;
}

const DEFAULT_INFO: ServerInfo = {
  name: 'brazil-data',
  version: '0.1.0',
};

/**
 * Cria um McpServer com todas as ferramentas registradas.
 *
 * IMPORTANTE para economia de tokens:
 * o conteúdo devolvido ao cliente MCP é a versão **enxuta** retornada por
 * `compactarParaLLM`. A versão completa só é exposta para consumidores
 * in-process (a API NestJS importa as tools direto e tem acesso ao
 * resultado bruto antes de passar pelo compactador).
 */
export function createMcpServer(info: ServerInfo = DEFAULT_INFO): McpServer {
  const server = new McpServer({
    name: info.name,
    version: info.version,
  });

  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.inputSchema.shape, async (args: unknown) => {
      const start = Date.now();
      try {
        // Zod já valida via o schema passado para o SDK; aqui args já é do tipo correto.
        const full = await tool.execute(args as never);
        const compact = tool.compactarParaLLM(full);
        const duration = Date.now() - start;
        logger.info({ tool: tool.name, duration, status: 'ok' }, 'tool.call');
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(compact) }],
        };
      } catch (e) {
        const duration = Date.now() - start;
        if (e instanceof ToolError) {
          logger.warn(
            { tool: tool.name, duration, err: e.userMessage, kind: e.name },
            'tool.call.error',
          );
          return {
            isError: true,
            content: [{ type: 'text' as const, text: e.userMessage }],
          };
        }
        const msg = (e as Error).message ?? String(e);
        logger.error({ tool: tool.name, duration, err: msg }, 'tool.call.unhandled');
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Erro interno: ${msg}` }],
        };
      }
    });
  }

  return server;
}
