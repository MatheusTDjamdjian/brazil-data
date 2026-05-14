import { Activity, AlertOctagon, Database, Timer } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import type { MetricsSummary } from '@/lib/api';

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: typeof Activity;
}): React.ReactElement {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
          </div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function MetricsSummaryView({ data }: { data: MetricsSummary }): React.ReactElement {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total de consultas"
        value={data.totalQueries.toLocaleString('pt-BR')}
        detail={`desde ${new Date(data.since).toLocaleString('pt-BR')}`}
        icon={Activity}
      />
      <StatCard
        label="Cache hit rate"
        value={fmtPct(data.cacheHitRate)}
        detail="economia direta de chamadas BrasilAPI"
        icon={Database}
      />
      <StatCard
        label="Latência média"
        value={`${data.avgDurationMs} ms`}
        detail={`tool: ${data.avgToolDurationMs} ms`}
        icon={Timer}
      />
      <StatCard
        label="Erros"
        value={fmtPct(data.errorRate)}
        detail={data.errorRate === 0 ? 'sem erros no período' : undefined}
        icon={AlertOctagon}
      />
    </div>
  );
}

export function MetricsSummarySkeleton(): React.ReactElement {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
