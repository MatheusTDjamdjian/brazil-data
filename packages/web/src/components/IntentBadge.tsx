import { Badge } from '@/components/ui/badge';
import type { IntentType } from '@/lib/types';

const LABELS: Record<IntentType, string> = {
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

export function IntentBadge({ intent }: { intent: IntentType }): React.ReactElement {
  const variant = intent === 'unknown' ? 'warning' : intent === 'help' ? 'secondary' : 'outline';
  return <Badge variant={variant}>intent: {LABELS[intent]}</Badge>;
}
