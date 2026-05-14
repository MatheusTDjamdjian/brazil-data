import { CacheService } from './cache.service';

describe('CacheService (in-memory)', () => {
  let cache: CacheService;

  beforeEach(async () => {
    // Garante in-memory: sem REDIS_URL e cache ligado
    delete process.env.REDIS_URL;
    process.env.ENABLE_RESPONSE_CACHE = 'true';
    cache = new CacheService();
    await cache.onModuleInit();
  });

  afterEach(async () => {
    await cache.onModuleDestroy();
  });

  describe('keyFor', () => {
    it('gera chaves estáveis independente da ordem dos args', () => {
      const k1 = cache.keyFor('cnpj_lookup', { cnpj: '123', tipo: 'cpf' });
      const k2 = cache.keyFor('cnpj_lookup', { tipo: 'cpf', cnpj: '123' });
      expect(k1).toBe(k2);
    });

    it('diferencia intents distintas', () => {
      const k1 = cache.keyFor('cnpj_lookup', { cnpj: '123' });
      const k2 = cache.keyFor('cep_lookup', { cnpj: '123' });
      expect(k1).not.toBe(k2);
    });

    it('inclui prefixo "resp:" e o intent legível', () => {
      const k = cache.keyFor('cnpj_lookup', { cnpj: '123' });
      expect(k.startsWith('resp:cnpj_lookup:')).toBe(true);
    });
  });

  describe('lookup / store', () => {
    it('store + lookup retorna o mesmo objeto', async () => {
      const intent = 'cnpj_lookup';
      const args = { cnpj: '11222333000181' };
      const payload = {
        text: 'Empresa X',
        full: { foo: 1 },
        compact: { bar: 2 },
        toolName: 'consultar_cnpj',
      };
      await cache.store(intent, args, payload, 60);
      const hit = await cache.lookup(intent, args);
      expect(hit).toEqual(payload);
    });

    it('lookup em chave inexistente devolve null', async () => {
      const r = await cache.lookup('cnpj_lookup', { cnpj: 'qualquer' });
      expect(r).toBeNull();
    });

    it('flush limpa tudo', async () => {
      await cache.store('a', { x: 1 }, { text: 't', full: {}, compact: {}, toolName: 'x' });
      await cache.flush();
      const r = await cache.lookup('a', { x: 1 });
      expect(r).toBeNull();
    });
  });

  describe('quando ENABLE_RESPONSE_CACHE=false', () => {
    it('lookup e store viram no-op', async () => {
      process.env.ENABLE_RESPONSE_CACHE = 'false';
      const c = new CacheService();
      await c.onModuleInit();
      await c.store('a', { x: 1 }, { text: 't', full: {}, compact: {}, toolName: 'x' });
      const r = await c.lookup('a', { x: 1 });
      expect(r).toBeNull();
      expect(c.isEnabled()).toBe(false);
      await c.onModuleDestroy();
    });
  });
});
