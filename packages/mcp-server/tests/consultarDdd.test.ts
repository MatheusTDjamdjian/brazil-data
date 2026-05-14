import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../src/lib/errors.js';
import { consultarDdd } from '../src/tools/consultarDdd.js';
import { mswServer } from './helpers/mswServer.js';

const URL = (d: string) => `https://brasilapi.com.br/api/ddd/v1/${d}`;

describe('consultar_ddd', () => {
  it('retorna UF + lista de cidades', async () => {
    mswServer.use(
      http.get(URL('11'), () =>
        HttpResponse.json({
          state: 'SP',
          cities: ['SAO PAULO', 'OSASCO', 'BARUERI'],
        }),
      ),
    );
    const r = await consultarDdd.execute({ ddd: '11' });
    expect(r).toEqual({ ddd: '11', uf: 'SP', cidades: ['SAO PAULO', 'OSASCO', 'BARUERI'] });
  });

  it('rejeita DDD com tamanho errado', async () => {
    await expect(consultarDdd.execute({ ddd: '111' })).rejects.toBeInstanceOf(ValidationError);
    await expect(consultarDdd.execute({ ddd: '1' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('vira NotFoundError em 404', async () => {
    mswServer.use(http.get(URL('99'), () => new HttpResponse(null, { status: 404 })));
    await expect(consultarDdd.execute({ ddd: '99' })).rejects.toBeInstanceOf(NotFoundError);
  });

  describe('compactarParaLLM', () => {
    it('mantém até 10 cidades quando há menos de 10', async () => {
      const cidades = Array.from({ length: 7 }, (_, i) => `Cidade ${i}`);
      mswServer.use(http.get(URL('11'), () => HttpResponse.json({ state: 'SP', cities: cidades })));
      const full = await consultarDdd.execute({ ddd: '11' });
      const compact = consultarDdd.compactarParaLLM(full);
      expect(compact.cidades).toEqual(cidades);
      expect(compact.totalCidades).toBe(7);
    });

    it('trunca para 10 + "(...e mais N)" quando há > 10', async () => {
      const cidades = Array.from({ length: 25 }, (_, i) => `Cidade ${i}`);
      mswServer.use(http.get(URL('11'), () => HttpResponse.json({ state: 'SP', cities: cidades })));
      const full = await consultarDdd.execute({ ddd: '11' });
      const compact = consultarDdd.compactarParaLLM(full);
      expect(compact.cidades).toHaveLength(11); // 10 + marcador
      expect(compact.cidades.slice(0, 10)).toEqual(cidades.slice(0, 10));
      expect(compact.cidades[10]).toBe('(...e mais 15)');
      expect(compact.totalCidades).toBe(25);
    });
  });
});
