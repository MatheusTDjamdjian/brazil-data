# Ferramentas MCP

Especificação completa das 9 ferramentas expostas pelo `@brazil-data/mcp-server`. Cada tool tem:

- **Nome** (`snake_case`) que aparece em `tools/list` do MCP
- **Descrição** curta (1 frase) que vai no schema MCP
- **Input** (Zod schema) e **output completo**
- **`compactarParaLLM`** — versão enxuta usada por consumidores in-process e historicamente pelo agente
- **Cache TTL** e **fonte de dados** (BrasilAPI, ViaCEP, local)
- **Exemplos** e **casos de erro**

A ordem abaixo casa com `tools.list()` do pacote. Veja [`packages/mcp-server/src/tools/`](../packages/mcp-server/src/tools/) para o código.

---

## 1. `consultar_cep`

> Consulta endereço a partir de um CEP brasileiro (8 dígitos).

**Input**

```ts
{
  cep: string;
} // com ou sem máscara
```

**Output completo**

```ts
{
  cep: string; // formatado 00000-000
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigoIbge?: string;     // só quando vem do ViaCEP
  latitude?: string;       // só BrasilAPI
  longitude?: string;
  fonte: 'brasilapi' | 'viacep';
}
```

**`compactarParaLLM`** — endereço numa linha só:

```ts
{ cep: '01310-100', endereco: 'Avenida Paulista, Bela Vista, São Paulo/SP', fonte: 'brasilapi' }
```

**Cache**: 7 dias · **Fonte**: BrasilAPI primária → **ViaCEP** como fallback automático em 404/5xx.

**Exemplo**

```json
// Input
{ "cep": "01310-100" }

// Output (parcial)
{
  "cep": "01310-100",
  "logradouro": "Avenida Paulista",
  "bairro": "Bela Vista",
  "cidade": "São Paulo",
  "uf": "SP",
  "latitude": "-23.5616",
  "longitude": "-46.6555",
  "fonte": "brasilapi"
}
```

**Erros**

- CEP com tamanho ≠ 8 → `ValidationError`
- Não existe nas duas fontes → `NotFoundError`

---

## 2. `consultar_cnpj`

> Consulta dados cadastrais públicos de uma empresa pelo CNPJ.

**Input**

```ts
{
  cnpj: string;
} // com ou sem máscara
```

**Output completo** (resumido — campos principais)

```ts
{
  cnpj: string;            // formatado 00.000.000/0000-00
  razaoSocial: string;
  nomeFantasia?: string;
  situacao: string;        // ex: 'ATIVA', 'SUSPENSA'
  situacaoData?: string;   // ISO yyyy-mm-dd
  dataAbertura?: string;
  cnaePrincipal: { codigo: string; descricao: string };
  cnaesSecundarios: Array<{ codigo: string; descricao: string }>;
  naturezaJuridica?: string;
  porte?: string;
  capitalSocial?: number;
  endereco: { logradouro, numero, bairro, municipio, uf, cep, ... };
  contato: { telefone1?, telefone2?, email? };
  simples: { optante, dataOpcao?, dataExclusao?, mei };
  socios: Array<{ nome, qualificacao?, dataEntrada? }>;
}
```

**`compactarParaLLM`** — campos essenciais; QSA inline só se < 4 sócios, senão vira `"5 sócios (use ferramenta dedicada para detalhes)"`.

**Cache**: 24h · **Fonte**: BrasilAPI.

**Validação local pré-HTTP**: dígitos verificadores do CNPJ. Se inválido, `ValidationError` é lançado sem chamar a API externa.

**Erros**

- Tamanho ≠ 14 dígitos → `ValidationError`
- Dígitos verificadores inválidos → `ValidationError` (com formatação BR)
- 404 da BrasilAPI → `NotFoundError`

---

## 3. `validar_documento`

> Valida CPF ou CNPJ usando os dígitos verificadores (sem chamada externa).

**Input**

```ts
{ documento: string, tipo: 'cpf' | 'cnpj' | 'auto' }
```

`auto` infere pelo comprimento (≤11 = CPF, > = CNPJ).

**Output / compactarParaLLM** (são iguais — já é mínimo)

```ts
{
  valido: boolean;
  tipo: 'cpf' | 'cnpj';
  formatado: string;    // 000.000.000-00 ou 00.000.000/0000-00
  motivo?: string;      // quando valido=false
}
```

**Cache**: 0 (operação local trivial) · **Fonte**: algoritmo local · **Sem rate limit relevante**.

**Casos de "inválido"** explicados em `motivo`:

- Tamanho errado: `"CPF deve ter 11 dígitos (recebi 8)."`
- Todos dígitos iguais (`111.111.111-11`): `"Dígitos verificadores não conferem."`
- Dígitos verificadores incorretos: idem.

---

## 4. `consultar_cnae`

> Consulta atividade econômica pelo código CNAE (com ou sem máscara, 7 dígitos da subclasse).

**Input**

```ts
{
  codigo: string;
}
```

Aceita `6201501`, `6201-5/01`, `62.01-5-01` — qualquer formato com 7 dígitos.

**Output completo**

```ts
{
  codigo: string;
  descricao: string;
  classe?: { codigo: string; descricao: string };
  grupo?: { codigo: string; descricao: string };
  divisao?: { codigo: string; descricao: string };
  secao?: { codigo: string; descricao: string };
}
```

**`compactarParaLLM`**: `{ codigo, descricao, classe?: "codigo descricao" }` (string flat para classe).

**Cache**: 30 dias · **Fonte**: BrasilAPI.

---

## 5. `consultar_simples_nacional`

