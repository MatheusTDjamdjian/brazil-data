import { execSync } from 'node:child_process';
import chalk from 'chalk';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  hint?: string;
}

function checkNode(): Check {
  const version = process.versions.node;
  const major = Number.parseInt(version.split('.')[0] ?? '0', 10);
  if (major < 20) {
    return {
      name: 'Node.js',
      ok: false,
      detail: `v${version} (precisa de v20+)`,
      hint: 'Instale Node 20+ em https://nodejs.org ou use nvm: nvm install 20',
    };
  }
  return { name: 'Node.js', ok: true, detail: `v${version}` };
}

function checkPnpm(): Check {
  try {
    const version = execSync('pnpm --version', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    return { name: 'pnpm', ok: true, detail: version };
  } catch {
    return {
      name: 'pnpm',
      ok: false,
      detail: 'não encontrado',
      hint: 'Instale com: npm install -g pnpm',
    };
  }
}

function checkDocker(): Check {
  try {
    const version = execSync('docker info --format "{{.ServerVersion}}"', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    return { name: 'Docker', ok: true, detail: version };
  } catch {
    return {
      name: 'Docker',
      ok: false,
      detail: 'não encontrado ou não está rodando',
      hint:
        'Inicie o Docker Desktop, ou instale em https://docker.com.\n' +
        '         Alternativa: pnpm start:nodocker (precisa Postgres+Redis externos)',
    };
  }
}

function checkDockerCompose(): Check {
  try {
    const version = execSync('docker compose version --short', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    return { name: 'docker compose', ok: true, detail: `v${version}` };
  } catch {
    return {
      name: 'docker compose',
      ok: false,
      detail: 'não encontrado',
      hint: 'Atualize o Docker Desktop para uma versão com Compose v2 embutido.',
    };
  }
}

export async function checkPrereqs(): Promise<void> {
  const skipDocker = process.env.NO_DOCKER === '1';

  const checks: Check[] = [checkNode(), checkPnpm()];
  if (!skipDocker) {
    checks.push(checkDocker(), checkDockerCompose());
  }

  for (const c of checks) {
    const icon = c.ok ? chalk.green('✓') : chalk.red('✗');
    const name = c.name.padEnd(15);
    console.log(`  ${icon} ${name} ${chalk.dim(c.detail)}`);
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    console.error('');
    console.error(chalk.red(`  ${failed.length} pré-requisito(s) faltando:`));
    for (const c of failed) {
      console.error('');
      console.error(chalk.yellow(`    ${c.name}: ${c.detail}`));
      if (c.hint) console.error(chalk.dim(`      → ${c.hint}`));
    }
    console.error('');
    process.exit(1);
  }
}

const isCLI = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/check-prereqs.ts');
if (isCLI) {
  checkPrereqs().catch((err) => {
    console.error(chalk.red((err as Error).message ?? String(err)));
    process.exit(1);
  });
}
