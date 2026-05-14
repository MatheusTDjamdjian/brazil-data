import { z } from 'zod';

const BoolFromString = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const lower = v.toLowerCase().trim();
  if (lower === '') return undefined;
  return lower === 'true' || lower === '1' || lower === 'yes';
}, z.boolean());

/**
 * Configuração da API. Nenhuma variável é obrigatória — defaults
 * casam com o `docker-compose.yml` do projeto. Sem chave de API
 * externa: o agente é 100% determinístico (zero-LLM).
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/mcp_contabil'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  HISTORY_MAX_TURNS: z.coerce.number().int().positive().default(6),
  ENABLE_RESPONSE_CACHE: BoolFromString.default(true),
  RESPONSE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração inválida:\n${issues}`);
  }
  return result.data;
}
