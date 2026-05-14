# Casos de uso contábeis

> Como o assistente se encaixa no dia a dia de um escritório de contabilidade. Cada caso traz exemplos de pergunta + o que esperar como resposta.

## 1. Cliente novo chegou — vamos verificar o cadastro

Antes de abrir contrato, o contador quer saber se o CNPJ está ativo, qual é o porte, o CNAE principal e se há sócios.

**No chat:**

```
Qual a situação do CNPJ 11.222.333/0001-81?
```

O agente detecta `intent: cnpj_lookup`, chama `consultar_cnpj` (BrasilAPI), formata em Markdown:

```
**EMPRESA TESTE LTDA** (11.222.333/0001-81)
Nome fantasia: TESTE
Situação cadastral: **ATIVA**
CNAE principal: 6201501 — Desenvolvimento de programas...
Município: SÃO PAULO/SP
Porte: DEMAIS

**Sócios:**
- FULANO DA SILVA _(Sócio Administrador)_
- BELTRANO DOS SANTOS _(Sócio)_
```

**Equivalente sem chat** (mais completo, com alertas):

`POST /contabil/analise-empresa` `{ "cnpj": "11.222.333/0001-81" }` retorna a mesma empresa enriquecida com:

- `alertas` (até 7 tipos: situação*irregular, empresa_nova, sócio*único, etc.)
- `fundacao.idadeAnos` e `idadeMeses`
- Endereço e contato completos
- Flag `simples.optante` e `simples.mei`

Ou na UI: `/empresa/11222333000181`.

## 2. Esse cliente é optante do Simples? E é MEI?

Crucial para definir tributação e obrigações acessórias.

**No chat:**

```
O CNPJ 11.222.333/0001-81 é optante do Simples Nacional?
```

`intent: simples_check` → resposta direta:

```
EMPRESA TESTE LTDA (11.222.333/0001-81): **SIM**, é optante do
Simples Nacional. Data de opção: 2014-01-01.
```

Também funciona com a palavra "MEI":

```
Esse CNPJ é MEI? 33.000.167/0001-01
```

A flag MEI vem inline na resposta junto da informação de Simples.

## 3. Calcular prazo de uma obrigação acessória

A SEFAZ deu um prazo de 15 dias úteis para entregar um documento. Quando vence?

**No chat:**

```
Quando vence se eu tiver 15 dias úteis a partir de hoje?
```

`intent: prazo_fiscal` → chama `calcular_prazo_fiscal` (que internamente usa `consultar_feriados_nacionais` lazy por ano):

```
**15 dia(s) útil(eis)** a partir de **2026-05-13** → **2026-06-03**.
_(21 dia(s) corrido(s) no intervalo)_

Feriado(s) descontado(s):
- 2026-05-29 (Corpus Christi)
```

Ou com data explícita:

```
30 dias úteis a partir de 2026-04-01
```

O algoritmo cruza o ano sem problema (fez fetch dos feriados de 2026 e 2027 se necessário).

## 4. CEP do cliente — preciso do endereço pra emitir nota

```
Endereço completo do CEP 01310-100
```

`intent: cep_lookup`:

```
**CEP 01310-100**: Avenida Paulista, Bela Vista, São Paulo/SP. _(fonte: brasilapi)_
```

Se a BrasilAPI estiver fora (404 ou 5xx), o sistema faz fallback automático para o ViaCEP. A fonte é informada na resposta para transparência.

## 5. Validar CPF antes de inserir no sistema

Pré-validação antes de cadastrar funcionário ou sócio evita rejeição da Receita.

```
O CPF 111.444.777-35 é válido?
```

`intent: cpf_validate` → operação puramente local, sem HTTP:

```
**111.444.777-35** é um CPF **válido**.
```

Quando inválido, o motivo é específico:

```
**000.000.000-00** é um CPF **inválido**: Dígitos verificadores não conferem.
```

A mesma tool faz CNPJ — se o número tiver 14 dígitos a tool detecta automaticamente (`tipo: 'auto'`).

## 6. Que atividade econômica é esse CNAE?

Aparece muito ao classificar serviços para emissão de nota.

```
Que atividade é o CNAE 6201-5/01?
```

`intent: cnae_lookup`:

```
**CNAE 6201501**: Desenvolvimento de programas de computador sob encomenda
Classe 6201-5: Desenvolvimento de programas de computador sob encomenda
Seção J: Informação e Comunicação
```

Aceita várias máscaras (`6201-5/01`, `6201501`, `62.01-5-01`).

## 7. Banco do cliente — só tenho o código

Para gerar boleto ou identificar repasse, o código COMPE basta:

```
Qual o banco com código 237?
```

`intent: banco_lookup`:

```
**Código 237** — Banco Bradesco S.A. _(ISPB 60746948)_
```

Aceita 1 a 3 dígitos (Banco do Brasil = 001, etc.).

## 8. DDD desconhecido na ligação

```
Quais cidades atendem o DDD 11?
```

`intent: ddd_lookup`:

```
**DDD 11** atende **SP** com 152 cidade(s): SAO PAULO, OSASCO,
BARUERI, GUARULHOS, CARAPICUIBA, ... _(...e mais 142)_.
```

A lista de cidades é truncada em 10 com marcador — útil pra visão geral sem poluir.

## 9. Lista de feriados para planejar prazos

Útil para criar calendário fiscal interno do escritório.

```
Liste os feriados nacionais de 2026
```

`intent: feriados_lookup`:

```
**Feriados nacionais de 2026** (12):

- **2026-01-01** — Confraternização mundial
- **2026-02-17** — Carnaval
- **2026-04-03** — Sexta-feira santa
- **2026-04-21** — Tiradentes
...
```

Se você não disser o ano (`"quais os feriados nacionais?"`), o agente assume o ano corrente.

---

## Ficha consolidada via UI (`/empresa/[cnpj]`)

A página de empresa renderiza um relatório completo com:

- **Header** com razão social, CNPJ formatado, status badge (verde se ATIVA, vermelho caso contrário).
- **Dados gerais**: fundação + idade calculada, porte, capital social (R$).
- **CNAE principal e secundários** (badges).
- **Endereço e contato**.
- **Simples Nacional** (optante + data + MEI).
- **Quadro societário (QSA)** em tabela.
- **Alertas** color-coded por nível (erro/atenção/info).

Os alertas são gerados deterministicamente por regras simples:

| Tipo                 | Nível   | Quando dispara                   |
| -------------------- | ------- | -------------------------------- |
| `situacao_irregular` | erro    | situação ≠ "ATIVA"               |
| `mei`                | info    | optante MEI                      |
| `optante_simples`    | info    | optante Simples (e não MEI)      |
| `empresa_nova`       | info    | < 1 ano de atividade             |
| `empresa_antiga`     | info    | ≥ 25 anos de atividade           |
| `sem_capital`        | atenção | capital social 0 ou ausente      |
| `socio_unico`        | info    | 1 sócio em porte ≠ MICRO EMPRESA |

Sem LLM, sem cinza interpretativo — regras explícitas e auditáveis.

## Dashboard `/admin/metrics`

Útil para o gestor do escritório saber:

- **Quantas consultas** foram feitas nas últimas 24h / 7d / 30d.
- **Cache hit rate**: % de respostas servidas direto do cache (zero HTTP externo).
- **Latência média** total e do tool isolado.
- **Distribuição por intent** — quais consultas dominam (CNPJ? Prazos? Validação?).
- **Lista de perguntas não-reconhecidas** — sinal direto para evoluir o `IntentDetector`.

Tudo determinístico, custo zero — o dashboard mostra métricas de performance, não de gasto.
