# `@brazil-data/web`

Frontend Next.js 15 (App Router) do Assistente Contábil. Consome a `@brazil-data/api` via REST e SSE.

## Rotas

| Rota                  | Tipo             | Função                                                                              |
| --------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `/`                   | static           | landing com pitch e exemplos clicáveis                                              |
| `/chat`               | dynamic          | chat com SSE; aceita `?q=` (auto-envia) e `?conversation=<id>` (continua existente) |
| `/empresa`            | static           | form para entrar com CNPJ                                                           |
| `/empresa/[cnpj]`     | dynamic (server) | ficha consolidada via `/contabil/analise-empresa`                                   |
| `/conversations`      | static (client)  | lista do histórico do `X-User-Id`                                                   |
| `/conversations/[id]` | dynamic (client) | detalhe com mensagens em ordem                                                      |
| `/admin/metrics`      | static (client)  | dashboard de métricas com period selector                                           |
| `/_not-found`         | static           | 404 global                                                                          |

## Scripts

```bash
pnpm dev              # next dev (porta WEB_PORT ou 3000)
pnpm build            # next build
pnpm start            # next start
pnpm typecheck        # tsc --noEmit
pnpm lint             # next lint
```

## Variáveis de ambiente

| Variável               | Default                 | Efeito                                                                        |
| ---------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:3001` | URL da api NestJS. `NEXT_PUBLIC_*` é inlinado pelo Next no bundle do cliente. |
| `WEB_PORT`             | `3000`                  | porta do dev/start (lido pelo `next dev -p`)                                  |

## Componentes principais

```
src/components/
├── ui/                  # primitives shadcn-style
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   └── textarea.tsx
├── AppNav.tsx           # header sticky compartilhado
├── ChatInterface.tsx    # estado de turnos + SSE consumer + Markdown
├── MessageBubble.tsx    # bolha user/assistant com react-markdown
├── ToolCallBadge.tsx    # expansível com input+output JSON
├── IntentBadge.tsx
├── CacheBadge.tsx
├── EmpresaCard.tsx      # 5 seções + alertas
├── SociosTable.tsx
├── AlertasList.tsx      # color-coded por nível
├── CnpjForm.tsx         # form + validação (14 dígitos)
├── HealthIndicator.tsx  # dot verde/amarelo/vermelho no header
├── ThemeToggle.tsx      # sun/moon (next-themes)
├── ThemeProvider.tsx    # wrapper do NextThemesProvider
├── MetricsSummary.tsx   # 4 cards stat + skeleton
├── IntentBars.tsx       # barras CSS puras (zero chart lib)
├── UnknownList.tsx
└── PeriodSelector.tsx   # 24h / 7d / 30d
```

## Lib

```
src/lib/
├── types.ts             # AgentEvent, AnaliseEmpresa, ConversationSummary, etc.
├── utils.ts             # cn() (clsx+tailwind-merge), getOrCreateUserId() (localStorage UUID)
└── api.ts               # streamChat(), getAnaliseEmpresa(), listConversations(), ...
```

### SSE consumer

`streamChat()` é uma `AsyncGenerator<AgentEvent>` baseada em `fetch` + `ReadableStream.getReader()` — EventSource só suporta GET, então essa rota usa POST.

```ts
for await (const event of streamChat({ message, userId, conversationId })) {
  switch (event.type) {
    case 'intent':
      /* badge */ break;
    case 'tool_call':
      /* spinner */ break;
    case 'tool_result':
      /* show result */ break;
    case 'text':
      /* render markdown */ break;
    case 'done':
      /* save conversationId */ break;
  }
}
```

## Design system

CSS variables ao estilo shadcn em `src/app/globals.css`. Toggle de tema via `next-themes` com `attribute="class"` e suporte a system preference.

Tipografia:

- **Inter** para UI (definido no Tailwind)
- **JetBrains Mono** para dados estruturados (CNPJs, códigos)

Cores semânticas (`--primary`, `--muted`, `--destructive`, ...) suportam light e dark mode automaticamente.

## Build

`next build` gera ~120-155 kB First Load JS por rota. O dashboard de métricas usa barras CSS puras (sem chart library), o que mantém `/admin/metrics` em ~3 kB.
