import { z } from 'zod';
import { cache } from '../lib/cache.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit } from '../lib/rateLimit.js';
import { brasilApi } from '../providers/brasilApi.js';
import type { ToolHandler } from './types.js';

const Input = z.object({
  ano: z.coerce.number().int().min(1900).max(2199),
});

export interface Feriado {
  data: string; // yyyy-mm-dd
  nome: string;
  tipo: string; // 'national' | etc
}

export interface ConsultarFeriadosNacionaisOutput {
  ano: number;
  feriados: Feriado[];
}

export interface ConsultarFeriadosNacionaisCompact {
  ano: number;
  feriados: Feriado[];
  total: number;
}

const CACHE_TTL = 90 * 24 * 60 * 60; // 90 dias

export const consultarFeriadosNacionais: ToolHandler<
  typeof Input.shape,
  ConsultarFeriadosNacionaisOutput,
  ConsultarFeriadosNacionaisCompact
> = {
  name: 'consultar_feriados_nacionais',
  description: 'Lista feriados nacionais brasileiros de um determinado ano.',
  inputSchema: Input,
  cacheTtlSec: CACHE_TTL,

  async execute({ ano }) {
    if (!Number.isInteger(ano) || ano < 1900 || ano > 2199) {
      throw new ValidationError(`Ano inválido: ${ano}. Esperado entre 1900 e 2199.`, { ano });
    }

    checkRateLimit('consultar_feriados_nacionais');

    const cacheKey = `feriados:${ano}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug({ ano }, 'consultar_feriados_nacionais.cacheHit');
      return JSON.parse(cached) as ConsultarFeriadosNacionaisOutput;
    }

    let api;
    try {
      api = await brasilApi.feriados(ano);
    } catch (e) {
      if (e instanceof NotFoundError) {
        throw new NotFoundError(`Feriados do ano ${ano} não disponíveis.`, { ano });
      }
      throw e;
    }

    const out: ConsultarFeriadosNacionaisOutput = {
      ano,
      feriados: api.map((f) => ({ data: f.date, nome: f.name, tipo: f.type })),
    };

    await cache.set(cacheKey, JSON.stringify(out), CACHE_TTL);
    return out;
  },

  compactarParaLLM(out) {
    return {
      ano: out.ano,
      feriados: out.feriados,
      total: out.feriados.length,
    };
  },
};
