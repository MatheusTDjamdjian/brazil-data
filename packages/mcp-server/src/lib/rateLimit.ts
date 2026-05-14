import { RateLimitError } from './errors.js';

interface Bucket {
  tokens: number;
  windowStartMs: number;
}

const DEFAULT_CAPACITY = 30;
const WINDOW_MS = 60_000; // 1 min

const buckets = new Map<string, Bucket>();

/**
 * Janela deslizante simples: cada ferramenta tem até N requisições por minuto.
 * Não é precisão de chama de bilhar — é proteção contra abuso/loop.
 */
export function checkRateLimit(toolName: string, capacity = DEFAULT_CAPACITY): void {
  const now = Date.now();
  let bucket = buckets.get(toolName);

  if (!bucket || now - bucket.windowStartMs >= WINDOW_MS) {
    bucket = { tokens: capacity, windowStartMs: now };
    buckets.set(toolName, bucket);
  }

  if (bucket.tokens <= 0) {
    const waitMs = WINDOW_MS - (now - bucket.windowStartMs);
    throw new RateLimitError(
      `Limite de ${capacity} req/min atingido para ${toolName}. Aguarde ~${Math.ceil(waitMs / 1000)}s.`,
      waitMs,
      { toolName, waitMs },
    );
  }

  bucket.tokens -= 1;
}

/** Helper para testes: zera todos os buckets. */
export function __resetRateLimitForTests(): void {
  buckets.clear();
}
