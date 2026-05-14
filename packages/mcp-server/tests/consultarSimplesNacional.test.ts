import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ValidationError } from '../src/lib/errors.js';
import { consultarSimplesNacional } from '../src/tools/consultarSimplesNacional.js';
import { mswServer } from './helpers/mswServer.js';

const CNPJ = '11222333000181';
const URL = (c: string) => `https://brasilapi.com.br/api/cnpj/v1/${c}`;

function cnpjPayload(overrides: Record<string, unknown> = {}) {
  return {
    cnpj: CNPJ,
    razao_social: 'EMPRESA TESTE LTDA',
    nome_fantasia: 'TESTE',
    descricao_situacao_cadastral: 'ATIVA',
    cnae_fiscal: 6201501,
    cnae_fiscal_descricao: 'Software',
    cnaes_secundarios: [],
    qsa: [],
    opcao_pelo_simples: true,
    data_opcao_pelo_simples: '2014-01-01',
    data_exclusao_do_simples: null,
    opcao_pelo_mei: false,
    ...overrides,
  };
}

describe('consultar_simples_nacional', () => {
  it('extrai apenas campos relevantes do Simples', async () => {
    mswServer.use(http.get(URL(CNPJ), () => HttpResponse.json(cnpjPayload())));
    const r = await consultarSimplesNacional.execute({ cnpj: CNPJ });
    expect(r).toEqual({
      cnpj: '11.222.333/0001-81',
      razaoSocial: 'EMPRESA TESTE LTDA',
      optante: true,
      dataOpcao: '2014-01-01',
      dataExclusao: undefined,
      mei: false,
    });
  });

  it('detecta MEI', async () => {
    mswServer.use(
      http.get(URL(CNPJ), () =>
        HttpResponse.json(
          cnpjPayload({
            opcao_pelo_simples: true,
            opcao_pelo_mei: true,
            data_opcao_pelo_simples: '2020-01-01',
          }),
        ),
      ),
    );
    const r = await consultarSimplesNacional.execute({ cnpj: CNPJ });
    expect(r.mei).toBe(true);
  });

  it('reporta não-optante', async () => {
    mswServer.use(
      http.get(URL(CNPJ), () =>
        HttpResponse.json(
          cnpjPayload({
            opcao_pelo_simples: false,
            data_opcao_pelo_simples: null,
            opcao_pelo_mei: false,
          }),
        ),
      ),
    );
    const r = await consultarSimplesNacional.execute({ cnpj: CNPJ });
    expect(r.optante).toBe(false);
    expect(r.dataOpcao).toBeUndefined();
  });

  it('herda validação do consultar_cnpj (rejeita formato inválido)', async () => {
    await expect(consultarSimplesNacional.execute({ cnpj: '123' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('compactarParaLLM omite campos vazios', async () => {
    mswServer.use(
      http.get(URL(CNPJ), () =>
        HttpResponse.json(
          cnpjPayload({
            opcao_pelo_simples: false,
            data_opcao_pelo_simples: null,
            opcao_pelo_mei: false,
          }),
        ),
      ),
    );
    const full = await consultarSimplesNacional.execute({ cnpj: CNPJ });
    const compact = consultarSimplesNacional.compactarParaLLM(full);
    expect(compact.dataOpcao).toBeUndefined();
    expect(compact.dataExclusao).toBeUndefined();
  });
});
