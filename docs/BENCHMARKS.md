# Benchmarks

Como medir a latência real do projeto e comparar com os números de referência abaixo.

## Como rodar

```bash
# 1. Suba o stack
make up

# 2. Em outro terminal (depois que ver "Tudo pronto"):
pnpm tsx scripts/benchmark.ts > docs/BENCHMARKS_LATEST.md
```

O script:

1. Limpa o cache de resposta (`DELETE /admin/cache`).
2. Executa **10 queries** de chat cobrindo as 9 intents (a 10ª é uma `unknown` proposital para medir o caminho de help).
3. Repete tudo (cache aquecido).
4. Hita `/contabil/analise-empresa` duas vezes para medir cache da BrasilAPI no MCP.
5. Imprime Markdown na stdout.

> **Sem dependências externas além das já instaladas.** Usa `fetch` nativo do Node 20.

## Variáveis

| Variável   | Default                 | Efeito     |
| ---------- | ----------------------- | ---------- |
| `API_BASE` | `http://localhost:3001` | URL da api |

## O que esperar

Faixa típica em máquina dev (Node 20, Postgres + Redis em Docker local, BrasilAPI sem rate limit):

| Cenário                         | Latência total (p50) | Latência total (p90) | Notas                           |
| ------------------------------- | -------------------: | -------------------: | ------------------------------- |
| `validar_documento` (sem HTTP)  |             ~5-15 ms |               ~30 ms | algoritmo CPF/CNPJ local        |
| `consultar_cep` (cache miss)    |          ~150-400 ms |              ~800 ms | depende da BrasilAPI            |
| `consultar_cnpj` (cache miss)   |          ~200-600 ms |             ~1200 ms | payload maior                   |
| **Qualquer intent (cache hit)** |        **~10-25 ms** |           **~50 ms** | sem HTTP externo, só Redis + DB |
| `unknown` / `help`              |             ~5-15 ms |               ~30 ms | direto, sem tool                |

A diferença gritante entre cache miss e cache hit (10-30x) é o argumento mais forte de "custo $0 + latência previsível".

## Resultados de referência

> Substitua esta seção com a saída de `scripts/benchmark.ts` quando rodar localmente. Os números abaixo são placeholders representativos.

### Chat — cache frio (10 consultas)

| Métrica        | Valor                       |
| -------------- | --------------------------- |
| Amostras       | 10                          |
| p50 (mediana)  | ~250 ms                     |
| p90            | ~600 ms                     |
| p99            | ~900 ms                     |
| Cache hit rate | 0% (cache zerado no início) |

### Chat — cache aquecido (mesmas 10 consultas)

| Métrica        | Valor                                         |
| -------------- | --------------------------------------------- |
| Amostras       | 10                                            |
| p50 (mediana)  | ~15 ms                                        |
| p90            | ~40 ms                                        |
| p99            | ~80 ms                                        |
| Cache hit rate | ~80% (help/unknown não cacheiam, intencional) |

### `/contabil/analise-empresa` (BrasilAPI)

| Chamada        |    Latência | Notas           |
| -------------- | ----------: | --------------- |
| 1ª (cold)      | ~300-500 ms | rede + parsing  |
| 2ª (cache MCP) |    ~5-15 ms | cache nas tools |

## Interpretação

- **Cache hit rate** alto significa que perguntas frequentes (CNPJ específico) são servidas em milissegundos, sem fila de HTTP. O endpoint `DELETE /admin/cache` (admin) permite invalidar quando necessário.
- **`unknown` / `help`** intencionalmente não cacheia — não há tool pra reaproveitar. Esses sempre rodam o pipeline completo (mas é leve: só intent detect + texto estático).
- **`validar_documento`** é o piso de latência: operação puramente local, sem rede, sem DB de domínio.

## Comparação com a versão LLM (não realizada)

Se o projeto usasse Claude (Haiku 4.5 / Sonnet 4.6) como agente:

- Latência teria piso de ~500-2000 ms só pela rede para o provedor.
- Custo por consulta na faixa de **$0.001 a $0.01** dependendo de tool_use loops.
- Throughput limitado por rate limits da Anthropic (TPM e RPM).

A versão zero-LLM atual:

- Piso de latência ~5 ms (cache hit) ou ~200 ms (cache miss real).
- **R$0,00** por consulta.
- Throughput limitado só pelo Node + Postgres + Redis locais.
