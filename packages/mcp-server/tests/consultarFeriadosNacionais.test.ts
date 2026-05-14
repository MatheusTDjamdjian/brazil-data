import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../src/lib/errors.js';
import { consultarFeriadosNacionais } from '../src/tools/consultarFeriadosNacionais.js';
import { mswServer } from './helpers/mswServer.js';

const URL = (ano: number) => `https://brasilapi.com.br/api/feriados/v1/${ano}`;

function payload2026() {
  return [
    { date: '2026-01-01', name: 'Confraternização mundial', type: 'national' },
    { date: '2026-04-21', name: 'Tiradentes', type: 'national' },
    { date: '2026-05-01', name: 'Dia do trabalho', type: 'national' },
  ];
}

describe('consultar_feriados_nacionais', () => {
  it('lista feriados nacionais de um ano', async () => {
    mswServer.use(http.get(URL(2026), () => HttpResponse.json(payload2026())));
    const r = await consultarFeriadosNacionais.execute({ ano: 2026 });
    expect(r.ano).toBe(2026);
    expect(r.feriados).toHaveLength(3);
    expect(r.feriados[0]).toEqual({
      data: '2026-01-01',
      nome: 'Confraternização mundial',
      tipo: 'national',
    });
  });

  it('rejeita ano fora do intervalo aceito', async () => {
    await expect(consultarFeriadosNacionais.execute({ ano: 1700 })).rejects.toThrow();
    await expect(consultarFeriadosNacionais.execute({ ano: 9999 })).rejects.toThrow();
  });

  it('vira NotFoundError em 404', async () => {
    mswServer.use(http.get(URL(2026), () => new HttpResponse(null, { status: 404 })));
    await expect(consultarFeriadosNacionais.execute({ ano: 2026 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('cache: 2ª chamada sem hit', async () => {
    let hits = 0;
    mswServer.use(
      http.get(URL(2026), () => {
        hits += 1;
        return HttpResponse.json(payload2026());
      }),
    );
    await consultarFeriadosNacionais.execute({ ano: 2026 });
    await consultarFeriadosNacionais.execute({ ano: 2026 });
    expect(hits).toBe(1);
  });

  it('compactarParaLLM inclui total', async () => {
    mswServer.use(http.get(URL(2026), () => HttpResponse.json(payload2026())));
    const full = await consultarFeriadosNacionais.execute({ ano: 2026 });
    const compact = consultarFeriadosNacionais.compactarParaLLM(full);
    expect(compact.total).toBe(3);
    expect(compact.ano).toBe(2026);
  });
});
