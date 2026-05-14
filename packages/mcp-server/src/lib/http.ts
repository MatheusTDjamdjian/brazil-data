import { logger } from './logger.js';
import { ExternalApiError, NotFoundError } from './errors.js';

export interface HttpOptions {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  headers?: Record<string, string>;
  /** Quando true, 404 vira NotFoundError em vez de ExternalApiError. */
  notFoundOk?: boolean;
}

const DEFAULTS = {
  timeoutMs: 10_000,
  retries: 2,
  backoffMs: 500,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch JSON com timeout + retry com backoff exponencial em 5xx/rede.
 * 4xx não é retried. Status 404 vira NotFoundError quando notFoundOk=true.
 */
export async function fetchJson<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
  const {
    timeoutMs = DEFAULTS.timeoutMs,
    retries = DEFAULTS.retries,
    backoffMs = DEFAULTS.backoffMs,
    headers = {},
    notFoundOk = false,
  } = opts;

  let lastErr: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const started = Date.now();

    try {
      const res = await fetch(url, { signal: ac.signal, headers });
      clearTimeout(timer);
      const duration = Date.now() - started;

      if (res.status === 404 && notFoundOk) {
        logger.debug({ url, status: 404, duration }, 'http.notFound');
        throw new NotFoundError(`Não encontrado: ${url}`, { url });
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.warn({ url, status: res.status, attempt, duration }, 'http.nonOk');

        // 4xx: don't retry
        if (res.status >= 400 && res.status < 500) {
          throw new ExternalApiError(`HTTP ${res.status} em ${url}`, res.status, {
            body: body.slice(0, 500),
          });
        }
        // 5xx: retry
        if (attempt < retries) {
          await sleep(backoffMs * Math.pow(2, attempt));
          continue;
        }
        throw new ExternalApiError(
          `HTTP ${res.status} após ${retries} retries: ${url}`,
          res.status,
          { body: body.slice(0, 500) },
        );
      }

      logger.debug({ url, status: res.status, duration }, 'http.ok');
      return (await res.json()) as T;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof ExternalApiError || e instanceof NotFoundError) throw e;

      lastErr = e as Error;
      const isAbort = (e as { name?: string })?.name === 'AbortError';
      logger.warn({ url, err: (e as Error).message, attempt, isAbort }, 'http.err');

      if (attempt < retries) {
        await sleep(backoffMs * Math.pow(2, attempt));
        continue;
      }
      throw new ExternalApiError(`Falha de rede em ${url}: ${(e as Error).message}`, undefined, {
        original: (e as Error).message,
        isAbort,
      });
    }
  }

  throw new ExternalApiError(`Falha desconhecida em ${url}: ${lastErr?.message ?? '?'}`);
}
