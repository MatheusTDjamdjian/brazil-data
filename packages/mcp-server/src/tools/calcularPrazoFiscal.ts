import { z } from 'zod';
import { ValidationError } from '../lib/errors.js';
import { consultarFeriadosNacionais, type Feriado } from './consultarFeriadosNacionais.js';
import type { ToolHandler } from './types.js';

const Input = z.object({
  dataReferencia: z.string().min(1, 'dataReferencia (yyyy-mm-dd) é obrigatória'),
  diasUteis: z.coerce.number().int().positive(),
  uf: z.string().length(2).optional(),
});

export interface CalcularPrazoFiscalOutput {
  dataReferencia: string;
  diasUteis: number;
  uf?: string;
  dataFinal: string;
  diasCorridos: number;
  feriadosNoIntervalo: Feriado[];
}

export interface CalcularPrazoFiscalCompact {
  dataReferencia: string;
  dataFinal: string;
  diasUteis: number;
  diasCorridos: number;
}

const MAX_ITER = 365 * 10; // sanity cap

/** Parse yyyy-mm-dd em UTC (meio-dia para evitar DST). */
function parseISODate(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  // Verifica round-trip (rejeita 2026-02-30)
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Soma N dias úteis a partir da dataReferencia (exclusivo do dia inicial),
 * descontando finais de semana e feriados nacionais.
 *
 * UF é capturado mas ainda não usado (feriados estaduais/municipais fora do
 * escopo das APIs públicas atuais).
 */
export const calcularPrazoFiscal: ToolHandler<
  typeof Input.shape,
  CalcularPrazoFiscalOutput,
  CalcularPrazoFiscalCompact
> = {
  name: 'calcular_prazo_fiscal',
  description:
    'Calcula a data final de um prazo em dias úteis a partir de uma data, descontando finais de semana e feriados nacionais.',
  inputSchema: Input,
  cacheTtlSec: 0, // determinístico: cache de feriados já cobre

  async execute({ dataReferencia, diasUteis, uf }) {
    const start = parseISODate(dataReferencia);
    if (!start) {
      throw new ValidationError(
        `dataReferencia inválida: "${dataReferencia}". Esperado yyyy-mm-dd.`,
        { dataReferencia },
      );
    }
    if (diasUteis <= 0) {
      throw new ValidationError('diasUteis deve ser positivo.', { diasUteis });
    }

    const feriadosPorAno = new Map<number, Map<string, Feriado>>();
    const feriadosNoIntervalo: Feriado[] = [];

    const current = new Date(start);
    let diasUteisContados = 0;
    let diasCorridos = 0;

    while (diasUteisContados < diasUteis) {
      current.setUTCDate(current.getUTCDate() + 1);
      diasCorridos += 1;

      if (diasCorridos > MAX_ITER) {
        throw new Error(`Loop excedeu ${MAX_ITER} iterações (input suspeito).`);
      }

      const dow = current.getUTCDay();
      if (dow === 0 || dow === 6) continue; // domingo/sábado

      const ano = current.getUTCFullYear();
      if (!feriadosPorAno.has(ano)) {
        const r = await consultarFeriadosNacionais.execute({ ano });
        feriadosPorAno.set(ano, new Map(r.feriados.map((f) => [f.data, f])));
      }
      const feriado = feriadosPorAno.get(ano)!.get(toISODate(current));
      if (feriado) {
        feriadosNoIntervalo.push(feriado);
        continue;
      }

      diasUteisContados += 1;
    }

    return {
      dataReferencia,
      diasUteis,
      uf,
      dataFinal: toISODate(current),
      diasCorridos,
      feriadosNoIntervalo,
    };
  },

  compactarParaLLM(out) {
    return {
      dataReferencia: out.dataReferencia,
      dataFinal: out.dataFinal,
      diasUteis: out.diasUteis,
      diasCorridos: out.diasCorridos,
    };
  },
};
