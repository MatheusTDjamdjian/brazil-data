import { z } from 'zod';
import { cache } from '../lib/cache.js';
import { cleanDigits } from '../lib/documents.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit } from '../lib/rateLimit.js';
import { truncarLista } from '../lib/compactarParaLLM.js';
import { brasilApi } from '../providers/brasilApi.js';
import type { ToolHandler } from './types.js';

const Input = z.object({
  ddd: z.string().min(1, 'DDD é obrigatório'),
});

export interface ConsultarDddOutput {
  ddd: string;
  uf: string;
  cidades: string[];
}

export interface ConsultarDddCompact {
  ddd: string;
  uf: string;
  cidades: (string | string)[];
  totalCidades: number;
}

const CACHE_TTL = 30 * 24 * 60 * 60; // 30 dias
const MAX_CIDADES_COMPACT = 10;

export const consultarDdd: ToolHandler<
  typeof Input.shape,
  ConsultarDddOutput,
  ConsultarDddCompact
> = {
  name: 'consultar_ddd',
  description: 'Consulta UF e cidades cobertas por um DDD (2 dígitos).',
  inputSchema: Input,
  cacheTtlSec: CACHE_TTL,

  async execute({ ddd }) {
    const limpo = cleanDigits(ddd);
    if (limpo.length !== 2) {
      throw new ValidationError(`DDD inválido: precisa de 2 dígitos (recebi ${limpo.length}).`, {
        ddd,
      });
    }

    checkRateLimit('consultar_ddd');

    const cacheKey = `ddd:${limpo}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug({ ddd: limpo }, 'consultar_ddd.cacheHit');
      return JSON.parse(cached) as ConsultarDddOutput;
    }

    let api;
    try {
      api = await brasilApi.ddd(limpo);
    } catch (e) {
      if (e instanceof NotFoundError) {
        throw new NotFoundError(`DDD ${limpo} não encontrado.`, { ddd: limpo });
      }
      throw e;
    }

    const out: ConsultarDddOutput = {
      ddd: limpo,
      uf: api.state,
      cidades: api.cities ?? [],
    };

    await cache.set(cacheKey, JSON.stringify(out), CACHE_TTL);
    return out;
  },

  compactarParaLLM(out) {
    return {
      ddd: out.ddd,
      uf: out.uf,
      cidades: truncarLista(out.cidades, MAX_CIDADES_COMPACT, (c) => c),
      totalCidades: out.cidades.length,
    };
  },
};
