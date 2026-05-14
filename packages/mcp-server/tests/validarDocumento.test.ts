import { describe, expect, it } from 'vitest';
import { validarDocumento } from '../src/tools/validarDocumento.js';

// CPF de teste válido (calculado pelos dígitos verificadores): 111.444.777-35
const CPF_VALIDO = '11144477735';
const CPF_INVALIDO = '11144477700';
// CNPJ de teste válido: 11.222.333/0001-81
const CNPJ_VALIDO = '11222333000181';
const CNPJ_INVALIDO = '11222333000100';

describe('validar_documento', () => {
  describe('CPF', () => {
    it('aceita CPF válido sem máscara', async () => {
      const r = await validarDocumento.execute({ documento: CPF_VALIDO, tipo: 'cpf' });
      expect(r).toEqual({
        valido: true,
        tipo: 'cpf',
        formatado: '111.444.777-35',
      });
    });

    it('aceita CPF válido com máscara', async () => {
      const r = await validarDocumento.execute({
        documento: '111.444.777-35',
        tipo: 'cpf',
      });
      expect(r.valido).toBe(true);
      expect(r.formatado).toBe('111.444.777-35');
    });

    it('rejeita CPF com dígitos verificadores errados', async () => {
      const r = await validarDocumento.execute({ documento: CPF_INVALIDO, tipo: 'cpf' });
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/[Dd]ígitos verificadores/);
    });

    it('rejeita CPF com todos os dígitos iguais', async () => {
      const r = await validarDocumento.execute({ documento: '11111111111', tipo: 'cpf' });
      expect(r.valido).toBe(false);
    });

    it('rejeita CPF com tamanho errado', async () => {
      const r = await validarDocumento.execute({ documento: '123', tipo: 'cpf' });
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/11 dígitos/);
    });
  });

  describe('CNPJ', () => {
    it('aceita CNPJ válido sem máscara', async () => {
      const r = await validarDocumento.execute({ documento: CNPJ_VALIDO, tipo: 'cnpj' });
      expect(r).toEqual({
        valido: true,
        tipo: 'cnpj',
        formatado: '11.222.333/0001-81',
      });
    });

    it('aceita CNPJ válido com máscara', async () => {
      const r = await validarDocumento.execute({
        documento: '11.222.333/0001-81',
        tipo: 'cnpj',
      });
      expect(r.valido).toBe(true);
    });

    it('rejeita CNPJ inválido', async () => {
      const r = await validarDocumento.execute({ documento: CNPJ_INVALIDO, tipo: 'cnpj' });
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/[Dd]ígitos verificadores/);
    });

    it('rejeita CNPJ com tamanho errado', async () => {
      const r = await validarDocumento.execute({ documento: '123456', tipo: 'cnpj' });
      expect(r.valido).toBe(false);
      expect(r.motivo).toMatch(/14 dígitos/);
    });
  });

  describe('auto-detecção', () => {
    it('detecta CPF a partir do comprimento', async () => {
      const r = await validarDocumento.execute({ documento: CPF_VALIDO, tipo: 'auto' });
      expect(r.tipo).toBe('cpf');
      expect(r.valido).toBe(true);
    });

    it('detecta CNPJ a partir do comprimento', async () => {
      const r = await validarDocumento.execute({ documento: CNPJ_VALIDO, tipo: 'auto' });
      expect(r.tipo).toBe('cnpj');
      expect(r.valido).toBe(true);
    });
  });

  describe('compactarParaLLM', () => {
    it('devolve o mesmo objeto (já é enxuto)', async () => {
      const full = await validarDocumento.execute({ documento: CPF_VALIDO, tipo: 'cpf' });
      const compact = validarDocumento.compactarParaLLM(full);
      expect(compact).toEqual(full);
    });
  });
});
