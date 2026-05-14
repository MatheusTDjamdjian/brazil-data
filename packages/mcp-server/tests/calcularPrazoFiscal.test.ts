import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ValidationError } from '../src/lib/errors.js';
import { calcularPrazoFiscal } from '../src/tools/calcularPrazoFiscal.js';
import { mswServer } from './helpers/mswServer.js';

const FERIADOS = (ano: number) => `https://brasilapi.com.br/api/feriados/v1/${ano}`;

function mockFeriados2026(extra: Array<{ date: string; name: string; type?: string }> = []) {
  mswServer.use(
    http.get(FERIADOS(2026), () =>
      HttpResponse.json([
        { date: '2026-01-01', name: 'Confraternização mundial', type: 'national' },
        { date: '2026-04-21', name: 'Tiradentes', type: 'national' },
        { date: '2026-05-01', name: 'Dia do trabalho', type: 'national' },
        ...extra.map((e) => ({ type: 'national', ...e })),
      ]),
    ),
  );
}

describe('calcular_prazo_fiscal', () => {
  describe('happy path', () => {
    it('1 dia útil a partir de uma terça → quarta', async () => {
      mockFeriados2026();
      // 2026-05-12 é terça
      const r = await calcularPrazoFiscal.execute({
        dataReferencia: '2026-05-12',
        diasUteis: 1,
      });
      expect(r.dataFinal).toBe('2026-05-13'); // quarta
      expect(r.diasCorridos).toBe(1);
      expect(r.feriadosNoIntervalo).toEqual([]);
    });

    it('1 dia útil a partir de sexta → segunda (pula final de semana)', async () => {
      mockFeriados2026();
      // 2026-05-15 é sexta
      const r = await calcularPrazoFiscal.execute({
        dataReferencia: '2026-05-15',
        diasUteis: 1,
      });
      expect(r.dataFinal).toBe('2026-05-18'); // segunda
      expect(r.diasCorridos).toBe(3); // sáb, dom, seg
    });

    it('pula feriado nacional', async () => {
      mockFeriados2026();
      // 2026-04-30 é quinta. Próximo dia útil: 02/05 (sex 1/5 é feriado)
      // 1 dia útil a partir de 2026-04-30
      const r = await calcularPrazoFiscal.execute({
        dataReferencia: '2026-04-30',
        diasUteis: 1,
      });
      // 1/5 (sex, feriado), 2/5 (sáb), 3/5 (dom), 4/5 (seg) ← dia útil 1
      expect(r.dataFinal).toBe('2026-05-04');
      expect(r.feriadosNoIntervalo.map((f) => f.data)).toEqual(['2026-05-01']);
    });

    it('15 dias úteis típicos de prazo fiscal', async () => {
      mockFeriados2026();
      // 15 dias úteis a partir de 2026-05-12 (terça)
      const r = await calcularPrazoFiscal.execute({
        dataReferencia: '2026-05-12',
        diasUteis: 15,
      });
      // Não há feriado no intervalo 13/05 a ~03/06
      expect(r.dataFinal).toBe('2026-06-02');
      expect(r.feriadosNoIntervalo).toEqual([]);
    });

    it('cruzando o ano (busca feriados de 2 anos)', async () => {
      // 5 dias úteis a partir de 29/12/2026 (terça)
      // Precisa de feriados de 2026 E 2027
      mockFeriados2026();
      mswServer.use(
        http.get(FERIADOS(2027), () =>
          HttpResponse.json([
            { date: '2027-01-01', name: 'Confraternização mundial', type: 'national' },
          ]),
        ),
      );
      const r = await calcularPrazoFiscal.execute({
        dataReferencia: '2026-12-29',
        diasUteis: 5,
      });
      // 30/12 (qua), 31/12 (qui), 01/01 (sex, feriado), 02/01 (sáb), 03/01 (dom),
      // 04/01 (seg), 05/01 (ter), 06/01 (qua) → 5º dia útil
      expect(r.dataFinal).toBe('2027-01-06');
      expect(r.feriadosNoIntervalo.map((f) => f.data)).toEqual(['2027-01-01']);
    });

    it('passa uf adiante sem usar (out of scope), preserva no output', async () => {
      mockFeriados2026();
      const r = await calcularPrazoFiscal.execute({
        dataReferencia: '2026-05-12',
        diasUteis: 1,
        uf: 'SP',
      });
      expect(r.uf).toBe('SP');
    });
  });

  describe('validação', () => {
    it('rejeita data não-ISO', async () => {
      await expect(
        calcularPrazoFiscal.execute({ dataReferencia: '12/05/2026', diasUteis: 1 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejeita data com dia/mês fora do calendário', async () => {
      await expect(
        calcularPrazoFiscal.execute({ dataReferencia: '2026-02-30', diasUteis: 1 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejeita diasUteis <= 0 via Zod', async () => {
      await expect(
        calcularPrazoFiscal.execute({ dataReferencia: '2026-05-12', diasUteis: 0 }),
      ).rejects.toThrow();
      await expect(
        calcularPrazoFiscal.execute({ dataReferencia: '2026-05-12', diasUteis: -1 }),
      ).rejects.toThrow();
    });
  });

  describe('compactarParaLLM', () => {
    it('omite feriadosNoIntervalo (array vai para a UI, não para o LLM)', async () => {
      mockFeriados2026();
      const full = await calcularPrazoFiscal.execute({
        dataReferencia: '2026-04-30',
        diasUteis: 1,
      });
      const compact = calcularPrazoFiscal.compactarParaLLM(full);
      expect(compact).toEqual({
        dataReferencia: '2026-04-30',
        dataFinal: '2026-05-04',
        diasUteis: 1,
        diasCorridos: 4,
      });
      expect('feriadosNoIntervalo' in compact).toBe(false);
    });
  });
});
