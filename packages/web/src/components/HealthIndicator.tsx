'use client';

import { useEffect, useState } from 'react';
import { getHealth, type HealthReport } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'loading' | 'ok' | 'degraded' | 'offline';

export function HealthIndicator(): React.ReactElement {
  const [status, setStatus] = useState<Status>('loading');
  const [report, setReport] = useState<HealthReport | null>(null);

  useEffect(() => {
    let canceled = false;
    getHealth()
      .then((r) => {
        if (canceled) return;
        setReport(r);
        setStatus(r.status === 'ok' ? 'ok' : 'degraded');
      })
      .catch(() => {
        if (canceled) return;
        setStatus('offline');
      });
    return () => {
      canceled = true;
    };
  }, []);

  const tooltip = (() => {
    if (status === 'loading') return 'Verificando API…';
    if (status === 'offline') return 'API offline';
    if (!report) return status;
    const parts = Object.entries(report.checks).map(
      ([k, v]) => `${k}: ${v.ok ? 'ok' : 'fail'}${v.detail ? ` (${v.detail})` : ''}`,
    );
    return `API ${report.status} · ${parts.join(' · ')}`;
  })();

  return (
    <div
      title={tooltip}
      className="flex items-center gap-1.5"
      aria-label={`Status da API: ${status}`}
    >
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          status === 'ok' && 'bg-emerald-500',
          status === 'degraded' && 'bg-amber-500',
          status === 'offline' && 'bg-red-500',
          status === 'loading' && 'bg-muted animate-pulse',
        )}
      />
      <span className="hidden text-xs text-muted-foreground md:inline">
        {status === 'ok'
          ? 'online'
          : status === 'degraded'
            ? 'degradado'
            : status === 'offline'
              ? 'offline'
              : '…'}
      </span>
    </div>
  );
}
