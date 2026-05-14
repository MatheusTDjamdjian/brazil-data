import { Injectable } from '@nestjs/common';
import type { IntentType } from './intent-detector.service';

/**
 * Formata o resultado da tool em texto Markdown PT-BR, pronto para a UI.
 *
 * Cada caso usa um shape duck-typed (não importamos os tipos completos
 * do mcp-server para não acoplar a API ao build dele); verificamos os
 * campos defensivamente.
 */
@Injectable()
export class ResponseFormatterService {
  format(intent: IntentType, full: unknown): string {
    switch (intent) {
      case 'cnpj_lookup':
        return formatCnpj(full);
      case 'simples_check':
        return formatSimples(full);
      case 'cep_lookup':
        return formatCep(full);
      case 'cpf_validate':
        return formatCpfValidation(full);
      case 'cnae_lookup':
        return formatCnae(full);
      case 'ddd_lookup':
        return formatDdd(full);
      case 'banco_lookup':
        return formatBanco(full);
      case 'feriados_lookup':
        return formatFeriados(full);
      case 'prazo_fiscal':
        return formatPrazoFiscal(full);
      case 'help':
      case 'unknown':
        return this.help();
    }
  }

  help(): string {
    return [
      'Posso consultar dados públicos brasileiros para você. Tente perguntar:',
      '',
      '- **CNPJ**: "Qual a situação do CNPJ 11.222.333/0001-81?"',
      '- **Simples Nacional**: "O CNPJ 11.222.333/0001-81 é optante do Simples?"',
      '- **CEP**: "Endereço do CEP 01310-100"',
      '- **CPF**: "O CPF 111.444.777-35 é válido?"',
      '- **CNAE**: "Que atividade é o CNAE 6201-5/01?"',
      '- **DDD**: "Quais cidades atendem o DDD 11?"',
      '- **Banco**: "Qual o banco com código 237?"',
      '- **Feriados**: "Liste os feriados nacionais de 2026"',
      '- **Prazo fiscal**: "15 dias úteis a partir de hoje"',
    ].join('\n');
  }
}

// ============================================================
// Formatters por intent (puros, exportados para testes)
// ============================================================

interface CnpjShape {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacao: string;
  cnaePrincipal: { codigo: string; descricao: string };
  endereco: { municipio?: string; uf?: string };
  porte?: string;
  simples: { optante: boolean; dataOpcao?: string; mei: boolean };
  socios: Array<{ nome: string; qualificacao?: string }>;
}

export function formatCnpj(full: unknown): string {
  const o = full as CnpjShape;
  const lines: string[] = [];
  lines.push(`**${o.razaoSocial}** (${o.cnpj})`);
  if (o.nomeFantasia) lines.push(`Nome fantasia: ${o.nomeFantasia}`);
  lines.push(`Situação cadastral: **${o.situacao}**`);
  if (o.cnaePrincipal?.descricao) {
    lines.push(`CNAE principal: ${o.cnaePrincipal.codigo} — ${o.cnaePrincipal.descricao}`);
  }
  const cidade = [o.endereco?.municipio, o.endereco?.uf].filter(Boolean).join('/');
  if (cidade) lines.push(`Município: ${cidade}`);
  if (o.porte) lines.push(`Porte: ${o.porte}`);
  if (o.simples?.optante) {
    const since = o.simples.dataOpcao ? ` desde ${o.simples.dataOpcao}` : '';
    lines.push(`Optante pelo Simples Nacional${since}.`);
  }
  if (o.simples?.mei) lines.push('Cadastrado como **MEI**.');
  if (Array.isArray(o.socios) && o.socios.length > 0) {
    lines.push('');
    lines.push('**Sócios:**');
    for (const s of o.socios.slice(0, 3)) {
      lines.push(`- ${s.nome}${s.qualificacao ? ` _(${s.qualificacao})_` : ''}`);
    }
    if (o.socios.length > 3) lines.push(`- _...e mais ${o.socios.length - 3} sócio(s)_`);
  }
  return lines.join('\n');
}

interface SimplesShape {
  cnpj: string;
  razaoSocial: string;
  optante: boolean;
  dataOpcao?: string;
  dataExclusao?: string;
  mei: boolean;
}

