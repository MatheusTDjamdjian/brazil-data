import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { Alerta, NivelAlerta } from '@/lib/types';
import { cn } from '@/lib/utils';

const STYLES: Record<NivelAlerta, { bg: string; text: string; icon: typeof Info }> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900',
    text: 'text-blue-900 dark:text-blue-200',
    icon: Info,
  },
  atencao: {
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
    text: 'text-amber-900 dark:text-amber-200',
    icon: AlertTriangle,
  },
  erro: {
    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900',
    text: 'text-red-900 dark:text-red-200',
    icon: AlertCircle,
  },
};

export function AlertasList({ alertas }: { alertas: Alerta[] }): React.ReactElement | null {
  if (!alertas || alertas.length === 0) return null;
  return (
    <ul className="space-y-2">
      {alertas.map((a, i) => {
        const s = STYLES[a.nivel];
        const Icon = s.icon;
        return (
          <li
            key={`${a.tipo}-${i}`}
            className={cn(
              'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
              s.bg,
              s.text,
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{a.mensagem}</span>
          </li>
        );
      })}
    </ul>
  );
}
