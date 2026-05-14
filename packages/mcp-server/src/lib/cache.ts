import { logger } from './logger.js';

export interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  delete(key: string): Promise<void>;
  flush(): Promise<void>;
  close(): Promise<void>;
}

/** Cache em memória — TTL absoluto, sem LRU. Suficiente para 1 processo. */
class InMemoryCache implements CacheBackend {
  private store = new Map<string, { value: string; expiresAt: number }>();

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

/** Cache Redis — usado quando REDIS_URL está setado. Lazy import para evitar peso. */
class RedisCache implements CacheBackend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly client: any) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(`brazil-data:${key}`);
  }

  async set(key: string, value: string, ttlSec: number): Promise<void> {
    await this.client.set(`brazil-data:${key}`, value, 'EX', ttlSec);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(`brazil-data:${key}`);
  }

  async flush(): Promise<void> {
    // Apaga somente chaves do nosso namespace
    const keys = await this.client.keys('brazil-data:*');
    if (keys.length > 0) await this.client.del(...keys);
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

let _cache: CacheBackend | null = null;
let _initPromise: Promise<CacheBackend> | null = null;

async function init(): Promise<CacheBackend> {
  const url = process.env.REDIS_URL;
  const disableRedis = process.env.MCP_DISABLE_REDIS === '1';

  if (url && !disableRedis) {
    try {
      const { Redis } = await import('ioredis');
      const client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        retryStrategy: (times: number) => Math.min(times * 200, 2000),
      });
      await client.connect();
      logger.info({ url }, 'cache.redis.connected');
      return new RedisCache(client);
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'cache.redis.failed — falling back to in-memory');
    }
  }

  logger.debug({}, 'cache.inMemory');
  return new InMemoryCache();
}

async function getCache(): Promise<CacheBackend> {
  if (_cache) return _cache;
  if (!_initPromise) _initPromise = init();
  _cache = await _initPromise;
  return _cache;
}

export const cache = {
  async get(key: string): Promise<string | null> {
    return (await getCache()).get(key);
  },
  async set(key: string, value: string, ttlSec: number): Promise<void> {
    return (await getCache()).set(key, value, ttlSec);
  },
  async delete(key: string): Promise<void> {
    return (await getCache()).delete(key);
  },
  async flush(): Promise<void> {
    return (await getCache()).flush();
  },
  async close(): Promise<void> {
    if (_cache) await _cache.close();
    _cache = null;
    _initPromise = null;
  },
};

/** Helper para testes: força reset do singleton. */
export async function __resetCacheForTests(): Promise<void> {
  if (_cache) await _cache.flush();
  _cache = null;
  _initPromise = null;
}
