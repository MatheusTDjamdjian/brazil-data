import type { IntentMetric } from '@/lib/api';

const LABEL_BR: Record<string, string> = {
  cnpj_lookup: 'CNPJ',
  simples_check: 'Simples Nacional',
  cep_lookup: 'CEP',
  cpf_validate: 'Validar CPF',
  cnae_lookup: 'CNAE',
  ddd_lookup: 'DDD',
  banco_lookup: 'Banco',
  feriados_lookup: 'Feriados',
  prazo_fiscal: 'Prazo fiscal',
  help: 'Ajuda',
  unknown: 'Não reconhecida',
};

export function IntentBars({ intents }: { intents: IntentMetric[] }): React.ReactElement {
  if (intents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Sem dados no período. Faça algumas consultas no chat para popular.
      </p>
    );
  }

  const total = intents.reduce((acc, i) => acc + i.count, 0);
  const max = Math.max(...intents.map((i) => i.count), 1);

  return (
    <ul className="flex flex-col gap-2">
      {intents.map((i) => {
        const pctOfMax = (i.count / max) * 100;
        const pctOfTotal = total > 0 ? (i.count / total) * 100 : 0;
        const isUnknown = i.intent === 'unknown';
        return (
          <li key={i.intent}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium">{LABEL_BR[i.intent] ?? i.intent}</span>
              <span className="text-muted-foreground tabular-nums">
                {i.count} ({pctOfTotal.toFixed(0)}%) · {i.avgDurationMs} ms
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={
                  isUnknown
                    ? 'h-full rounded-full bg-amber-500/70 transition-all'
                    : 'h-full rounded-full bg-primary transition-all'
                }
                style={{ width: `${pctOfMax}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
