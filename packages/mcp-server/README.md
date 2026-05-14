# `@brazil-data/mcp-server`

Servidor MCP (Model Context Protocol) em TypeScript que expõe 9 ferramentas de consulta a dados públicos brasileiros: CNPJ, CEP, CNAE, Simples Nacional, banco, DDD, feriados, CPF/CNPJ check digits e cálculo de prazo fiscal.

Funciona em **dois modos**:

1. **Standalone via stdio** — Claude Desktop ou qualquer cliente MCP conecta como subprocess.
2. **In-process** — outros pacotes do monorepo (a api NestJS) importam as tools como library.

Pode rodar **completamente offline** depois do primeiro hit em cada endpoint (cache local em memória).

---

## Standalone (Claude Desktop)

Build e configuração:

```bash
# Da raiz do monorepo
pnpm --filter @brazil-data/mcp-server build
```

Em `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "brazil-data": {
      "command": "node",
      "args": ["/caminho/absoluto/para/brazil-data/packages/mcp-server/dist/index.js"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Reinicie o Claude Desktop. As 9 tools aparecem disponíveis para o modelo decidir quando chamar.

## Smoke test do protocolo

```bash
pnpm --filter @brazil-data/mcp-server build
pnpm --filter @brazil-data/mcp-server test:smoke
```

Spawna o server, troca `initialize` → `tools/list` → `tools/call` (validar_documento) e valida tudo.

## In-process (de outro pacote no monorepo)

```ts
// Dynamic import (necessário se o consumidor é CJS, como NestJS)
const mod = await import('@brazil-data/mcp-server');
const tool = mod.toolMap.get('consultar_cnpj');

const full = await tool.execute({ cnpj: '11.222.333/0001-81' });
const compact = tool.compactarParaLLM(full);
```

`tools` (array ordenado) e `toolMap` (Map por nome) são exportados do entry principal. Cada handler tem:

- `name: string`
- `description: string`
- `inputSchema: ZodObject` (Zod schema)
- `cacheTtlSec: number`
- `execute(input): Promise<full>` — resposta completa
- `compactarParaLLM(full, intencao?): compact` — versão enxuta

## Scripts

```bash
pnpm dev              # tsx watch src/index.ts
pnpm build            # tsc → dist/
pnpm test             # Vitest (70 testes)
pnpm test:coverage    # com threshold 70%
pnpm test:smoke       # spawn real do MCP via stdio JSON-RPC
pnpm typecheck
pnpm lint
```

## Variáveis de ambiente

Nenhuma é obrigatória.

| Variável            | Default       | Efeito                                                           |
| ------------------- | ------------- | ---------------------------------------------------------------- |
| `LOG_LEVEL`         | `info`        | pino level (`debug`, `info`, `warn`, `error`)                    |
| `NODE_ENV`          | `development` | em `production`, logs em JSON; senão, pretty-print no stderr     |
| `REDIS_URL`         | _vazio_       | quando setado, usa Redis como backend de cache; senão, in-memory |
| `MCP_DISABLE_REDIS` | _vazio_       | `1` força in-memory mesmo com `REDIS_URL` setado                 |

> **Logs vão para stderr** (fd 2) — não corrompem o stdout do JSON-RPC.

## Estrutura

```
src/
├── index.ts          # entry stdio + re-exports
├── server.ts         # createMcpServer (wrapper de erros, log estruturado)
├── tools/            # 9 ferramentas + tipos compartilhados
│   ├── types.ts      # ToolHandler<TInput, TOutput, TCompact>
│   ├── consultarCep.ts
│   ├── consultarCnpj.ts
│   ├── validarDocumento.ts
│   ├── consultarCnae.ts
│   ├── consultarSimplesNacional.ts
│   ├── consultarBanco.ts
│   ├── consultarDdd.ts
│   ├── consultarFeriadosNacionais.ts
│   └── calcularPrazoFiscal.ts
├── providers/
│   ├── brasilApi.ts  # 6 endpoints typed
│   └── viaCep.ts     # fallback CEP
└── lib/
    ├── cache.ts      # in-memory + Redis lazy
    ├── rateLimit.ts  # 30 req/min por tool
    ├── http.ts       # fetch + timeout 10s + retry exp.
    ├── documents.ts  # CPF/CNPJ check digit + format BR
    ├── errors.ts     # ValidationError, NotFoundError, ExternalApiError, RateLimitError
    ├── logger.ts     # pino → stderr
    └── compactarParaLLM.ts  # truncarLista, semVazios
```

Detalhes de cada tool em [`docs/MCP_TOOLS.md`](../../docs/MCP_TOOLS.md).
