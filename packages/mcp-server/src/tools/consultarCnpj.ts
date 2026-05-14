import { z } from 'zod';
import { cache } from '../lib/cache.js';
import { cleanDigits, formatarCnpj, validarCnpj } from '../lib/documents.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit } from '../lib/rateLimit.js';
import { semVazios } from '../lib/compactarParaLLM.js';
import { brasilApi, type BrasilApiCnpj } from '../providers/brasilApi.js';
import type { ToolHandler } from './types.js';

const Input = z.object({
  cnpj: z.string().min(1, 'CNPJ é obrigatório'),
});

export interface Socio {
  nome: string;
  qualificacao?: string;
  dataEntrada?: string;
}

export interface CnaeRef {
  codigo: string;
  descricao: string;
}

export interface ConsultarCnpjOutput {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao: string;
  situacaoData?: string;
  dataAbertura?: string;
  cnaePrincipal: CnaeRef;
  cnaesSecundarios: CnaeRef[];
  naturezaJuridica?: string;
  porte?: string;
  capitalSocial?: number;
  endereco: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };
  contato: {
    telefone1?: string;
    telefone2?: string;
    email?: string;
  };
  simples: {
    optante: boolean;
    dataOpcao?: string;
    dataExclusao?: string;
    mei: boolean;
  };
  socios: Socio[];
}

export interface ConsultarCnpjCompact {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao: string;
  cnaePrincipal: string;
  cidade: string;
  porte?: string;
  socios?: Socio[] | string;
}

const CACHE_TTL = 24 * 60 * 60; // 24h
const MAX_SOCIOS_COMPACT = 3; // QSA inline só se < 4

function normalizarSituacao(api: BrasilApiCnpj): string {
  return (
    api.descricao_situacao_cadastral ??
    (api.situacao_cadastral === 2 ? 'ATIVA' : `código ${api.situacao_cadastral ?? '?'}`)
  );
}

function mapearSocios(api: BrasilApiCnpj): Socio[] {
  return (api.qsa ?? []).map((s) => ({
    nome: s.nome_socio ?? '?',
    qualificacao: s.qualificacao_socio,
    dataEntrada: s.data_entrada_sociedade,
  }));
}

function mapearCnaesSecundarios(api: BrasilApiCnpj): CnaeRef[] {
  return (api.cnaes_secundarios ?? []).map((c) => ({
    codigo: String(c.codigo),
    descricao: c.descricao,
  }));
}

export const consultarCnpj: ToolHandler<
  typeof Input.shape,
  ConsultarCnpjOutput,
  ConsultarCnpjCompact
> = {
  name: 'consultar_cnpj',
  description: 'Consulta dados cadastrais públicos de uma empresa pelo CNPJ.',
  inputSchema: Input,
  cacheTtlSec: CACHE_TTL,

  async execute({ cnpj }) {
    const limpo = cleanDigits(cnpj);
    if (limpo.length !== 14) {
      throw new ValidationError(`CNPJ inválido: precisa de 14 dígitos (recebi ${limpo.length}).`, {
        cnpj,
      });
    }
    if (!validarCnpj(limpo)) {
      throw new ValidationError(
        `CNPJ ${formatarCnpj(limpo)} tem dígitos verificadores inválidos.`,
        {
          cnpj,
        },
      );
    }

    checkRateLimit('consultar_cnpj');

    const cacheKey = `cnpj:${limpo}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug({ cnpj: limpo }, 'consultar_cnpj.cacheHit');
      return JSON.parse(cached) as ConsultarCnpjOutput;
    }

    let api: BrasilApiCnpj;
    try {
      api = await brasilApi.cnpj(limpo);
    } catch (e) {
      if (e instanceof NotFoundError) {
        throw new NotFoundError(`CNPJ ${formatarCnpj(limpo)} não encontrado na BrasilAPI.`, {
          cnpj: limpo,
        });
      }
      throw e;
    }

    const out: ConsultarCnpjOutput = {
      cnpj: formatarCnpj(limpo),
      razaoSocial: api.razao_social,
      nomeFantasia: api.nome_fantasia || undefined,
      situacao: normalizarSituacao(api),
      situacaoData: api.data_situacao_cadastral,
      dataAbertura: api.data_inicio_atividade,
      cnaePrincipal: {
        codigo: String(api.cnae_fiscal ?? ''),
        descricao: api.cnae_fiscal_descricao ?? '',
      },
      cnaesSecundarios: mapearCnaesSecundarios(api),
      naturezaJuridica: api.natureza_juridica,
      porte: api.porte,
      capitalSocial: api.capital_social,
      endereco: {
        logradouro: api.logradouro,
        numero: api.numero,
        complemento: api.complemento,
        bairro: api.bairro,
        municipio: api.municipio,
        uf: api.uf,
        cep: api.cep,
      },
      contato: {
        telefone1: api.ddd_telefone_1,
        telefone2: api.ddd_telefone_2,
        email: api.email,
      },
      simples: {
        optante: api.opcao_pelo_simples === true,
        dataOpcao: api.data_opcao_pelo_simples ?? undefined,
        dataExclusao: api.data_exclusao_do_simples ?? undefined,
        mei: api.opcao_pelo_mei === true,
      },
      socios: mapearSocios(api),
    };

    await cache.set(cacheKey, JSON.stringify(out), CACHE_TTL);
    return out;
  },

  compactarParaLLM(out) {
    const sociosCount = out.socios.length;
    const sociosCompact =
      sociosCount === 0
        ? undefined
        : sociosCount < 4
          ? out.socios.slice(0, MAX_SOCIOS_COMPACT).map((s) => ({
              nome: s.nome,
              ...(s.qualificacao ? { qualificacao: s.qualificacao } : {}),
            }))
          : `${sociosCount} sócios (use ferramenta dedicada para detalhes)`;

    return semVazios({
      cnpj: out.cnpj,
      razaoSocial: out.razaoSocial,
      nomeFantasia: out.nomeFantasia,
      situacao: out.situacao,
      cnaePrincipal: `${out.cnaePrincipal.codigo} — ${out.cnaePrincipal.descricao}`.trim(),
      cidade: [out.endereco.municipio, out.endereco.uf].filter(Boolean).join('/'),
      porte: out.porte,
      socios: sociosCompact,
    }) as ConsultarCnpjCompact;
  },
};
