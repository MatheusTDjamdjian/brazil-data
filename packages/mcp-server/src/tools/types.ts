import type { ZodObject, ZodRawShape, z } from 'zod';

/**
 * Contrato para todas as ferramentas MCP do projeto.
 *
 * `execute` retorna o resultado COMPLETO (persistido no banco e mostrado no UI).
 * `compactarParaLLM` reduz para a versão enxuta enviada ao Claude — economia de tokens.
 */
export interface ToolHandler<TInput extends ZodRawShape, TOutput, TCompact> {
  /** Nome da ferramenta (snake_case). */
  readonly name: string;
  /** Descrição em português, 1 frase. Vai no schema MCP exposto ao LLM. */
  readonly description: string;
  /** Schema Zod dos inputs. */
  readonly inputSchema: ZodObject<TInput>;
  /** TTL do cache em segundos (0 = sem cache). */
  readonly cacheTtlSec: number;
  /** Capacidade do rate limit em req/min (default 30). */
  readonly rateLimit?: number;

  /** Executa a ferramenta e devolve a versão completa do resultado. */
  execute(input: z.infer<ZodObject<TInput>>): Promise<TOutput>;

  /** Reduz `output` à versão enxuta enviada ao LLM. `intencao` é opcional. */
  compactarParaLLM(output: TOutput, intencao?: string): TCompact;
}

/** Tipo apagado para colocar tools em uma coleção heterogênea. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolHandler = ToolHandler<any, any, any>;
