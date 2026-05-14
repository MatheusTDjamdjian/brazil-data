import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../src/lib/errors.js';
import { consultarCnpj } from '../src/tools/consultarCnpj.js';
import { mswServer } from './helpers/mswServer.js';

const CNPJ_OK = '11222333000181';
const CNPJ_FORMATO_INVALIDO = '11222333000180'; // dígitos verificadores errados

const BRASIL_API = (cnpj: string) => `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;

interface SocioMock {
  nome_socio: string;
  qualificacao_socio?: string;
  data_entrada_sociedade?: string;
}

function payloadCnpj(overrides: Partial<{ qsa: SocioMock[] }> = {}) {
  return {
    cnpj: CNPJ_OK,
    razao_social: 'EMPRESA TESTE LTDA',
    nome_fantasia: 'TESTE',
    descricao_situacao_cadastral: 'ATIVA',
    data_situacao_cadastral: '2010-01-15',
    data_inicio_atividade: '2005-06-01',
    cnae_fiscal: 6201501,
    cnae_fiscal_descricao: 'Desenvolvimento de programas de computador sob encomenda',
    cnaes_secundarios: [],
    natureza_juridica: '206-2 - Sociedade Empresária Limitada',
    logradouro: 'AV PAULISTA',
    numero: '1000',
    bairro: 'BELA VISTA',
    municipio: 'SAO PAULO',
    uf: 'SP',
    cep: '01310100',
    porte: 'DEMAIS',
    opcao_pelo_simples: false,
    opcao_pelo_mei: false,
    capital_social: 1000000,
    qsa: [
      { nome_socio: 'FULANO DA SILVA', qualificacao_socio: 'Sócio Administrador' },
      { nome_socio: 'BELTRANO DOS SANTOS', qualificacao_socio: 'Sócio' },
    ] as SocioMock[],
    ...overrides,
  };
}

describe('consultar_cnpj', () => {
  describe('happy path', () => {
    it('retorna dados completos da empresa', async () => {
      mswServer.use(http.get(BRASIL_API(CNPJ_OK), () => HttpResponse.json(payloadCnpj())));
      const r = await consultarCnpj.execute({ cnpj: CNPJ_OK });
      expect(r).toMatchObject({
        cnpj: '11.222.333/0001-81',
        razaoSocial: 'EMPRESA TESTE LTDA',
        nomeFantasia: 'TESTE',
        situacao: 'ATIVA',
        cnaePrincipal: {
          codigo: '6201501',
          descricao: 'Desenvolvimento de programas de computador sob encomenda',
        },
      });
      expect(r.socios).toHaveLength(2);
      expect(r.endereco.municipio).toBe('SAO PAULO');
    });

    it('aceita CNPJ com máscara', async () => {
      mswServer.use(http.get(BRASIL_API(CNPJ_OK), () => HttpResponse.json(payloadCnpj())));
      const r = await consultarCnpj.execute({ cnpj: '11.222.333/0001-81' });
      expect(r.razaoSocial).toBe('EMPRESA TESTE LTDA');
    });
  });

  describe('validação local', () => {
    it('rejeita CNPJ com tamanho errado sem fazer HTTP', async () => {
      // nenhum handler MSW → se houvesse fetch, erraria
      await expect(consultarCnpj.execute({ cnpj: '123' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejeita CNPJ com dígitos verificadores inválidos', async () => {
      await expect(consultarCnpj.execute({ cnpj: CNPJ_FORMATO_INVALIDO })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });

  describe('404', () => {
    it('vira NotFoundError', async () => {
      mswServer.use(http.get(BRASIL_API(CNPJ_OK), () => new HttpResponse(null, { status: 404 })));
      await expect(consultarCnpj.execute({ cnpj: CNPJ_OK })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('cache', () => {
    it('usa cache na segunda chamada', async () => {
      let hits = 0;
      mswServer.use(
        http.get(BRASIL_API(CNPJ_OK), () => {
          hits += 1;
          return HttpResponse.json(payloadCnpj());
        }),
      );
      await consultarCnpj.execute({ cnpj: CNPJ_OK });
      await consultarCnpj.execute({ cnpj: CNPJ_OK });
      expect(hits).toBe(1);
    });
  });

  describe('compactarParaLLM', () => {
    it('inline sócios quando < 4', async () => {
      mswServer.use(
        http.get(BRASIL_API(CNPJ_OK), () =>
          HttpResponse.json(
            payloadCnpj({
              qsa: [
                { nome_socio: 'A', qualificacao_socio: 'Sócio' },
                { nome_socio: 'B', qualificacao_socio: 'Sócio' },
              ],
            }),
          ),
        ),
      );
      const full = await consultarCnpj.execute({ cnpj: CNPJ_OK });
      const compact = consultarCnpj.compactarParaLLM(full);
      expect(compact.socios).toEqual([
        { nome: 'A', qualificacao: 'Sócio' },
        { nome: 'B', qualificacao: 'Sócio' },
      ]);
    });

    it('vira string-marcador quando >= 4 sócios', async () => {
      mswServer.use(
        http.get(BRASIL_API(CNPJ_OK), () =>
          HttpResponse.json(
            payloadCnpj({
              qsa: Array.from({ length: 5 }, (_, i) => ({
                nome_socio: `S${i}`,
                qualificacao_socio: 'Sócio',
              })),
            }),
          ),
        ),
      );
      const full = await consultarCnpj.execute({ cnpj: CNPJ_OK });
      const compact = consultarCnpj.compactarParaLLM(full);
      expect(compact.socios).toBe('5 sócios (use ferramenta dedicada para detalhes)');
    });

    it('omite sócios quando vazio (não polui o LLM)', async () => {
      mswServer.use(
        http.get(BRASIL_API(CNPJ_OK), () => HttpResponse.json(payloadCnpj({ qsa: [] }))),
      );
      const full = await consultarCnpj.execute({ cnpj: CNPJ_OK });
      const compact = consultarCnpj.compactarParaLLM(full);
      expect(compact.socios).toBeUndefined();
    });

    it('produz cnaePrincipal como "código — descrição"', async () => {
      mswServer.use(http.get(BRASIL_API(CNPJ_OK), () => HttpResponse.json(payloadCnpj())));
      const full = await consultarCnpj.execute({ cnpj: CNPJ_OK });
      const compact = consultarCnpj.compactarParaLLM(full);
      expect(compact.cnaePrincipal).toMatch(/^6201501 — Desenvolvimento/);
    });
  });
});
