/**
 * Benchmark de latência do `/chat` e `/contabil/analise-empresa`.
 *
 * Uso:
 *   1. `make up` (deixe API + Postgres + Redis no ar)
 *   2. `pnpm tsx scripts/benchmark.ts`
 *
 * Saída: tabela Markdown pronta para colar no README ou em docs/BENCHMARKS.md.
 *
 * Mede:
 *   - Tempo até `done` em /chat (intent → tool_call → tool_result → text → done)
 *   - Tempo de roundtrip em /contabil/analise-empresa
 *   - Cache hit rate (executando cada query 2x consecutivamente)
 */

import { performance } from 'node:perf_hooks';

interface SseDoneEvent {
  type: 'done';
  cached: boolean;
  durationMs: number;
}

const API = process.env.API_BASE ?? 'http://localhost:3001';
const USER_ID = 'benchmark';

const CHAT_QUERIES = [
  'O CPF 111.444.777-35 é válido?',
  'Endereço do CEP 01310-100',
  'Qual a situação do CNPJ 11.222.333/0001-81?',
  'O CNPJ 11.222.333/0001-81 é optante do Simples?',
  'Que atividade é o CNAE 6201-5/01?',
  'Liste os feriados nacionais de 2026',
  'Quais cidades atendem o DDD 11?',
  'Qual o banco com código 237?',
  '15 dias úteis a partir de 2026-05-12',
  'oi tudo bem?', // unknown
];

const CNPJ_QUERIES = ['11.222.333/0001-81'];

interface Sample {
  label: string;
  totalMs: number;
  serverDurationMs: number;
  cached: boolean;
}

async function timeChat(message: string): Promise<Sample> {
  const t0 = performance.now();
  const res = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': USER_ID,
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok || !res.body) throw new Error(`POST /chat HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let done: SseDoneEvent | null = null;

  while (true) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let data = '';
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const ev = JSON.parse(data) as { type: string };
        if (ev.type === 'done') done = ev as SseDoneEvent;
      } catch {
        // ignore
      }
    }
  }

  const totalMs = performance.now() - t0;
  if (!done) throw new Error('SSE terminou sem event:done');
  return {
    label: message,
    totalMs: Math.round(totalMs),
    serverDurationMs: done.durationMs,
    cached: done.cached,
  };
}

async function timeContabil(cnpj: string): Promise<Sample> {
  const t0 = performance.now();
  const res = await fetch(`${API}/contabil/analise-empresa`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cnpj }),
  });
  if (!res.ok) throw new Error(`POST /contabil/analise-empresa HTTP ${res.status}`);
  await res.json();
  return {
    label: `analise-empresa ${cnpj}`,
    totalMs: Math.round(performance.now() - t0),
    serverDurationMs: 0,
    cached: false,
  };
}

function p(quantile: number, arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(quantile * sorted.length));
  return sorted[idx];
}

function logTable(title: string, samples: Sample[]): void {
  const times = samples.map((s) => s.totalMs);
  const cachedCount = samples.filter((s) => s.cached).length;
  process.stdout.write(`\n## ${title}\n\n`);
  process.stdout.write('| Métrica | Valor |\n|---|---|\n');
  process.stdout.write(`| Amostras | ${samples.length} |\n`);
  process.stdout.write(`| p50 (mediana) | ${p(0.5, times)} ms |\n`);
  process.stdout.write(`| p90 | ${p(0.9, times)} ms |\n`);
  process.stdout.write(`| p99 | ${p(0.99, times)} ms |\n`);
  process.stdout.write(
    `| Cache hit rate | ${((cachedCount / samples.length) * 100).toFixed(0)}% |\n`,
  );
  process.stdout.write('\n### Por consulta\n\n');
  process.stdout.write('| Consulta | Total (ms) | Server (ms) | Cache |\n|---|--:|--:|---|\n');
  for (const s of samples) {
    const label = s.label.length > 60 ? s.label.slice(0, 57) + '…' : s.label;
    process.stdout.write(
      `| ${label} | ${s.totalMs} | ${s.serverDurationMs} | ${s.cached ? '✓' : '—'} |\n`,
    );
  }
}

async function main(): Promise<void> {
  process.stdout.write(`# Benchmark · brazil-data\n`);
  process.stdout.write(`> ${new Date().toISOString()} · API=${API}\n`);

  // Limpa cache para começar do zero
  try {
    await fetch(`${API}/admin/cache`, { method: 'DELETE' });
  } catch {
    /* ignore */
  }

  // Round 1: cache cold
  const cold: Sample[] = [];
  for (const q of CHAT_QUERIES) {
    cold.push(await timeChat(q));
  }
  logTable('Chat — cache frio', cold);

  // Round 2: cache hot (mesmas queries; help/unknown não cacheiam, então ficam frias)
  const hot: Sample[] = [];
  for (const q of CHAT_QUERIES) {
    hot.push(await timeChat(q));
  }
  logTable('Chat — cache aquecido (mesmas queries)', hot);

  // Endpoint contábil
  const contabilCold: Sample[] = [];
  for (const cnpj of CNPJ_QUERIES) {
    contabilCold.push(await timeContabil(cnpj));
  }
  // hot (BrasilAPI cache via MCP é por 24h; mesmo CNPJ deve ser instantâneo)
  const contabilHot: Sample[] = [];
  for (const cnpj of CNPJ_QUERIES) {
    contabilHot.push(await timeContabil(cnpj));
  }
  logTable('/contabil/analise-empresa — primeira chamada', contabilCold);
  logTable('/contabil/analise-empresa — segunda chamada (cache MCP)', contabilHot);

  process.stdout.write('\n---\n');
  process.stdout.write(
    `_Custos LLM por consulta: **R$0,00** · agente determinístico, zero tokens._\n`,
  );
}

main().catch((err) => {
  process.stderr.write('\n✗ Benchmark falhou: ' + (err as Error).message + '\n');
  process.stderr.write('  Verifique se a API está no ar (make up).\n\n');
  process.exit(1);
});
