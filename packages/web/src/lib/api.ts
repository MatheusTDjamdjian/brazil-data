import type { AgentEvent, AnaliseEmpresa, ConversationDetail, ConversationSummary } from './types';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';

export class NotFoundError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'NotFoundError';
  }
}

export interface StreamChatInput {
  message: string;
  conversationId?: string;
  userId: string;
  signal?: AbortSignal;
}

/**
 * Consome o endpoint POST /chat (SSE) e devolve um async iterator de
 * AgentEvent. EventSource nativo só suporta GET, então usamos fetch
 * + ReadableStream + parser linha-a-linha.
 */
export async function* streamChat(input: StreamChatInput): AsyncGenerator<AgentEvent, void, void> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': input.userId,
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      message: input.message,
      conversationId: input.conversationId,
    }),
    signal: input.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`POST /chat falhou: HTTP ${res.status}. ${detail.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const event = parseSseBlock(block);
        if (event) yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseBlock(block: string): AgentEvent | null {
  let data = '';
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return JSON.parse(data) as AgentEvent;
  } catch {
    return null;
  }
}

// ---------- REST helpers ----------

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptime: number;
  checks: {
    db: { ok: boolean; detail?: string };
    mcp: { ok: boolean; detail?: string };
    cache: { ok: boolean; detail?: string };
  };
}

export async function getHealth(): Promise<HealthReport> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`/health HTTP ${res.status}`);
  return res.json() as Promise<HealthReport>;
}

/**
 * POST /contabil/analise-empresa — ficha consolidada (sem LLM).
 * Funciona server-side (não exige X-User-Id).
 */
export async function getAnaliseEmpresa(cnpj: string, init?: RequestInit): Promise<AnaliseEmpresa> {
  const res = await fetch(`${API_BASE}/contabil/analise-empresa`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cnpj }),
    cache: 'no-store',
    ...init,
  });
  if (res.status === 404) throw new NotFoundError(`CNPJ ${cnpj} não encontrado.`);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`/contabil/analise-empresa HTTP ${res.status}. ${detail.slice(0, 200)}`);
  }
  return res.json() as Promise<AnaliseEmpresa>;
}

/** GET /conversations — exige X-User-Id, então só faz sentido no client. */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const res = await fetch(`${API_BASE}/conversations`, {
    headers: { 'x-user-id': userId },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`/conversations HTTP ${res.status}`);
  return res.json() as Promise<ConversationSummary[]>;
}

// ---- /admin/metrics ----

export type MetricsPeriod = '24h' | '7d' | '30d';

export interface MetricsSummary {
  period: MetricsPeriod;
  since: string;
  totalQueries: number;
  cacheHitRate: number;
  errorRate: number;
  avgDurationMs: number;
  avgToolDurationMs: number;
}

export interface IntentMetric {
  intent: string;
  count: number;
  avgDurationMs: number;
}

export interface UnknownQuery {
  id: string;
  userMessage: string;
  createdAt: string;
}

export async function getMetricsSummary(period: MetricsPeriod): Promise<MetricsSummary> {
  const res = await fetch(`${API_BASE}/admin/metrics/summary?period=${period}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`/admin/metrics/summary HTTP ${res.status}`);
  return res.json() as Promise<MetricsSummary>;
}

export async function getMetricsByIntent(period: MetricsPeriod): Promise<IntentMetric[]> {
  const res = await fetch(`${API_BASE}/admin/metrics/intents?period=${period}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`/admin/metrics/intents HTTP ${res.status}`);
  return res.json() as Promise<IntentMetric[]>;
}

export async function getMetricsUnknown(limit = 20): Promise<UnknownQuery[]> {
  const res = await fetch(`${API_BASE}/admin/metrics/unknown?limit=${limit}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`/admin/metrics/unknown HTTP ${res.status}`);
  return res.json() as Promise<UnknownQuery[]>;
}

export async function getConversation(id: string, userId: string): Promise<ConversationDetail> {
  const res = await fetch(`${API_BASE}/conversations/${id}`, {
    headers: { 'x-user-id': userId },
    cache: 'no-store',
  });
  if (res.status === 404) throw new NotFoundError(`Conversa ${id} não encontrada.`);
  if (!res.ok) throw new Error(`/conversations/${id} HTTP ${res.status}`);
  return res.json() as Promise<ConversationDetail>;
}
