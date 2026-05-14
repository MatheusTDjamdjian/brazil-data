import { Injectable, OnModuleInit } from '@nestjs/common';
import { logger } from '../../common/logger';

/**
 * Tipo apagado para o handler de uma tool carregada do @brazil-data/mcp-server.
 * Mantemos `any` apenas na fronteira da importação dinâmica; uso interno é tipado
 * por consumidores que conhecem o shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolHandler = any;

/**
 * Carrega o pacote `@brazil-data/mcp-server` (ESM) via dynamic import e expõe
 * as ferramentas para o AgentService consumir in-process. Mantemos o pacote
 * MCP usável standalone (Claude Desktop) sem mudar uma linha aqui.
 */
@Injectable()
export class McpService implements OnModuleInit {
  private toolMap = new Map<string, AnyToolHandler>();
  private toolList: AnyToolHandler[] = [];

  async onModuleInit(): Promise<void> {
    // Import via root export do mcp-server (src/index.ts re-exporta tools).
    // Evita o subpath exports que requer moduleResolution=node16/bundler.
    const mod = (await import('@brazil-data/mcp-server')) as {
      tools: AnyToolHandler[];
    };
    this.toolList = mod.tools;
    for (const t of this.toolList) {
      this.toolMap.set(t.name, t);
    }
    logger.info(
      { count: this.toolList.length, names: this.toolList.map((t) => t.name) },
      'mcp.tools.loaded',
    );
  }

  /** Lista de todas as tools carregadas (mesma ordem do pacote MCP). */
  list(): AnyToolHandler[] {
    return this.toolList;
  }

  /** Busca tool pelo nome (null-safe). */
  get(name: string): AnyToolHandler | undefined {
    return this.toolMap.get(name);
  }
}
