import { createHash } from 'node:crypto';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { logger } from './logger';

export interface CachedResponse {
  /** Texto formatado já em Markdown PT-BR. */
  text: string;
  /** Versão completa do output da tool (para a UI). */
  full: unknown;
  /** Versão enxuta (para histórico/log). */
  compact: unknown;
  /** Nome da tool que gerou esse resultado. */
  toolName: string;
}

interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  delete(key: string): Promise<void>;
  flush(): Promise<void>;
  close(): Promise<void>;
}

class InMemoryBackend implements CacheBackend {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  async set(key: string, value: string, ttlSec: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  async flush(): Promise<void> {
    this.store.clear();
  }
  async close(): Promise<void> {
    this.store.clear();
  }
}

class RedisBackend implements CacheBackend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly client: any) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(`api:${key}`);
  }
  async set(key: string, value: string, ttlSec: number): Promise<void> {
    await this.client.set(`api:${key}`, value, 'EX', ttlSec);
  }
  async delete(key: string): Promise<void> {
    await this.client.del(`api:${key}`);
  }
  async flush(): Promise<void> {
    const keys = await this.client.keys('api:*');
    if (keys.length > 0) await this.client.del(...keys);
  }
  async close(): Promise<void> {
    await this.client.quit();
  }
}

/**
 * Cache de respostas finais do agente, indexado por (intent, args).
 *
 * Backend Redis quando `REDIS_URL` está setado E o cache está habilitado;
 * cai para in-memory se Redis falhar ou estiver desativado. A interface
 * pública é a mesma — quem chama não distingue.
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private backend: CacheBackend = new InMemoryBackend();
  private enabled = true;
  private defaultTtlSec = 3600;

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL;
    const disabled =
      process.env.ENABLE_RESPONSE_CACHE === 'false' || process.env.DISABLE_REDIS === '1';
    this.enabled = !disabled;
    this.defaultTtlSec = Number.parseInt(process.env.RESPONSE_CACHE_TTL_SECONDS ?? '3600', 10);

    if (!this.enabled) {
      logger.info({ enabled: false }, 'cache.disabled');
      return;
    }

    if (url) {
      try {
        const { Redis } = await import('ioredis');
        const client = new Redis(url, {
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          retryStrategy: (times: number) => Math.min(times * 200, 2000),
        });
        await client.connect();
        this.backend = new RedisBackend(client);
        logger.info({ url, ttl: this.defaultTtlSec }, 'cache.redis.connected');
        return;
      } catch (e) {
        logger.warn({ err: (e as Error).message }, 'cache.redis.failed — usando in-memory');
      }
    }

    logger.debug({}, 'cache.inMemory');
  }

  async onModuleDestroy(): Promise<void> {
    await this.backend.close();
  }

  // ------------- API pública -------------

  /**
   * Gera a chave de cache a partir do tipo de intent e dos args. As chaves
   * dos args são ordenadas para garantir estabilidade. Usa hash curto para
   * manter as chaves Redis com tamanho previsível.
   */
  keyFor(intent: string, args: Record<string, unknown>): string {
    const sortedKeys = Object.keys(args).sort();
    const normalized = JSON.stringify(args, sortedKeys);
    const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 12);
    return `resp:${intent}:${hash}`;
  }

  async lookup(intent: string, args: Record<string, unknown>): Promise<CachedResponse | null> {
    if (!this.enabled) return null;
    const json = await this.backend.get(this.keyFor(intent, args));
    if (!json) return null;
    try {
      return JSON.parse(json) as CachedResponse;
    } catch {
      return null;
    }
  }

  async store(
    intent: string,
    args: Record<string, unknown>,
    response: CachedResponse,
    ttlSec?: number,
  ): Promise<void> {
    if (!this.enabled) return;
    await this.backend.set(
      this.keyFor(intent, args),
      JSON.stringify(response),
      ttlSec ?? this.defaultTtlSec,
    );
  }

  async flush(): Promise<void> {
    await this.backend.flush();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Indica se o backend ativo é o Redis. */
  isRedis(): boolean {
    return this.backend instanceof RedisBackend;
  }

  /**
   * Ping para health check. Roundtrip no Redis quando esse for o backend;
   * para in-memory, devolve ok imediatamente sem custo.
   */
  async ping(): Promise<{ ok: boolean; backend: 'redis' | 'memory'; error?: string }> {
    if (!(this.backend instanceof RedisBackend)) {
      return { ok: true, backend: 'memory' };
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (this.backend as any).client;
      const reply: string = await client.ping();
      return { ok: reply === 'PONG', backend: 'redis' };
    } catch (e) {
      return { ok: false, backend: 'redis', error: (e as Error).message };
    }
  }

  /** Helper para testes: substitui o backend. */
  __setBackendForTests(b: CacheBackend): void {
    this.backend = b;
  }
}
