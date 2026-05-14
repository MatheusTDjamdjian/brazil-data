import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../src/lib/errors.js';
import { consultarBanco } from '../src/tools/consultarBanco.js';
import { mswServer } from './helpers/mswServer.js';

const URL = (c: string) => `https://brasilapi.com.br/api/banks/v1/${c}`;

describe('consultar_banco', () => {
  it('retorna nome + ispb pelo código COMPE', async () => {
    mswServer.use(
      http.get(URL('237'), () =>
        HttpResponse.json({
          ispb: '60746948',
          name: 'BANCO BRADESCO S.A.',
          code: 237,
          fullName: 'Banco Bradesco S.A.',
        }),
      ),
    );
    const r = await consultarBanco.execute({ codigo: '237' });
    expect(r).toEqual({
      codigo: 237,
      nome: 'Banco Bradesco S.A.',
      nomeCompleto: 'Banco Bradesco S.A.',
      ispb: '60746948',
    });
  });

  it('aceita código de 1 dígito (BB = 1)', async () => {
    mswServer.use(
      http.get(URL('1'), () =>
        HttpResponse.json({
          code: 1,
          name: 'BCO DO BRASIL S.A.',
          fullName: 'Banco do Brasil S.A.',
        }),
      ),
    );
    const r = await consultarBanco.execute({ codigo: '1' });
    expect(r.codigo).toBe(1);
  });

  it('rejeita código vazio', async () => {
    // Zod min(1) deve falhar antes mesmo da chamada
    await expect(consultarBanco.execute({ codigo: '' })).rejects.toThrow();
  });

  it('rejeita código com mais de 3 dígitos', async () => {
    await expect(consultarBanco.execute({ codigo: '1234' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('vira NotFoundError em 404', async () => {
    mswServer.use(http.get(URL('999'), () => new HttpResponse(null, { status: 404 })));
    await expect(consultarBanco.execute({ codigo: '999' })).rejects.toBeInstanceOf(NotFoundError);
  });

  describe('compactarParaLLM', () => {
    it('reduz para apenas codigo + nome', async () => {
      mswServer.use(
        http.get(URL('237'), () =>
          HttpResponse.json({
            ispb: '60746948',
            name: 'BRADESCO',
            code: 237,
            fullName: 'Banco Bradesco S.A.',
          }),
        ),
      );
      const full = await consultarBanco.execute({ codigo: '237' });
      const compact = consultarBanco.compactarParaLLM(full);
      expect(compact).toEqual({ codigo: 237, nome: 'Banco Bradesco S.A.' });
    });
  });
});
