import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CacheService } from '../src/common/cache.service';
import { PrismaService } from '../src/common/prisma.service';
import { McpService } from '../src/modules/mcp/mcp.service';
import { FakeMcpService } from './fakes/fake-mcp.service';
import { FakePrismaService } from './fakes/fake-prisma.service';

interface SseEvent {
  event: string;
  data: unknown;
}

function parseSse(raw: string): SseEvent[] {
  const events: SseEvent[] = [];
  for (const block of raw.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    let event = 'message';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) continue;
    try {
      events.push({ event, data: JSON.parse(data) });
    } catch {
      events.push({ event, data });
    }
  }
  return events;
}

// ============================================================
// Mock global de fetch (MSW conflita com Jest CJS).
// ============================================================
type FetchHandler = (url: string) => Response | undefined;
const handlers: FetchHandler[] = [];
let originalFetch: typeof fetch;

beforeAll(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const h of handlers) {
      const r = h(url);
      if (r) return r;
    }
    throw new Error(`fetch sem mock no e2e: ${url}`);
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

// ============================================================

describe('API e2e (zero-LLM agent + cache + metrics + conversas)', () => {
  let app: INestApplication;
  let cache: CacheService;
  let prisma: FakePrismaService;

  beforeAll(async () => {
    delete process.env.REDIS_URL;
    process.env.ENABLE_RESPONSE_CACHE = 'true';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useClass(FakePrismaService)
      .overrideProvider(McpService)
      .useClass(FakeMcpService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    cache = app.get(CacheService);
    prisma = app.get<FakePrismaService>(PrismaService as never);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    handlers.length = 0;
    await cache.flush();
    // limpa dados in-memory do fake entre testes
    prisma.conversations.length = 0;
    prisma.messagesStore.length = 0;
    prisma.requestMetrics.length = 0;
  });

  async function postChat(
    body: object,
    userId = 'test-user',
  ): Promise<{ raw: string; events: SseEvent[] }> {
    const res = await request(app.getHttpServer())
      .post('/chat')
      .set('x-user-id', userId)
      .send(body)
      .buffer(true)
      .parse((res, cb) => {
        let buf = '';
        res.on('data', (chunk: Buffer) => (buf += chunk.toString('utf8')));
        res.on('end', () => cb(null, buf));
      });
    const raw = (res.body as string) ?? '';
    return { raw, events: parseSse(raw) };
  }

  // ----------------------------------------------------------------
  // /chat — fluxo básico
  // ----------------------------------------------------------------
  describe('POST /chat', () => {
    it('valida CPF (sem HTTP) e marca cached=false', async () => {
      const { events } = await postChat({ message: 'O CPF 111.444.777-35 é válido?' });
      const types = events.map((e) => e.event);
      expect(types).toEqual(['intent', 'tool_call', 'tool_result', 'text', 'done']);

      const done = events[4].data as { intent: string; cached: boolean };
      expect(done.intent).toBe('cpf_validate');
      expect(done.cached).toBe(false);
    });

    it('responde help para texto desconhecido', async () => {
      const { events } = await postChat({ message: 'oi tudo bem?' });
      expect((events[0].data as { intent: string }).intent).toBe('unknown');
      expect((events[1].data as { text: string }).text).toContain('Posso consultar');
    });

    it('rejeita body sem message', async () => {
      const res = await request(app.getHttpServer()).post('/chat').send({});
      expect(res.status).toBe(400);
    });
  });

  // ----------------------------------------------------------------
  // Cache de resposta — 2ª chamada igual vem do cache
  // ----------------------------------------------------------------
  describe('Cache de resposta', () => {
    it('segunda consulta idêntica vem do cache (sem novo fetch)', async () => {
      let cnpjHits = 0;
      handlers.push((url) => {
        if (!url.includes('/cnpj/v1/11222333000181')) return undefined;
        cnpjHits += 1;
        return new Response(
          JSON.stringify({
            cnpj: '11222333000181',
            razao_social: 'EMPRESA CACHE',
            descricao_situacao_cadastral: 'ATIVA',
            cnae_fiscal: 0,
            cnae_fiscal_descricao: '',
            cnaes_secundarios: [],
            municipio: 'SAO PAULO',
            uf: 'SP',
            opcao_pelo_simples: false,
            opcao_pelo_mei: false,
            qsa: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      });

      const r1 = await postChat({ message: 'situação do CNPJ 11.222.333/0001-81' });
      const r2 = await postChat({ message: 'situação do CNPJ 11.222.333/0001-81' });

      expect(cnpjHits).toBe(1); // só 1 fetch real

      const done1 = r1.events.find((e) => e.event === 'done')!.data as { cached: boolean };
      const done2 = r2.events.find((e) => e.event === 'done')!.data as { cached: boolean };
      expect(done1.cached).toBe(false);
      expect(done2.cached).toBe(true);

      // ambos contêm a razão social formatada
      const text1 = r1.events.find((e) => e.event === 'text')!.data as { text: string };
      const text2 = r2.events.find((e) => e.event === 'text')!.data as { text: string };
      expect(text1.text).toContain('EMPRESA CACHE');
      expect(text2.text).toBe(text1.text);
    });

    it('não cacheia erros', async () => {
      let hits = 0;
      handlers.push((url) => {
        if (!url.includes('/cnpj/v1/11222333000181')) return undefined;
        hits += 1;
        return new Response('boom', { status: 500 });
      });

      const r1 = await postChat({ message: 'situação do CNPJ 11.222.333/0001-81' });
      const r2 = await postChat({ message: 'situação do CNPJ 11.222.333/0001-81' });

      // segunda chamada precisa hitar de novo porque erro não é cacheado
      expect(hits).toBe(2);
      const done1 = r1.events.find((e) => e.event === 'done')!.data as { cached: boolean };
      const done2 = r2.events.find((e) => e.event === 'done')!.data as { cached: boolean };
      expect(done1.cached).toBe(false);
      expect(done2.cached).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // /conversations
  // ----------------------------------------------------------------
  describe('GET /conversations', () => {
    it('lista conversas do usuário (do mais recente)', async () => {
      await postChat({ message: 'ajuda' }, 'alice');
      await postChat({ message: 'help' }, 'alice');
      await postChat({ message: 'comandos' }, 'bob');

      const res = await request(app.getHttpServer())
        .get('/conversations')
        .set('x-user-id', 'alice');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].messageCount).toBe(2); // 1 user + 1 assistant
    });

    it('GET /conversations/:id retorna detalhe com mensagens', async () => {
      const r = await postChat({ message: 'ajuda' }, 'alice');
      const done = r.events.find((e) => e.event === 'done')!.data as { conversationId: string };

      const res = await request(app.getHttpServer())
        .get(`/conversations/${done.conversationId}`)
        .set('x-user-id', 'alice');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(done.conversationId);
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].role).toBe('user');
      expect(res.body.messages[1].role).toBe('assistant');
    });

    it('404 quando conversa pertence a outro usuário', async () => {
      const r = await postChat({ message: 'ajuda' }, 'alice');
      const done = r.events.find((e) => e.event === 'done')!.data as { conversationId: string };

      const res = await request(app.getHttpServer())
        .get(`/conversations/${done.conversationId}`)
        .set('x-user-id', 'bob');
      expect(res.status).toBe(404);
    });
  });

  // ----------------------------------------------------------------
  // /admin/metrics
  // ----------------------------------------------------------------
  describe('GET /admin/metrics', () => {
    it('summary devolve total + cache hit rate', async () => {
      handlers.push((url) => {
        if (!url.includes('/cnpj/v1/11222333000181')) return undefined;
        return new Response(
          JSON.stringify({
            cnpj: '11222333000181',
            razao_social: 'M',
            descricao_situacao_cadastral: 'ATIVA',
            cnae_fiscal: 0,
            cnae_fiscal_descricao: '',
            cnaes_secundarios: [],
            opcao_pelo_simples: false,
            opcao_pelo_mei: false,
            qsa: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      });

      await postChat({ message: 'cnpj 11.222.333/0001-81' }); // miss
      await postChat({ message: 'cnpj 11.222.333/0001-81' }); // hit
      await postChat({ message: 'ajuda' }); // help (sem cache)

      const res = await request(app.getHttpServer()).get('/admin/metrics/summary');
      expect(res.status).toBe(200);
      expect(res.body.totalQueries).toBe(3);
      // 1 de 3 foi cache → ~33%
      expect(res.body.cacheHitRate).toBeCloseTo(1 / 3, 2);
      expect(res.body.avgDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('intents agrupa por intent', async () => {
      await postChat({ message: 'ajuda' });
      await postChat({ message: 'help' });
      await postChat({ message: 'O CPF 111.444.777-35 é válido?' });

      const res = await request(app.getHttpServer()).get('/admin/metrics/intents');
      expect(res.status).toBe(200);
      const map = new Map(
        res.body.map((r: { intent: string; count: number }) => [r.intent, r.count]),
      );
      expect(map.get('help')).toBe(2);
      expect(map.get('cpf_validate')).toBe(1);
    });

    it('unknown retorna perguntas que não bateram em intent', async () => {
      await postChat({ message: 'oi quanto custa isso' });
      await postChat({ message: 'me explica direito' });

      const res = await request(app.getHttpServer()).get('/admin/metrics/unknown');
      expect(res.status).toBe(200);
      const msgs = res.body.map((r: { userMessage: string }) => r.userMessage);
      expect(msgs).toContain('oi quanto custa isso');
      expect(msgs).toContain('me explica direito');
    });
  });

  // ----------------------------------------------------------------
  // /contabil/analise-empresa
  // ----------------------------------------------------------------
  describe('POST /contabil/analise-empresa', () => {
    function mockCnpjOk(payload: Record<string, unknown>): void {
      handlers.push((url) => {
        if (!url.includes('/cnpj/v1/11222333000181')) return undefined;
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      });
    }

    it('devolve ficha consolidada com alertas (empresa ativa optante Simples)', async () => {
      mockCnpjOk({
        cnpj: '11222333000181',
        razao_social: 'EMPRESA OK LTDA',
        nome_fantasia: 'OK',
        descricao_situacao_cadastral: 'ATIVA',
        data_situacao_cadastral: '2010-01-15',
        data_inicio_atividade: '2010-01-15',
        cnae_fiscal: 6201501,
        cnae_fiscal_descricao: 'Desenvolvimento de software',
        cnaes_secundarios: [],
        municipio: 'SAO PAULO',
        uf: 'SP',
        porte: 'DEMAIS',
        capital_social: 100000,
        opcao_pelo_simples: true,
        data_opcao_pelo_simples: '2014-01-01',
        opcao_pelo_mei: false,
        qsa: [
          { nome_socio: 'A', qualificacao_socio: 'Sócio' },
          { nome_socio: 'B', qualificacao_socio: 'Sócio' },
        ],
      });

      const res = await request(app.getHttpServer())
        .post('/contabil/analise-empresa')
        .send({ cnpj: '11.222.333/0001-81' });

      expect(res.status).toBe(201);
      expect(res.body.razaoSocial).toBe('EMPRESA OK LTDA');
      expect(res.body.situacao).toEqual({
        descricao: 'ATIVA',
        ativa: true,
        desde: '2010-01-15',
      });
      expect(res.body.fundacao.idadeAnos).toBeGreaterThanOrEqual(15);
      expect(res.body.simples.optante).toBe(true);

      const alertas = res.body.alertas as Array<{ tipo: string; nivel: string }>;
      const tipos = alertas.map((a) => a.tipo);
      expect(tipos).toContain('optante_simples');
      expect(tipos).not.toContain('situacao_irregular');
      expect(tipos).not.toContain('sem_capital');
    });

    it('marca alerta de situação irregular e MEI quando aplicável', async () => {
      mockCnpjOk({
        cnpj: '11222333000181',
        razao_social: 'MEI SUSPENSO',
        descricao_situacao_cadastral: 'SUSPENSA',
        cnae_fiscal: 0,
        cnae_fiscal_descricao: '',
        cnaes_secundarios: [],
        opcao_pelo_simples: true,
        opcao_pelo_mei: true,
        capital_social: 0,
        qsa: [],
      });

      const res = await request(app.getHttpServer())
        .post('/contabil/analise-empresa')
        .send({ cnpj: '11222333000181' });
      expect(res.status).toBe(201);

      const tipos = (res.body.alertas as Array<{ tipo: string }>).map((a) => a.tipo);
      expect(tipos).toContain('situacao_irregular');
      expect(tipos).toContain('mei');
      expect(tipos).toContain('sem_capital');

      const irregular = (res.body.alertas as Array<{ tipo: string; nivel: string }>).find(
        (a) => a.tipo === 'situacao_irregular',
      );
      expect(irregular?.nivel).toBe('erro');
    });

    it('vira 404 quando CNPJ não existe', async () => {
      handlers.push((url) => {
        if (!url.includes('/cnpj/v1/')) return undefined;
        return new Response(null, { status: 404 });
      });

      const res = await request(app.getHttpServer())
        .post('/contabil/analise-empresa')
        .send({ cnpj: '11222333000181' });
      expect(res.status).toBe(404);
    });

    it('rejeita body sem cnpj', async () => {
      const res = await request(app.getHttpServer()).post('/contabil/analise-empresa').send({});
      expect(res.status).toBe(400);
    });
  });

  // ----------------------------------------------------------------
  // /admin/cache (flush)
  // ----------------------------------------------------------------
  describe('DELETE /admin/cache', () => {
    it('limpa o cache (próxima request idêntica refaz a tool call)', async () => {
      let hits = 0;
      handlers.push((url) => {
        if (!url.includes('/cnpj/v1/11222333000181')) return undefined;
        hits += 1;
        return new Response(
          JSON.stringify({
            cnpj: '11222333000181',
            razao_social: 'X',
            descricao_situacao_cadastral: 'ATIVA',
            cnae_fiscal: 0,
            cnae_fiscal_descricao: '',
            cnaes_secundarios: [],
            opcao_pelo_simples: false,
            opcao_pelo_mei: false,
            qsa: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      });

      await postChat({ message: 'cnpj 11.222.333/0001-81' }); // miss → 1 fetch
      await postChat({ message: 'cnpj 11.222.333/0001-81' }); // hit cache → 0 fetch
      expect(hits).toBe(1);

      const flush = await request(app.getHttpServer()).delete('/admin/cache');
      expect(flush.status).toBe(200);
      expect(flush.body).toEqual({ flushed: true, enabled: true });

      await postChat({ message: 'cnpj 11.222.333/0001-81' }); // miss de novo
      expect(hits).toBe(2);
    });
  });

  // ----------------------------------------------------------------
  // /health
  // ----------------------------------------------------------------
  it('GET /health inclui check de cache (in-memory)', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.db.ok).toBe(true);
    expect(res.body.checks.mcp.ok).toBe(true);
    expect(res.body.checks.cache.ok).toBe(true);
    expect(res.body.checks.cache.detail).toBe('memory');
  });
});
