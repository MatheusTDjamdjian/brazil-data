import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../src/lib/errors.js';
import { consultarCnae } from '../src/tools/consultarCnae.js';
import { mswServer } from './helpers/mswServer.js';

const CODIGO = '6201501';
const URL = (c: string) => `https://brasilapi.com.br/api/cnae/v1/${c}`;

function payload() {
  return {
    id: 6201501,
    descricao: 'Desenvolvimento de programas de computador sob encomenda',
    grupo_id: '62.0',
    grupo_descricao: 'Atividades dos serviços de tecnologia da informação',
    divisao_id: '62',
    divisao_descricao: 'Atividades dos serviços de tecnologia da informação',
    secao_id: 'J',
    secao_descricao: 'Informação e Comunicação',
    classe_id: '6201-5',
    classe_descricao: 'Desenvolvimento de programas de computador sob encomenda',
  };
}

describe('consultar_cnae', () => {
  it('retorna descrição + hierarquia completa', async () => {
    mswServer.use(http.get(URL(CODIGO), () => HttpResponse.json(payload())));
    const r = await consultarCnae.execute({ codigo: CODIGO });
    expect(r).toMatchObject({
      codigo: '6201501',
      descricao: 'Desenvolvimento de programas de computador sob encomenda',
      classe: { codigo: '6201-5' },
      secao: { codigo: 'J', descricao: 'Informação e Comunicação' },
    });
  });

  it('aceita código com máscara (6201-5/01)', async () => {
    mswServer.use(http.get(URL(CODIGO), () => HttpResponse.json(payload())));
    const r = await consultarCnae.execute({ codigo: '6201-5/01' });
    expect(r.codigo).toBe('6201501');
  });

  it('rejeita código com tamanho errado', async () => {
    await expect(consultarCnae.execute({ codigo: '12345' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('vira NotFoundError em 404', async () => {
    mswServer.use(http.get(URL(CODIGO), () => new HttpResponse(null, { status: 404 })));
    await expect(consultarCnae.execute({ codigo: CODIGO })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('cache: 2ª chamada sem hit', async () => {
    let hits = 0;
    mswServer.use(
      http.get(URL(CODIGO), () => {
        hits += 1;
        return HttpResponse.json(payload());
      }),
    );
    await consultarCnae.execute({ codigo: CODIGO });
    await consultarCnae.execute({ codigo: CODIGO });
    expect(hits).toBe(1);
  });

  describe('compactarParaLLM', () => {
    it('inclui código, descrição e string-resumo de classe', async () => {
      mswServer.use(http.get(URL(CODIGO), () => HttpResponse.json(payload())));
      const full = await consultarCnae.execute({ codigo: CODIGO });
      const compact = consultarCnae.compactarParaLLM(full);
      expect(compact).toEqual({
        codigo: '6201501',
        descricao: 'Desenvolvimento de programas de computador sob encomenda',
        classe: '6201-5 Desenvolvimento de programas de computador sob encomenda',
      });
    });

    it('omite classe se a API não devolver', async () => {
      mswServer.use(
        http.get(URL(CODIGO), () =>
          HttpResponse.json({ id: 6201501, descricao: 'Desenvolvimento de software' }),
        ),
      );
      const full = await consultarCnae.execute({ codigo: CODIGO });
      const compact = consultarCnae.compactarParaLLM(full);
      expect(compact.classe).toBeUndefined();
    });
  });
});
