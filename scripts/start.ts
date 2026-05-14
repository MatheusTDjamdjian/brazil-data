import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import chalk from 'chalk';
import { checkPrereqs } from './check-prereqs.js';
import { validateEnv, type Env } from './check-env.js';

const ROOT = process.cwd();
const NO_DOCKER = process.env.NO_DOCKER === '1';

function header() {
  console.log('');
  console.log(chalk.bold.cyan('  ▶ Brazil Data') + chalk.dim(' — Assistente Contábil'));
  console.log('');
}

function step(n: number, total: number, label: string) {
  console.log(chalk.dim(`  [${n}/${total}]`) + ' ' + chalk.bold(label));
}

function ok(msg: string) {
  console.log('  ' + chalk.green('✓') + ' ' + msg);
}

function info(msg: string) {
  console.log('  ' + chalk.cyan('ℹ') + ' ' + chalk.dim(msg));
}

function warn(msg: string) {
  console.log('  ' + chalk.yellow('⚠') + ' ' + msg);
}

function fail(msg: string): never {
  console.error('');
  console.error('  ' + chalk.red('✗') + ' ' + msg);
  console.error('');
  process.exit(1);
}

function exec(cmd: string, silent = false): void {
  try {
    execSync(cmd, {
      stdio: silent ? 'pipe' : 'inherit',
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch (err) {
    throw new Error(`Comando falhou: ${chalk.bold(cmd)}\n         ${(err as Error).message}`);
  }
}

async function waitFor(
  label: string,
  probe: () => boolean,
  attempts = 30,
  intervalMs = 1000,
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (probe()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `${label} não respondeu após ${attempts}s. Veja os logs: ${chalk.bold('docker compose logs')}`,
  );
}

/**
 * Tenta encontrar uma porta livre a partir de `start`. Pula portas em `exclude`.
 * Lança se não houver porta livre em 100 tentativas.
 */
async function findFreePort(start: number, exclude: number[] = []): Promise<number> {
  for (let p = start; p < start + 100; p++) {
    if (exclude.includes(p)) continue;
    if (await isPortFree(p)) return p;
  }
  throw new Error(`Sem porta livre no range ${start}-${start + 100}.`);
}

function isPortFree(port: number): Promise<boolean> {
  // Checa em todas as interfaces (sem host) — espelha o que Next.js/Nest fazem
  // ao bindar em '::'. Probar só 127.0.0.1 dá falso positivo se algo já
  // ocupar o port em IPv6.
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

function probePostgres(): boolean {
  try {
    execSync('docker compose exec -T postgres pg_isready -U postgres -d mcp_contabil', {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function probeRedis(): boolean {
  try {
    execSync('docker compose exec -T redis redis-cli ping', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function banner(env: Env) {
  const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));
  const W = 58;
  const top = chalk.cyan('  ╔' + '═'.repeat(W) + '╗');
  const bot = chalk.cyan('  ╚' + '═'.repeat(W) + '╝');
  const side = chalk.cyan('║');
  console.log('');
  console.log(top);
  console.log('  ' + side + pad('  ' + chalk.bold('Tudo pronto'), W) + side);
  console.log('  ' + side + pad('', W) + side);
  console.log(
    '  ' +
      side +
      '  ' +
      chalk.green('▸') +
      ' Web    ' +
      pad(chalk.underline(`http://localhost:${env.WEB_PORT}`), W - 13) +
      side,
  );
  console.log(
    '  ' +
      side +
      '  ' +
      chalk.green('▸') +
      ' API    ' +
      pad(chalk.underline(`http://localhost:${env.API_PORT}`), W - 13) +
      side,
  );
  console.log(
    '  ' +
      side +
      '  ' +
      chalk.green('▸') +
      ' Métric ' +
      pad(chalk.underline(`http://localhost:${env.WEB_PORT}/admin/metrics`), W - 13) +
      side,
  );
  console.log('  ' + side + pad('', W) + side);
  console.log(bot);
  console.log('');
}

async function main() {
  header();
  const total = 7;

  // 1. Pré-requisitos
  step(1, total, 'Pré-requisitos');
  await checkPrereqs();

  // 2. Validar .env (opcional — defaults cobrem 100%)
  step(2, total, 'Configuração');
  const env = validateEnv();

  // Auto-fallback de porta: se a porta default estiver ocupada, sobe pra próxima.
  // API é escolhida primeiro; Web é escolhida em seguida excluindo a porta da API.
  const apiPort = await findFreePort(env.API_PORT);
  const webPort = await findFreePort(env.WEB_PORT, [apiPort]);
  if (apiPort !== env.API_PORT) {
    warn(`API_PORT ${env.API_PORT} em uso → usando ${chalk.bold(String(apiPort))}`);
  }
  if (webPort !== env.WEB_PORT) {
    warn(`WEB_PORT ${env.WEB_PORT} em uso → usando ${chalk.bold(String(webPort))}`);
  }

  // Propaga as portas escolhidas para os subprocessos
  process.env.API_PORT = String(apiPort);
  process.env.WEB_PORT = String(webPort);
  // Next.js lê PORT (não WEB_PORT)
  process.env.PORT = String(webPort);
  // Frontend aponta para a porta real da API
  process.env.NEXT_PUBLIC_API_BASE = `http://localhost:${apiPort}`;

  // Reflete no objeto env para o banner final
  env.API_PORT = apiPort;
  env.WEB_PORT = webPort;

  ok(
    `configuração OK · API ${chalk.dim(String(apiPort))} · Web ${chalk.dim(String(webPort))}`,
  );

  // 3. Dependências
  step(3, total, 'Dependências');
  if (!existsSync(join(ROOT, 'node_modules'))) {
    exec('pnpm install');
  } else {
    ok('node_modules já existe (pule com pnpm install para atualizar)');
  }

  // 4. Docker
  step(4, total, 'Postgres + Redis');
  if (NO_DOCKER) {
    info('NO_DOCKER=1 — assumindo Postgres e Redis externos');
  } else {
    exec('docker compose up -d', true);
    await waitFor('Postgres', probePostgres);
    ok('Postgres pronto');
    await waitFor('Redis', probeRedis, 15);
    ok('Redis pronto');
  }

  // 5. Prisma (generate sempre; db push + seed só se DB estiver no ar)
  step(5, total, 'Prisma (generate + db push + seed)');
  const prismaSchema = join(ROOT, 'packages/api/prisma/schema.prisma');
  if (existsSync(prismaSchema)) {
    exec('pnpm --filter @brazil-data/api exec prisma generate', true);
    ok('Prisma client gerado');
    if (!NO_DOCKER) {
      exec('pnpm --filter @brazil-data/api exec prisma db push --skip-generate');
      ok('Schema aplicado no Postgres');
      // Seed é idempotente — popula apenas na primeira execução
      try {
        exec('pnpm run seed', true);
        ok('Seed executado (idempotente)');
      } catch (e) {
        warn(`Seed falhou (continuando): ${(e as Error).message.split('\n')[0]}`);
      }
    } else {
      info('NO_DOCKER=1 — pulando db push e seed (Postgres não disponível)');
    }
  } else {
    info('Prisma ainda não disponível (chega na Onda 3)');
  }

  // 6. Build MCP server
  step(6, total, 'Build MCP server');
  const mcpPkg = join(ROOT, 'packages/mcp-server/package.json');
  if (existsSync(mcpPkg)) {
    exec('pnpm --filter @brazil-data/mcp-server build', true);
    ok('MCP server buildado');
  } else {
    info('MCP server ainda não disponível (chega na Onda 2)');
  }

  // 7. Subir API + Web
  step(7, total, 'API + Web');
  const hasApi = existsSync(join(ROOT, 'packages/api/package.json'));
  const hasWeb = existsSync(join(ROOT, 'packages/web/package.json'));

  if (!hasApi && !hasWeb) {
    warn('API e Web ainda não disponíveis (chegam nas Ondas 3 e 4)');
    console.log('');
    console.log(
      '  ' +
        chalk.green('✓') +
        ' Infraestrutura no ar. Rode ' +
        chalk.bold('pnpm start') +
        ' novamente quando os pacotes existirem.',
    );
    console.log('');
    return;
  }

  // Pelo menos um pacote existe — escolhe o script certo.
  const devScript = hasApi && hasWeb ? 'dev:all' : hasApi ? 'dev:api' : 'dev:web';

  if (!hasWeb) {
    info('Web ainda não disponível (chega na Onda 4) — subindo apenas a API');
  }

  banner(env);

  const child = spawn('pnpm', ['run', devScript], {
    stdio: 'inherit',
    cwd: ROOT,
    shell: true,
  });

  const stop = (signal: NodeJS.Signals) => {
    child.kill(signal);
    process.exit(0);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
}

main().catch((err) => {
  fail((err as Error).message ?? String(err));
});
