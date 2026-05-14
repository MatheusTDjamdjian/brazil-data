import { z } from 'zod';
import { cache } from '../lib/cache.js';
import { cleanDigits } from '../lib/documents.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit } from '../lib/rateLimit.js';
import { brasilApi } from '../providers/brasilApi.js';
import type { ToolHandler } from './types.js';

const Input = z.object({
  codigo: z.string().min(1, 'código do banco é obrigatório'),
});

export interface ConsultarBancoOutput {
  codigo: number;
  nome: string;
  nomeCompleto?: string;
  ispb?: string;
}

export interface ConsultarBancoCompact {
  codigo: number;
  nome: string;
}

const CACHE_TTL = 30 * 24 * 60 * 60; // 30 dias

export const consultarBanco: ToolHandler<
  typeof Input.shape,
  ConsultarBancoOutput,
  ConsultarBancoCompact
> = {
  name: 'consultar_banco',
  description:
    'Consulta nome e ISPB de uma instituição financeira pelo código COMPE (1-3 dígitos).',
  inputSchema: Input,
  cacheTtlSec: CACHE_TTL,

  async execute({ codigo }) {
    const limpo = cleanDigits(codigo);
    if (limpo.length === 0 || limpo.length > 3) {
      throw new ValidationError(
        `Código do banco inválido: precisa ter 1-3 dígitos (recebi "${codigo}").`,
        { codigo },
      );
    }

    checkRateLimit('consultar_banco');

    const cacheKey = `banco:${limpo}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug({ codigo: limpo }, 'consultar_banco.cacheHit');
      return JSON.parse(cached) as ConsultarBancoOutput;
    }

    let api;
    try {
      api = await brasilApi.banco(limpo);
    } catch (e) {
      if (e instanceof NotFoundError) {
        throw new NotFoundError(`Banco com código ${limpo} não encontrado.`, { codigo: limpo });
      }
      throw e;
    }

    const out: ConsultarBancoOutput = {
      codigo: api.code,
      nome: api.fullName ?? api.name ?? '?',
      nomeCompleto: api.fullName,
      ispb: api.ispb,
    };

    await cache.set(cacheKey, JSON.stringify(out), CACHE_TTL);
    return out;
  },

  compactarParaLLM(out) {
    return { codigo: out.codigo, nome: out.nome };
  },
};
