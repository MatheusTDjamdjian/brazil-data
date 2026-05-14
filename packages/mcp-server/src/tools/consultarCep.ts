import { z } from 'zod';
import { cache } from '../lib/cache.js';
import { cleanDigits, formatarCep } from '../lib/documents.js';
import { NotFoundError, ValidationError, ExternalApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit } from '../lib/rateLimit.js';
import { semVazios } from '../lib/compactarParaLLM.js';
import { brasilApi } from '../providers/brasilApi.js';
import { viaCep } from '../providers/viaCep.js';
import type { ToolHandler } from './types.js';

const Input = z.object({
  cep: z.string().min(1, 'CEP é obrigatório'),
});

export interface ConsultarCepOutput {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigoIbge?: string;
  latitude?: string;
  longitude?: string;
  fonte: 'brasilapi' | 'viacep';
}

export interface ConsultarCepCompact {
  cep: string;
  endereco: string;
  fonte: string;
}

const CACHE_TTL = 7 * 24 * 60 * 60; // 7 dias

export const consultarCep: ToolHandler<
  typeof Input.shape,
  ConsultarCepOutput,
  ConsultarCepCompact
> = {
  name: 'consultar_cep',
  description: 'Consulta endereço a partir de um CEP brasileiro (8 dígitos).',
  inputSchema: Input,
  cacheTtlSec: CACHE_TTL,

  async execute({ cep }) {
    const limpo = cleanDigits(cep);
    if (limpo.length !== 8) {
      throw new ValidationError(`CEP inválido: precisa de 8 dígitos (recebi ${limpo.length}).`, {
        cep,
      });
    }

    checkRateLimit('consultar_cep');

    const cacheKey = `cep:${limpo}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug({ cep: limpo }, 'consultar_cep.cacheHit');
      return JSON.parse(cached) as ConsultarCepOutput;
    }

    // Primária: BrasilAPI
    try {
      const res = await brasilApi.cep(limpo);
      const out: ConsultarCepOutput = {
        cep: formatarCep(limpo),
        logradouro: res.street ?? '',
        bairro: res.neighborhood ?? '',
        cidade: res.city,
        uf: res.state,
        latitude: res.location?.coordinates?.latitude,
        longitude: res.location?.coordinates?.longitude,
        fonte: 'brasilapi',
      };
      await cache.set(cacheKey, JSON.stringify(out), CACHE_TTL);
      return out;
    } catch (e) {
      if (e instanceof NotFoundError) {
        logger.warn({ cep: limpo }, 'consultar_cep.brasilapi.notFound, tentando ViaCEP');
      } else if (e instanceof ExternalApiError) {
        logger.warn(
          { cep: limpo, status: e.status },
          'consultar_cep.brasilapi.fail, tentando ViaCEP',
        );
      } else {
        throw e;
      }
    }

    // Fallback: ViaCEP
    try {
      const res = await viaCep.cep(limpo);
      const out: ConsultarCepOutput = {
        cep: formatarCep(limpo),
        logradouro: res.logradouro ?? '',
        bairro: res.bairro ?? '',
        cidade: res.localidade ?? '',
        uf: res.uf ?? '',
        codigoIbge: res.ibge,
        fonte: 'viacep',
      };
      await cache.set(cacheKey, JSON.stringify(out), CACHE_TTL);
      return out;
    } catch (e) {
      if (e instanceof NotFoundError) {
        throw new NotFoundError(`CEP ${formatarCep(limpo)} não encontrado.`, { cep: limpo });
      }
      throw e;
    }
  },

  compactarParaLLM(out) {
    const partes = [out.logradouro, out.bairro, `${out.cidade}/${out.uf}`].filter(Boolean);
    return semVazios({
      cep: out.cep,
      endereco: partes.join(', '),
      fonte: out.fonte,
    }) as ConsultarCepCompact;
  },
};
