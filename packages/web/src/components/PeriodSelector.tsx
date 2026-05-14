'use client';

import type { MetricsPeriod } from '@/lib/api';
import { cn } from '@/lib/utils';

const PERIODS: Array<{ value: MetricsPeriod; label: string }> = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
];

export function PeriodSelector({
  value,
  onChange,
}: {
  value: MetricsPeriod;
  onChange: (p: MetricsPeriod) => void;
}): React.ReactElement {
  return (
    <div className="inline-flex rounded-md border bg-card p-0.5 text-sm">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            'rounded px-3 py-1 text-xs font-medium transition-colors',
            value === p.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={value === p.value}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
