import { z } from 'zod';
import { semVazios } from '../lib/compactarParaLLM.js';
import { consultarCnpj } from './consultarCnpj.js';
import type { ToolHandler } from './types.js';

const Input = z.object({
  cnpj: z.string().min(1, 'CNPJ é obrigatório'),
});

export interface ConsultarSimplesNacionalOutput {
  cnpj: string;
  razaoSocial: string;
  optante: boolean;
  dataOpcao?: string;
  dataExclusao?: string;
  mei: boolean;
}

export interface ConsultarSimplesNacionalCompact {
  cnpj: string;
  razaoSocial: string;
  optante: boolean;
  dataOpcao?: string;
  dataExclusao?: string;
  mei: boolean;
}

/**
 * Reaproveita `consultar_cnpj` (incluindo cache e validação) e extrai
 * apenas os campos relacionados ao Simples Nacional / MEI.
 */
export const consultarSimplesNacional: ToolHandler<
  typeof Input.shape,
  ConsultarSimplesNacionalOutput,
  ConsultarSimplesNacionalCompact
> = {
  name: 'consultar_simples_nacional',
  description: 'Verifica se um CNPJ é optante pelo Simples Nacional / MEI.',
  inputSchema: Input,
  cacheTtlSec: 24 * 60 * 60, // mesmo do cnpj; cache real está em consultar_cnpj

  async execute({ cnpj }) {
    // Delegação: usa o cache e validação do consultar_cnpj
    const full = await consultarCnpj.execute({ cnpj });
    return {
      cnpj: full.cnpj,
      razaoSocial: full.razaoSocial,
      optante: full.simples.optante,
      dataOpcao: full.simples.dataOpcao,
      dataExclusao: full.simples.dataExclusao,
      mei: full.simples.mei,
    };
  },

  compactarParaLLM(out) {
    return semVazios({
      cnpj: out.cnpj,
      razaoSocial: out.razaoSocial,
      optante: out.optante,
      dataOpcao: out.dataOpcao,
      dataExclusao: out.dataExclusao,
      mei: out.mei,
    }) as ConsultarSimplesNacionalCompact;
  },
};
