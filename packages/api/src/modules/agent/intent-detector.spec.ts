import { IntentDetectorService } from './intent-detector.service';

describe('IntentDetectorService', () => {
  const det = new IntentDetectorService();

  describe('CNPJ', () => {
    it('detecta CNPJ com máscara → cnpj_lookup', () => {
      const r = det.detect('Qual a situação do CNPJ 11.222.333/0001-81?');
      expect(r.type).toBe('cnpj_lookup');
      expect(r.toolName).toBe('consultar_cnpj');
      expect(r.args).toEqual({ cnpj: '11.222.333/0001-81' });
    });

    it('detecta CNPJ sem máscara', () => {
      const r = det.detect('verificar 11222333000181');
      expect(r.type).toBe('cnpj_lookup');
      expect(r.args?.cnpj).toBe('11222333000181');
    });

    it('CNPJ + "Simples" → simples_check (mais específico vence)', () => {
      const r = det.detect('O CNPJ 11.222.333/0001-81 é optante do Simples?');
      expect(r.type).toBe('simples_check');
      expect(r.toolName).toBe('consultar_simples_nacional');
    });

    it('CNPJ + "MEI" → simples_check', () => {
      const r = det.detect('11.222.333/0001-81 é MEI?');
      expect(r.type).toBe('simples_check');
    });
  });

  describe('CEP', () => {
    it('detecta CEP com hífen', () => {
      const r = det.detect('Endereço do CEP 01310-100');
      expect(r.type).toBe('cep_lookup');
      expect(r.args?.cep).toBe('01310-100');
    });

    it('detecta CEP sem hífen', () => {
      const r = det.detect('cep 01310100');
      expect(r.type).toBe('cep_lookup');
    });
  });

  describe('CPF', () => {
    it('CPF + "válido" → cpf_validate', () => {
      const r = det.detect('O CPF 111.444.777-35 é válido?');
      expect(r.type).toBe('cpf_validate');
      expect(r.args).toEqual({ documento: '111.444.777-35', tipo: 'cpf' });
    });

    it('CPF sem keyword de validação → não vira cpf_validate', () => {
      // 11 dígitos sem keyword → não é cpf_validate
      const r = det.detect('111.444.777-35');
      expect(r.type).toBe('unknown');
    });
  });

  describe('CNAE', () => {
    it('keyword "CNAE" + código com máscara', () => {
      const r = det.detect('Que atividade é o CNAE 6201-5/01?');
      expect(r.type).toBe('cnae_lookup');
      expect(r.args?.codigo).toBe('6201-5/01');
    });

    it('keyword "CNAE" + 7 dígitos', () => {
      const r = det.detect('Descreva o CNAE 6201501');
      expect(r.type).toBe('cnae_lookup');
      expect(r.args?.codigo).toBe('6201501');
    });
  });

  describe('DDD', () => {
    it('detecta DDD', () => {
      const r = det.detect('Quais cidades atendem o DDD 11?');
      expect(r.type).toBe('ddd_lookup');
      expect(r.args?.ddd).toBe('11');
    });
  });

  describe('Banco', () => {
    it('detecta banco por código', () => {
      const r = det.detect('Qual o banco com código 237?');
      expect(r.type).toBe('banco_lookup');
      expect(r.args?.codigo).toBe('237');
    });
  });

  describe('Feriados', () => {
    it('feriados + ano explícito', () => {
      const r = det.detect('Liste os feriados nacionais de 2026');
      expect(r.type).toBe('feriados_lookup');
      expect(r.args?.ano).toBe(2026);
    });

    it('feriados sem ano → usa ano atual', () => {
      const r = det.detect('quais os feriados nacionais?');
      expect(r.type).toBe('feriados_lookup');
      expect(typeof r.args?.ano).toBe('number');
      const ano = r.args?.ano as number;
      expect(ano).toBeGreaterThanOrEqual(2025);
    });
  });

  describe('Prazo fiscal', () => {
    it('"15 dias úteis"', () => {
      const r = det.detect('Quando vence se eu tiver 15 dias úteis a partir de hoje?');
      expect(r.type).toBe('prazo_fiscal');
      expect(r.args?.diasUteis).toBe(15);
      expect(r.args?.dataReferencia).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('"X dias úteis a partir de YYYY-MM-DD"', () => {
      const r = det.detect('5 dias úteis a partir de 2026-05-01');
      expect(r.type).toBe('prazo_fiscal');
      expect(r.args?.diasUteis).toBe(5);
      expect(r.args?.dataReferencia).toBe('2026-05-01');
    });
  });

  describe('Help / unknown', () => {
    it('"ajuda" → help', () => {
      expect(det.detect('ajuda').type).toBe('help');
      expect(det.detect('?').type).toBe('help');
      expect(det.detect('o que você faz?').type).toBe('help');
    });

    it('texto sem padrão reconhecido → unknown', () => {
      expect(det.detect('Olá, tudo bem?').type).toBe('unknown');
      expect(det.detect('').type).toBe('unknown');
    });
  });

  describe('Ordem de prioridade', () => {
    it('CNPJ vence sobre CPF embutido na string', () => {
      // Strings com 14 dígitos não devem ser confundidas com CPF.
      const r = det.detect('11222333000181');
      expect(r.type).toBe('cnpj_lookup');
    });
  });
});
