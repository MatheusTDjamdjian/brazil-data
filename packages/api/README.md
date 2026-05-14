# `@brazil-data/api`

Camada de orquestração NestJS: recebe perguntas do frontend, identifica intent por regex/keywords, chama tools do `@brazil-data/mcp-server`, formata resposta em Markdown PT-BR, persiste em Postgres e expõe métricas. **Zero LLM** — agente puramente determinístico.

## Endpoints

| Método   | Path                                         | Função                                                                            |
| -------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| `POST`   | `/chat`                                      | SSE: stream de eventos do agente (intent → tool_call → tool_result → text → done) |
| `GET`    | `/conversations`                             | Lista conversas do `X-User-Id` (header)                                           |
| `GET`    | `/conversations/:id`                         | Detalhe da conversa com mensagens (404 cross-user)                                |
| `POST`   | `/contabil/analise-empresa`                  | Ficha consolidada de CNPJ com 7 tipos de alerta determinísticos                   |
| `GET`    | `/admin/metrics/summary?period=24h\|7d\|30d` | totais, % cache hit, % erro, latência média                                       |
| `GET`    | `/admin/metrics/intents?period=...`          | distribuição por intent                                                           |
| `GET`    | `/admin/metrics/unknown?limit=20`            | perguntas que caíram em "unknown" (feedback loop)                                 |
| `DELETE` | `/admin/cache`                               | Limpa o cache de resposta                                                         |
| `GET`    | `/health`                                    | status DB + MCP + cache                                                           |

Detalhe dos fluxos em [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## Scripts

```bash
pnpm dev              # nest start --watch
pnpm build            # nest build
pnpm test             # Jest unit (intent-detector + cache + contabil)
pnpm test:e2e         # Jest e2e (17 testes, com fakes)
pnpm prisma:generate  # gera client
pnpm prisma:migrate   # migrate dev
pnpm prisma:deploy    # migrate deploy (produção)
pnpm typecheck
pnpm lint
```

Há também `postinstall: prisma generate || ...` para garantir que o client é gerado após `pnpm install`.

## Variáveis de ambiente

Todas têm default; só ajuste se quiser comportamento custom.

| Variável                     | Default                                                      | Efeito                                      |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| `DATABASE_URL`               | `postgresql://postgres:postgres@localhost:5432/mcp_contabil` | conexão Prisma                              |
| `REDIS_URL`                  | `redis://localhost:6379`                                     | quando setada, ativa cache em Redis         |
| `API_PORT`                   | `3001`                                                       | porta HTTP                                  |
| `HISTORY_MAX_TURNS`          | `6`                                                          | quantos turnos manter por conversa (futuro) |
| `ENABLE_RESPONSE_CACHE`      | `true`                                                       | desabilita o cache de resposta final        |
| `RESPONSE_CACHE_TTL_SECONDS` | `3600`                                                       | TTL do cache de resposta (1h)               |
| `LOG_LEVEL`                  | `info`                                                       | pino level                                  |
| `NODE_ENV`                   | `development`                                                | em `production`, logs JSON                  |
| `DISABLE_REDIS`              | _vazio_                                                      | `1` força in-memory mesmo com `REDIS_URL`   |

## Pipeline do AgentService

```
POST /chat → ChatController (SSE)
   ↓
AgentService.respondTo()
   1. Conversation upsert + persist user message
   2. IntentDetector.detect(message) → emite event:intent
   3. Help/unknown → ResponseFormatter.help() → text + done + metric
   4. Cache lookup:
      Hit  → replay (tool_call/tool_result com cached:true) + text + done + metric
      Miss → tool.execute() → tool.compactarParaLLM()
             → emit tool_call + tool_result
             → ResponseFormatter.format(intent, full)
             → cache.store(...) (só sucessos)
             → emit text + persist + metric + done
```

Cada turno persiste:

- 1 `Message` user
- 1 `Message` assistant (com `toolCalls` JSON)
- 1 `RequestMetric` (intent, toolName, cached, durationMs, userMessage)

## Estrutura

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── env.ts              # Zod-validated env
│   ├── logger.ts           # pino (pretty em dev, JSON em prod)
│   ├── prisma.service.ts
│   ├── prisma.module.ts    # @Global()
│   ├── cache.service.ts    # Redis lazy + in-memory fallback + keyFor(intent, args)
│   └── cache.module.ts     # @Global()
└── modules/
    ├── agent/
    │   ├── agent.service.ts            # pipeline determinístico
    │   ├── intent-detector.service.ts  # regex/keywords → DetectedIntent
    │   ├── response-formatter.service.ts # templates Markdown PT-BR
    │   └── agent.types.ts              # AgentEvent
    ├── chat/                # SSE controller
    ├── conversations/       # /conversations, /conversations/:id
    ├── contabil/            # /contabil/analise-empresa + 7 alertas
    ├── metrics/             # /admin/metrics/*
    ├── admin/               # DELETE /admin/cache
    ├── mcp/                 # carrega @brazil-data/mcp-server in-process
    └── health/              # /health (DB + MCP + cache)
```

## Testes

```bash
pnpm test          # 3 specs unit (cache, intent-detector, contabil) — 34 testes
pnpm test:e2e      # 1 spec e2e cobrindo o stack inteiro com fakes — 17 testes
```

**Fakes** (em `test/fakes/`):

- `FakePrismaService` — store in-memory implementando os métodos usados pelo agente, metrics, conversations.
- `FakeMcpService` — substitui `McpService` no contexto Jest (evita conflito ESM/CJS com `@modelcontextprotocol/sdk`). Reimplementa 4 tools com lógica mínima; as outras 5 são placeholders que jogam erro se chamadas.

`globalThis.fetch` é mockado por handler matching para simular BrasilAPI sem rede.

## Banco

Schema em [`prisma/schema.prisma`](./prisma/schema.prisma). 4 modelos: `Conversation`, `Message`, `EmpresaCache` (placeholder), `RequestMetric`. Usamos `db push` em desenvolvimento; troque para `migrate deploy` em produção real.

Seed em [`prisma/seed.ts`](./prisma/seed.ts) — popula 5 conversas demo com `userId='demo'` (idempotente). Auto-executado pelo `scripts/start.ts` da raiz.
