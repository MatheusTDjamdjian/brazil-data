import { z } from 'zod';
import { cache } from '../lib/cache.js';
import { cleanDigits } from '../lib/documents.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit } from '../lib/rateLimit.js';
import { semVazios } from '../lib/compactarParaLLM.js';
import { brasilApi } from '../providers/brasilApi.js';
import type { ToolHandler } from './types.js';

const Input = z.object({
  codigo: z.string().min(1, 'código CNAE é obrigatório'),
});

export interface ConsultarCnaeOutput {
  codigo: string;
  descricao: string;
  classe?: { codigo: string; descricao: string };
  grupo?: { codigo: string; descricao: string };
  divisao?: { codigo: string; descricao: string };
  secao?: { codigo: string; descricao: string };
}

export interface ConsultarCnaeCompact {
  codigo: string;
  descricao: string;
  classe?: string;
}

const CACHE_TTL = 30 * 24 * 60 * 60; // 30 dias

export const consultarCnae: ToolHandler<
  typeof Input.shape,
  ConsultarCnaeOutput,
  ConsultarCnaeCompact
> = {
  name: 'consultar_cnae',
  description:
    'Consulta atividade econômica pelo código CNAE (com ou sem máscara, 7 dígitos da subclasse).',
  inputSchema: Input,
  cacheTtlSec: CACHE_TTL,

  async execute({ codigo }) {
    const limpo = cleanDigits(codigo);
    if (limpo.length !== 7) {
      throw new ValidationError(`CNAE inválido: precisa de 7 dígitos (recebi ${limpo.length}).`, {
        codigo,
      });
    }

    checkRateLimit('consultar_cnae');

    const cacheKey = `cnae:${limpo}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug({ codigo: limpo }, 'consultar_cnae.cacheHit');
      return JSON.parse(cached) as ConsultarCnaeOutput;
    }

    let api;
    try {
      api = await brasilApi.cnae(limpo);
    } catch (e) {
      if (e instanceof NotFoundError) {
        throw new NotFoundError(`CNAE ${limpo} não encontrado.`, { codigo: limpo });
      }
      throw e;
    }

    const out: ConsultarCnaeOutput = {
      codigo: String(api.id),
      descricao: api.descricao,
      classe:
        api.classe_id && api.classe_descricao
          ? { codigo: api.classe_id, descricao: api.classe_descricao }
          : undefined,
      grupo:
        api.grupo_id && api.grupo_descricao
          ? { codigo: api.grupo_id, descricao: api.grupo_descricao }
          : undefined,
      divisao:
        api.divisao_id && api.divisao_descricao
          ? { codigo: api.divisao_id, descricao: api.divisao_descricao }
          : undefined,
      secao:
        api.secao_id && api.secao_descricao
          ? { codigo: api.secao_id, descricao: api.secao_descricao }
          : undefined,
    };

    await cache.set(cacheKey, JSON.stringify(out), CACHE_TTL);
    return out;
  },

  compactarParaLLM(out) {
    return semVazios({
      codigo: out.codigo,
      descricao: out.descricao,
      classe: out.classe ? `${out.classe.codigo} ${out.classe.descricao}` : undefined,
    }) as ConsultarCnaeCompact;
  },
};