> Verifica se um CNPJ é optante pelo Simples Nacional / MEI.

**Input**

```ts
{
  cnpj: string;
}
```

**Output / compactarParaLLM**

```ts
{
  cnpj: string;
  razaoSocial: string;
  optante: boolean;
  dataOpcao?: string;
  dataExclusao?: string;
  mei: boolean;
}
```

**Cache**: 24h (compartilhado com `consultar_cnpj` — a chave do cache MCP é `cnpj:{14digitos}`, então uma consulta CNPJ aquece o cache pra essa também).

**Implementação**: delega para `consultar_cnpj.execute()` e extrai só os campos do Simples. Zero HTTP duplicado.

---

## 6. `consultar_banco`

> Consulta nome e ISPB de uma instituição financeira pelo código COMPE (1-3 dígitos).

**Input**

```ts
{
  codigo: string;
}
```

**Output**

```ts
{ codigo: number; nome: string; nomeCompleto?: string; ispb?: string }
```

**`compactarParaLLM`**: `{ codigo, nome }`.

**Cache**: 30 dias · **Fonte**: BrasilAPI.

---

## 7. `consultar_ddd`

> Consulta UF e cidades cobertas por um DDD (2 dígitos).

**Input**

```ts
{
  ddd: string;
}
```

**Output**

```ts
{ ddd: string; uf: string; cidades: string[] }
```

**`compactarParaLLM`** — usa `truncarLista` para limitar a 10 cidades, com marcador:

```ts
{
  ddd: '11',
  uf: 'SP',
  cidades: ['SAO PAULO', 'OSASCO', ..., '(...e mais 142)'],
  totalCidades: 152,
}
```

**Cache**: 30 dias · **Fonte**: BrasilAPI.

---

## 8. `consultar_feriados_nacionais`

> Lista feriados nacionais brasileiros de um determinado ano.

**Input**

```ts
{
  ano: number;
} // 1900-2199
```

**Output**

```ts
{
  ano: number;
  feriados: Array<{ data: string; nome: string; tipo: string }>;
}
```

**`compactarParaLLM`**: `{ ano, feriados, total }`.

**Cache**: 90 dias · **Fonte**: BrasilAPI.

**Validação dupla**: o Zod schema rejeita ano fora de 1900-2199, e o `execute()` também faz a checagem em runtime — defesa em profundidade para uso in-process.

---

## 9. `calcular_prazo_fiscal`

> Calcula a data final de um prazo em dias úteis a partir de uma data, descontando finais de semana e feriados nacionais.

**Input**

```ts
{
  dataReferencia: string;  // ISO yyyy-mm-dd
  diasUteis: number;       // > 0
  uf?: string;             // captured for future state-holidays, currently unused
}
```

**Output**

```ts
{
  dataReferencia: string;
  diasUteis: number;
  uf?: string;
  dataFinal: string;       // ISO
  diasCorridos: number;
  feriadosNoIntervalo: Array<{ data, nome, tipo }>;
}
```

**`compactarParaLLM`** — omite `feriadosNoIntervalo` (UI mostra, LLM não precisa):

```ts
{
  (dataReferencia, dataFinal, diasUteis, diasCorridos);
}
```

**Cache**: 0 (determinístico, mas o cache de feriados subjacente cobre).

**Algoritmo**:

1. Parse `dataReferencia` em UTC noon (evita DST edge cases).
2. Lazy-fetch feriados por ano conforme o cursor avança (cobre prazos que cruzam o ano).
3. Cursor avança 1 dia por iteração; ignora sábado/domingo e datas em `feriadosNoIntervalo`.
4. Conta `diasUteis` válidos; retorna data final + métricas.

**Limite de sanidade**: 365×10 iterações (suficiente para qualquer prazo realista; protege contra inputs maliciosos).

---

## Regras gerais (todas as tools)

- **Timeout HTTP**: 10s por chamada externa.
- **Retry**: 2 tentativas com backoff exponencial (500ms → 1s → 2s) **apenas em 5xx e erros de rede**. 4xx é fatal exceto 404 (com flag `notFoundOk`).
- **Rate limit local**: 30 req/min por tool (janela deslizante simples).
- **Logs**: Pino → **stderr** (não corrompe o stdout do JSON-RPC).
- **Erros**: classes (`ValidationError`, `NotFoundError`, `ExternalApiError`, `RateLimitError`) → wrapper MCP converte para `{ isError: true, content: [{type:'text', text: userMessage}] }`. Nunca vaza stack trace.

---

## Usar standalone (Claude Desktop)

O `mcp-server` pode ser conectado a qualquer cliente MCP via stdio JSON-RPC. Para o **Claude Desktop**, adicione ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "brazil-data": {
      "command": "node",
      "args": ["C:\\caminho\\absoluto\\para\\brazil-data\\packages\\mcp-server\\dist\\index.js"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

No macOS/Linux o caminho usa `/`. Build é necessário antes (`pnpm --filter @brazil-data/mcp-server build` ou simplesmente `make up` uma vez). Depois disso, abrir o Claude Desktop expõe as 9 ferramentas e o modelo decide quando chamar.

## Smoke test do protocolo

Há um teste de integração real do stdio JSON-RPC em [`packages/mcp-server/tests/smoke-mcp.mjs`](../packages/mcp-server/tests/smoke-mcp.mjs). Rodar com:

```bash
pnpm --filter @brazil-data/mcp-server test:smoke
```

Spawna o server, troca `initialize` → `tools/list` → `tools/call` e valida as respostas. Útil para confirmar que o servidor está corretamente plugável.
