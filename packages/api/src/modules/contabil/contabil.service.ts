import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { logger } from '../../common/logger';
import { McpService } from '../mcp/mcp.service';

// ----------------------------------------------------------------
// Tipos do output (estabilizam o contrato para o frontend e os testes)
// ----------------------------------------------------------------

export type NivelAlerta = 'info' | 'atencao' | 'erro';
export type TipoAlerta =
  | 'situacao_irregular'
  | 'empresa_nova'
  | 'empresa_antiga'
  | 'mei'
  | 'optante_simples'
  | 'sem_capital'
  | 'socio_unico';

export interface Alerta {
  tipo: TipoAlerta;
  nivel: NivelAlerta;
  mensagem: string;
}

export interface AnaliseEmpresa {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao: { descricao: string; ativa: boolean; desde?: string };
  fundacao: { data?: string; idadeAnos?: number; idadeMeses?: number };
  porte?: string;
  capitalSocial?: number;
  cnaePrincipal: { codigo: string; descricao: string };
  cnaesSecundarios: Array<{ codigo: string; descricao: string }>;
  endereco: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };
  contato?: { telefone1?: string; telefone2?: string; email?: string };
  simples: {
    optante: boolean;
    dataOpcao?: string;
    dataExclusao?: string;
    mei: boolean;
  };
  socios: Array<{ nome: string; qualificacao?: string; dataEntrada?: string }>;
  alertas: Alerta[];
  geradoEm: string;
}

// Shape esperado de `consultar_cnpj.execute()` — duck-typed para evitar
// acoplamento direto aos tipos do mcp-server (que é ESM).
interface CnpjShape {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao: string;
  situacaoData?: string;
  dataAbertura?: string;
  cnaePrincipal: { codigo: string; descricao: string };
  cnaesSecundarios: Array<{ codigo: string; descricao: string }>;
  porte?: string;
  capitalSocial?: number;
  endereco: AnaliseEmpresa['endereco'];
  contato?: AnaliseEmpresa['contato'];
  simples: AnaliseEmpresa['simples'];
  socios: AnaliseEmpresa['socios'];
}

// ----------------------------------------------------------------

@Injectable()
export class ContabilService {
  constructor(private readonly mcp: McpService) {}

  /**
   * Análise consolidada de uma empresa a partir do CNPJ. Sem LLM —
   * apenas a tool `consultar_cnpj` + regras determinísticas que geram
   * alertas úteis para um contador (situação, idade, MEI, etc.).
   */
  async analiseEmpresa(cnpj: string): Promise<AnaliseEmpresa> {
    const tool = this.mcp.get('consultar_cnpj');
    if (!tool) {
      throw new ServiceUnavailableException('Tool consultar_cnpj indisponível');
    }

    let full: CnpjShape;
    try {
      full = (await tool.execute({ cnpj })) as CnpjShape;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      logger.warn({ cnpj, err: msg }, 'contabil.analise.toolFail');
      // CNPJ inexistente / inválido vira 404 amigável
      if (/n[ãa]o encontrado|inv[áa]lido/i.test(msg)) {
        throw new NotFoundException(msg);
      }
      throw e;
    }

    const fundacao = this.computeFundacao(full.dataAbertura);
    const alertas = this.computeAlertas(full, fundacao);

    return {
      cnpj: full.cnpj,
      razaoSocial: full.razaoSocial,
      nomeFantasia: full.nomeFantasia,
      situacao: {
        descricao: full.situacao,
        ativa: full.situacao.toUpperCase() === 'ATIVA',
        desde: full.situacaoData,
      },
      fundacao,
      porte: full.porte,
      capitalSocial: full.capitalSocial,
      cnaePrincipal: full.cnaePrincipal,
      cnaesSecundarios: full.cnaesSecundarios ?? [],
      endereco: full.endereco,
      contato: full.contato,
      simples: full.simples,
      socios: full.socios ?? [],
      alertas,
      geradoEm: new Date().toISOString(),
    };
  }

  // ---------------- regras determinísticas ----------------

  private computeFundacao(data?: string): AnaliseEmpresa['fundacao'] {
    if (!data) return {};
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
    if (!m) return { data };
    const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    if (diffMs < 0) return { data };
    const dias = diffMs / 86_400_000;
    const idadeAnos = Math.floor(dias / 365.25);
    const idadeMeses = Math.floor(dias / 30.44);
    return { data, idadeAnos, idadeMeses };
  }

  private computeAlertas(full: CnpjShape, fundacao: AnaliseEmpresa['fundacao']): Alerta[] {
    const alertas: Alerta[] = [];

    if (full.situacao.toUpperCase() !== 'ATIVA') {
      alertas.push({
        tipo: 'situacao_irregular',
        nivel: 'erro',
        mensagem: `Situação cadastral: ${full.situacao}.`,
      });
    }

    if (full.simples?.mei) {
      alertas.push({
        tipo: 'mei',
        nivel: 'info',
        mensagem: 'Microempreendedor Individual (MEI).',
      });
    } else if (full.simples?.optante) {
      const since = full.simples.dataOpcao ? ` desde ${full.simples.dataOpcao}` : '';
      alertas.push({
        tipo: 'optante_simples',
        nivel: 'info',
        mensagem: `Optante pelo Simples Nacional${since}.`,
      });
    }

    if (fundacao.idadeAnos !== undefined) {
      if (fundacao.idadeAnos < 1) {
        const meses = fundacao.idadeMeses ?? 0;
        alertas.push({
          tipo: 'empresa_nova',
          nivel: 'info',
          mensagem: `Empresa recente — ${meses} mês(es) de atividade.`,
        });
      } else if (fundacao.idadeAnos >= 25) {
        alertas.push({
          tipo: 'empresa_antiga',
          nivel: 'info',
          mensagem: `Empresa consolidada — ${fundacao.idadeAnos} anos de atividade.`,
        });
      }
    }

    if (
      full.capitalSocial === undefined ||
      full.capitalSocial === null ||
      full.capitalSocial === 0
    ) {
      alertas.push({
        tipo: 'sem_capital',
        nivel: 'atencao',
        mensagem: 'Capital social não informado ou igual a zero.',
      });
    }

    if ((full.socios?.length ?? 0) === 1 && full.porte && full.porte !== 'MICRO EMPRESA') {
      alertas.push({
        tipo: 'socio_unico',
        nivel: 'info',
        mensagem: 'Apenas 1 sócio cadastrado.',
      });
    }

    return alertas;
  }
}
