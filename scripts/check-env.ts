import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import chalk from 'chalk';

const BoolFromString = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const lower = v.toLowerCase().trim();
  if (lower === '') return undefined;
  return lower === 'true' || lower === '1' || lower === 'yes';
}, z.boolean());

export const EnvSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/mcp_contabil'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  HISTORY_MAX_TURNS: z.coerce.number().int().positive().default(6),
  ENABLE_RESPONSE_CACHE: BoolFromString.default(true),
  RESPONSE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Valida o ambiente. `.env` é OPCIONAL — sem ele, usa-se só os defaults,
 * que já batem com o docker-compose.yml. Esse projeto não exige nenhuma
 * chave externa.
 */
export function validateEnv(envPath?: string): Env {
  const root = process.cwd();
  const envFile = envPath ?? join(root, '.env');

  if (existsSync(envFile)) {
    loadEnv({ path: envFile, override: true });
  }

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `         • ${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('\n');
    throw new Error('Configuração inválida:\n' + issues);
  }

  // Escreve os defaults aplicados de volta no process.env para que
  // subprocessos (Prisma, NestJS, Next.js) herdem o env completo
  // mesmo quando o usuário não criou um arquivo .env.
  for (const [k, v] of Object.entries(result.data)) {
    if (process.env[k] === undefined || process.env[k] === '') {
      process.env[k] = String(v);
    }
  }

  return result.data;
}

const isCLI = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/check-env.ts');
if (isCLI) {
  try {
    const env = validateEnv();
    const envExists = existsSync(join(process.cwd(), '.env'));
    console.log(
      '  ' +
        chalk.green('✓') +
        ' Configuração OK' +
        (envExists ? '' : ' (sem .env, usando defaults)'),
    );
    console.log(chalk.dim(`    portas:  API ${env.API_PORT}, Web ${env.WEB_PORT}`));
    console.log(
      chalk.dim(
        `    cache resposta:  ${env.ENABLE_RESPONSE_CACHE} (TTL ${env.RESPONSE_CACHE_TTL_SECONDS}s)`,
      ),
    );
  } catch (err) {
    console.error('  ' + chalk.red('✗') + ' ' + (err as Error).message);
    console.error('');
    process.exit(1);
  }
}
