import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ValidationError, NotFoundError } from '../src/lib/errors.js';
import { consultarCep } from '../src/tools/consultarCep.js';
import { mswServer } from './helpers/mswServer.js';

const CEP_OK = '01310100'; // Av. Paulista
const CEP_INEXISTENTE = '99999999';

const BRASIL_API = (cep: string) => `https://brasilapi.com.br/api/cep/v2/${cep}`;
const VIA_CEP = (cep: string) => `https://viacep.com.br/ws/${cep}/json/`;

function mockBrasilApiOk(cep: string) {
  mswServer.use(
    http.get(BRASIL_API(cep), () =>
      HttpResponse.json({
        cep,
        state: 'SP',
        city: 'São Paulo',
        neighborhood: 'Bela Vista',
        street: 'Avenida Paulista',
        service: 'open-cep',
        location: {
          type: 'Point',
          coordinates: { longitude: '-46.6555', latitude: '-23.5616' },
        },
      }),
    ),
  );
}

describe('consultar_cep', () => {
  describe('happy path BrasilAPI', () => {
    it('retorna endereço completo', async () => {
      mockBrasilApiOk(CEP_OK);
      const r = await consultarCep.execute({ cep: CEP_OK });
      expect(r).toMatchObject({
        cep: '01310-100',
        logradouro: 'Avenida Paulista',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        uf: 'SP',
        fonte: 'brasilapi',
      });
      expect(r.latitude).toBe('-23.5616');
    });

    it('aceita CEP com máscara', async () => {
      mockBrasilApiOk('01310100');
      const r = await consultarCep.execute({ cep: '01310-100' });
      expect(r.cidade).toBe('São Paulo');
    });
  });

  describe('fallback para ViaCEP', () => {
    it('cai pro ViaCEP quando BrasilAPI dá 404', async () => {
      mswServer.use(
        http.get(BRASIL_API(CEP_OK), () => new HttpResponse(null, { status: 404 })),
        http.get(VIA_CEP(CEP_OK), () =>
          HttpResponse.json({
            cep: '01310-100',
            logradouro: 'Avenida Paulista',
            bairro: 'Bela Vista',
            localidade: 'São Paulo',
            uf: 'SP',
            ibge: '3550308',
          }),
        ),
      );
      const r = await consultarCep.execute({ cep: CEP_OK });
      expect(r.fonte).toBe('viacep');
      expect(r.codigoIbge).toBe('3550308');
    });

    it('cai pro ViaCEP quando BrasilAPI dá 500', async () => {
      mswServer.use(
        http.get(BRASIL_API(CEP_OK), () => new HttpResponse('boom', { status: 500 })),
        http.get(VIA_CEP(CEP_OK), () =>
          HttpResponse.json({
            cep: '01310-100',
            logradouro: 'Av Paulista',
            bairro: 'Bela Vista',
            localidade: 'São Paulo',
            uf: 'SP',
            ibge: '3550308',
          }),
        ),
      );
      const r = await consultarCep.execute({ cep: CEP_OK });
      expect(r.fonte).toBe('viacep');
    });

    it('joga NotFoundError quando ViaCEP também não encontra', async () => {
      mswServer.use(
        http.get(BRASIL_API(CEP_INEXISTENTE), () => new HttpResponse(null, { status: 404 })),
        http.get(VIA_CEP(CEP_INEXISTENTE), () => HttpResponse.json({ erro: true })),
      );
      await expect(consultarCep.execute({ cep: CEP_INEXISTENTE })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('validação de input', () => {
    it('rejeita CEP curto', async () => {
      await expect(consultarCep.execute({ cep: '12345' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejeita CEP com letras', async () => {
      await expect(consultarCep.execute({ cep: 'abcdefgh' })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });

  describe('cache', () => {
    it('usa cache na segunda chamada (sem novo hit em BrasilAPI)', async () => {
      let hits = 0;
      mswServer.use(
        http.get(BRASIL_API(CEP_OK), () => {
          hits += 1;
          return HttpResponse.json({
            cep: CEP_OK,
            state: 'SP',
            city: 'São Paulo',
            neighborhood: 'Bela Vista',
            street: 'Av. Paulista',
          });
        }),
      );

      await consultarCep.execute({ cep: CEP_OK });
      await consultarCep.execute({ cep: CEP_OK });
      await consultarCep.execute({ cep: '01310-100' });

      expect(hits).toBe(1);
    });
  });

  describe('compactarParaLLM', () => {
    it('produz endereço numa linha só com a fonte', async () => {
      mockBrasilApiOk(CEP_OK);
      const full = await consultarCep.execute({ cep: CEP_OK });
      const compact = consultarCep.compactarParaLLM(full);
      expect(compact).toEqual({
        cep: '01310-100',
        endereco: 'Avenida Paulista, Bela Vista, São Paulo/SP',
        fonte: 'brasilapi',
      });
    });

    it('omite logradouro quando estiver vazio (sem vírgula sobrando)', async () => {
      mswServer.use(
        http.get(BRASIL_API(CEP_OK), () =>
          HttpResponse.json({
            cep: CEP_OK,
            state: 'SP',
            city: 'São Paulo',
            neighborhood: 'Centro',
            street: '',
          }),
        ),
      );
      const full = await consultarCep.execute({ cep: CEP_OK });
      const compact = consultarCep.compactarParaLLM(full);
      expect(compact.endereco).toBe('Centro, São Paulo/SP');
    });
  });
});
