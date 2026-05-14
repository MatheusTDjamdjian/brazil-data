import { Injectable } from '@nestjs/common';

export type IntentType =
  | 'cnpj_lookup'
  | 'simples_check'
  | 'cep_lookup'
  | 'cpf_validate'
  | 'cnae_lookup'
  | 'ddd_lookup'
  | 'banco_lookup'
  | 'feriados_lookup'
  | 'prazo_fiscal'
  | 'help'
  | 'unknown';

export interface DetectedIntent {
  type: IntentType;
  /** Nome da tool MCP a ser chamada (undefined para 'help'/'unknown'). */
  toolName?: string;
  /** Argumentos prontos para `tool.execute()`. */
  args?: Record<string, unknown>;
  /** Mensagem da fonte do match (debug). */
  matchedBy?: string;
}

// ============================================================
// Regex e helpers
// ============================================================

const RE_CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/;
const RE_CEP = /\b\d{5}-?\d{3}\b/;
const RE_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const RE_YEAR = /\b(19|20|21)\d{2}\b/;
const RE_CNAE_MASK = /\b\d{4}-?\d\/?\d{2}\b/; // 0000-0/00
const RE_DIG_7 = /\b\d{7}\b/; // 7 dígitos
const RE_2DIG = /\b\d{2}\b/;
const RE_1_3_DIG = /\b\d{1,3}\b/;
const RE_DIAS_UTEIS = /(\d+)\s*dias?\s*[úu]te/i;

const KW_SIMPLES = /\b(simples\s*nacional|simples|mei|optante)\b/i;
const KW_CNAE = /\bcnae\b/i;
const KW_DDD = /\b(ddd|c[óo]digo\s+de\s+[áa]rea)\b/i;
const KW_BANCO = /\bbanc(o|os)\b/i;
const KW_FERIADOS = /\bferiad/i;
const KW_VALID = /\b(v[áa]lid[oa]?|verific|confer)/i;
const KW_HELP = /^(?:\s*)(ajuda|help|\?|comandos|o que voc[êe]\s+(faz|pode))/i;

@Injectable()
export class IntentDetectorService {
  /**
   * Identifica a intenção da mensagem por padrões lexicais. Ordem importa:
   * combinações específicas (ex: CNPJ + "simples") vencem padrões soltos.
   */
  detect(rawMessage: string): DetectedIntent {
    const msg = rawMessage.trim();
    if (msg.length === 0) return { type: 'unknown' };
    if (KW_HELP.test(msg)) return { type: 'help' };

    const cnpjMatch = msg.match(RE_CNPJ);
    const cepMatch = msg.match(RE_CEP);
    const cpfMatch = msg.match(RE_CPF);

    // 1. CNPJ + simples → simples_check
    if (cnpjMatch && KW_SIMPLES.test(msg)) {
      return {
        type: 'simples_check',
        toolName: 'consultar_simples_nacional',
        args: { cnpj: cnpjMatch[0] },
        matchedBy: 'cnpj+simples',
      };
    }

    // 2. CNPJ sozinho → cnpj_lookup
    if (cnpjMatch) {
      return {
        type: 'cnpj_lookup',
        toolName: 'consultar_cnpj',
        args: { cnpj: cnpjMatch[0] },
        matchedBy: 'cnpj',
      };
    }

    // 3. CEP
    if (cepMatch) {
      return {
        type: 'cep_lookup',
        toolName: 'consultar_cep',
        args: { cep: cepMatch[0] },
        matchedBy: 'cep',
      };
    }

    // 4. CPF + valid keyword → cpf_validate
    if (cpfMatch && KW_VALID.test(msg)) {
      return {
        type: 'cpf_validate',
        toolName: 'validar_documento',
        args: { documento: cpfMatch[0], tipo: 'cpf' },
        matchedBy: 'cpf+valid',
      };
    }

    // 5. CNAE + código
    if (KW_CNAE.test(msg)) {
      const cnaeMaskMatch = msg.match(RE_CNAE_MASK);
      const cnaeNumericMatch = msg.match(RE_DIG_7);
      const codigo = cnaeMaskMatch?.[0] ?? cnaeNumericMatch?.[0];
      if (codigo) {
        return {
          type: 'cnae_lookup',
          toolName: 'consultar_cnae',
          args: { codigo },
          matchedBy: 'cnae',
        };
      }
    }

    // 6. DDD
    if (KW_DDD.test(msg)) {
      const ddd = msg.match(RE_2DIG)?.[0];
      if (ddd) {
        return {
          type: 'ddd_lookup',
          toolName: 'consultar_ddd',
          args: { ddd },
          matchedBy: 'ddd',
        };
      }
    }

    // 7. Banco
    if (KW_BANCO.test(msg)) {
      const codigo = msg.match(RE_1_3_DIG)?.[0];
      if (codigo) {
        return {
          type: 'banco_lookup',
          toolName: 'consultar_banco',
          args: { codigo },
          matchedBy: 'banco',
        };
      }
    }

    // 8. Feriados (ano opcional, default = atual)
    if (KW_FERIADOS.test(msg)) {
      const yearMatch = msg.match(RE_YEAR);
      const ano = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
      return {
        type: 'feriados_lookup',
        toolName: 'consultar_feriados_nacionais',
        args: { ano },
        matchedBy: 'feriados',
      };
    }

    // 9. Prazo fiscal — "X dias úteis [a partir de YYYY-MM-DD]"
    const diasMatch = msg.match(RE_DIAS_UTEIS);
    if (diasMatch) {
      const diasUteis = Number(diasMatch[1]);
      const dataMatch = msg.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      const dataReferencia = dataMatch?.[1] ?? new Date().toISOString().slice(0, 10);
      return {
        type: 'prazo_fiscal',
        toolName: 'calcular_prazo_fiscal',
        args: { diasUteis, dataReferencia },
        matchedBy: 'prazo',
      };
    }

    return { type: 'unknown' };
  }
}
