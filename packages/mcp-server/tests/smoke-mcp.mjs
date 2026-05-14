#!/usr/bin/env node
// Smoke test do protocolo MCP via stdio.
//
// Spawna `node dist/index.js` e troca as 3 mensagens essenciais:
//   1. initialize  → confirma handshake
//   2. tools/list  → confirma que as 3 tools estão registradas
//   3. tools/call  → invoca validar_documento e confere o resultado
//
// Sai com código 0 se tudo passar, 1 caso contrário.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, '..', 'dist', 'index.js');

const child = spawn(process.execPath, [SERVER], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' },
});

// Em Windows, sem setEncoding os data events vêm em Buffers que podem
// fragmentar JSON-RPC entre chunks e atrapalham o parser linha-a-linha.
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');

let buffer = '';
const pending = new Map();
let nextId = 1;
let serverReady = false;
let readyResolve;
const ready = new Promise((r) => (readyResolve = r));

child.stdout.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve } = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg);
      }
    } catch (e) {
      console.error('Falha ao parsear stdout:', JSON.stringify(line), e);
    }
  }
});

child.stderr.on('data', (chunk) => {
  // Server escreve "mcp.connected" no stderr quando pronto.
  if (!serverReady && chunk.includes('mcp.connected')) {
    serverReady = true;
    readyResolve();
  }
});

child.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`✗ MCP server saiu com código ${code}`);
    process.exit(1);
  }
});

function send(method, params) {
  const id = nextId++;
  const req = { jsonrpc: '2.0', id, method, params };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify(req) + '\n');
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout aguardando ${method} (id=${id})`));
      }
    }, 5000);
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`  ✗ ${label}\n    esperado: ${e}\n    recebido: ${a}`);
    process.exit(1);
  }
  console.log(`  ✓ ${label}`);
}

function checkContains(label, value, substring) {
  if (typeof value !== 'string' || !value.includes(substring)) {
    console.error(`  ✗ ${label}\n    contém "${substring}"? recebido: ${JSON.stringify(value)}`);
    process.exit(1);
  }
  console.log(`  ✓ ${label}`);
}

async function main() {
  console.log('\n  Smoke test do MCP server (stdio JSON-RPC)\n');

  // Espera o server logar "mcp.connected" antes de mandar requests.
  await Promise.race([
    ready,
    new Promise((_, rej) => setTimeout(() => rej(new Error('Server não inicializou em 5s')), 5000)),
  ]);

  const init = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke-test', version: '1.0' },
  });
  check('initialize → serverInfo.name', init.result?.serverInfo?.name, 'brazil-data');
  notify('notifications/initialized');

  const list = await send('tools/list', {});
  const names = (list.result?.tools ?? []).map((t) => t.name).sort();
  check('tools/list → 9 ferramentas', names, [
    'calcular_prazo_fiscal',
    'consultar_banco',
    'consultar_cep',
    'consultar_cnae',
    'consultar_cnpj',
    'consultar_ddd',
    'consultar_feriados_nacionais',
    'consultar_simples_nacional',
    'validar_documento',
  ]);

  const call = await send('tools/call', {
    name: 'validar_documento',
    arguments: { documento: '11144477735', tipo: 'cpf' },
  });
  const text = call.result?.content?.[0]?.text;
  checkContains('tools/call validar_documento → contém "111.444.777-35"', text, '111.444.777-35');
  const parsed = JSON.parse(text);
  check('tools/call validar_documento → valido=true', parsed.valido, true);

  const callBad = await send('tools/call', {
    name: 'validar_documento',
    arguments: { documento: '00000000000', tipo: 'cpf' },
  });
  const parsedBad = JSON.parse(callBad.result?.content?.[0]?.text);
  check('tools/call (CPF inválido) → valido=false', parsedBad.valido, false);

  console.log('\n  ✓ Smoke test OK\n');
  child.stdin.end();
  child.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n  ✗ Smoke test falhou:', err.message);
  child.kill();
  process.exit(1);
});
