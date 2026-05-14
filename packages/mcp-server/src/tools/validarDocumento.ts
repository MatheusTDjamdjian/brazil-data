import { z } from 'zod';
import {
  cleanDigits,
  formatarCnpj,
  formatarCpf,
  validarCnpj,
  validarCpf,
} from '../lib/documents.js';
import type { ToolHandler } from './types.js';

const Input = z.object({
  documento: z.string().min(1, 'documento é obrigatório'),
  tipo: z.enum(['cpf', 'cnpj', 'auto']).default('auto'),
});

export interface ValidarDocumentoOutput {
  valido: boolean;
  tipo: 'cpf' | 'cnpj';
  formatado: string;
  motivo?: string;
}

export interface ValidarDocumentoCompact {
  valido: boolean;
  tipo: 'cpf' | 'cnpj';
  formatado: string;
  motivo?: string;
}

function detectarTipo(documento: string, tipo: 'cpf' | 'cnpj' | 'auto'): 'cpf' | 'cnpj' {
  if (tipo !== 'auto') return tipo;
  const c = cleanDigits(documento);
  return c.length <= 11 ? 'cpf' : 'cnpj';
}

export const validarDocumento: ToolHandler<
  typeof Input.shape,
  ValidarDocumentoOutput,
  ValidarDocumentoCompact
> = {
  name: 'validar_documento',
  description: 'Valida CPF ou CNPJ usando os dígitos verificadores (sem chamada externa).',
  inputSchema: Input,
  cacheTtlSec: 0, // sem cache — operação é trivial
  rateLimit: 1000, // praticamente sem limite

  async execute({ documento, tipo }) {
    const detectado = detectarTipo(documento, tipo);
    const digits = cleanDigits(documento);

    if (detectado === 'cpf') {
      if (digits.length !== 11) {
        return {
          valido: false,
          tipo: 'cpf',
          formatado: documento,
          motivo: `CPF deve ter 11 dígitos (recebi ${digits.length}).`,
        };
      }
      const valido = validarCpf(digits);
      return {
        valido,
        tipo: 'cpf',
        formatado: formatarCpf(digits),
        motivo: valido ? undefined : 'Dígitos verificadores não conferem.',
      };
    }

    // CNPJ
    if (digits.length !== 14) {
      return {
        valido: false,
        tipo: 'cnpj',
        formatado: documento,
        motivo: `CNPJ deve ter 14 dígitos (recebi ${digits.length}).`,
      };
    }
    const valido = validarCnpj(digits);
    return {
      valido,
      tipo: 'cnpj',
      formatado: formatarCnpj(digits),
      motivo: valido ? undefined : 'Dígitos verificadores não conferem.',
    };
  },

  compactarParaLLM(out) {
    return out; // já é mínimo
  },
};