export function formatSimples(full: unknown): string {
  const o = full as SimplesShape;
  const status = o.optante ? '**SIM**, é optante' : '**NÃO** é optante';
  const lines = [`${o.razaoSocial} (${o.cnpj}): ${status} do Simples Nacional.`];
  if (o.optante && o.dataOpcao) lines.push(`Data de opção: ${o.dataOpcao}.`);
  if (o.dataExclusao) lines.push(`Data de exclusão: ${o.dataExclusao}.`);
  if (o.mei) lines.push('Também cadastrado como **MEI**.');
  return lines.join(' ');
}

interface CepShape {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  fonte: string;
}

export function formatCep(full: unknown): string {
  const o = full as CepShape;
  const partes = [o.logradouro, o.bairro, `${o.cidade}/${o.uf}`].filter(Boolean);
  return `**CEP ${o.cep}**: ${partes.join(', ')}. _(fonte: ${o.fonte})_`;
}

interface CpfValShape {
  valido: boolean;
  tipo: string;
  formatado: string;
  motivo?: string;
}

export function formatCpfValidation(full: unknown): string {
  const o = full as CpfValShape;
  if (o.valido) {
    return `**${o.formatado}** é um ${o.tipo.toUpperCase()} **válido**.`;
  }
  return `**${o.formatado}** é um ${o.tipo.toUpperCase()} **inválido**${o.motivo ? `: ${o.motivo}` : '.'}`;
}

interface CnaeShape {
  codigo: string;
  descricao: string;
  classe?: { codigo: string; descricao: string };
  secao?: { codigo: string; descricao: string };
}

export function formatCnae(full: unknown): string {
  const o = full as CnaeShape;
  const lines = [`**CNAE ${o.codigo}**: ${o.descricao}`];
  if (o.classe) lines.push(`Classe ${o.classe.codigo}: ${o.classe.descricao}`);
  if (o.secao) lines.push(`Seção ${o.secao.codigo}: ${o.secao.descricao}`);
  return lines.join('\n');
}

interface DddShape {
  ddd: string;
  uf: string;
  cidades: string[];
}

export function formatDdd(full: unknown): string {
  const o = full as DddShape;
  const total = o.cidades.length;
  const mostra = o.cidades.slice(0, 10);
  const restante = total - mostra.length;
  const lista = mostra.join(', ') + (restante > 0 ? ` _(...e mais ${restante})_` : '');
  return `**DDD ${o.ddd}** atende **${o.uf}** com ${total} cidade(s): ${lista}.`;
}

interface BancoShape {
  codigo: number;
  nome: string;
  ispb?: string;
}

export function formatBanco(full: unknown): string {
  const o = full as BancoShape;
  return `**Código ${o.codigo}** — ${o.nome}${o.ispb ? ` _(ISPB ${o.ispb})_` : ''}.`;
}

interface FeriadosShape {
  ano: number;
  feriados: Array<{ data: string; nome: string }>;
}

export function formatFeriados(full: unknown): string {
  const o = full as FeriadosShape;
  const lines = [`**Feriados nacionais de ${o.ano}** (${o.feriados.length}):`, ''];
  for (const f of o.feriados) {
    lines.push(`- **${f.data}** — ${f.nome}`);
  }
  return lines.join('\n');
}

interface PrazoShape {
  dataReferencia: string;
  dataFinal: string;
  diasUteis: number;
  diasCorridos: number;
  feriadosNoIntervalo: Array<{ data: string; nome: string }>;
}

export function formatPrazoFiscal(full: unknown): string {
  const o = full as PrazoShape;
  const lines = [
    `**${o.diasUteis} dia(s) útil(eis)** a partir de **${o.dataReferencia}** → **${o.dataFinal}**.`,
    `_(${o.diasCorridos} dia(s) corrido(s) no intervalo)_`,
  ];
  if (o.feriadosNoIntervalo.length > 0) {
    lines.push('');
    lines.push('Feriado(s) descontado(s):');
    for (const f of o.feriadosNoIntervalo) {
      lines.push(`- ${f.data} (${f.nome})`);
    }
  }
  return lines.join('\n');
}
