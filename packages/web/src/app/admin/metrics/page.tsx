'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AppNav } from '@/components/AppNav';
import { IntentBars } from '@/components/IntentBars';
import { MetricsSummaryView, MetricsSummarySkeleton } from '@/components/MetricsSummary';
import { PeriodSelector } from '@/components/PeriodSelector';
import { UnknownList } from '@/components/UnknownList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  getMetricsByIntent,
  getMetricsSummary,
  getMetricsUnknown,
  type IntentMetric,
  type MetricsPeriod,
  type MetricsSummary,
  type UnknownQuery,
} from '@/lib/api';

interface Loaded {
  summary: MetricsSummary;
  intents: IntentMetric[];
  unknown: UnknownQuery[];
}

export default function MetricsDashboard(): React.ReactElement {
  const [period, setPeriod] = useState<MetricsPeriod>('24h');
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(null);
    Promise.all([getMetricsSummary(period), getMetricsByIntent(period), getMetricsUnknown(20)])
      .then(([summary, intents, unknown]) => {
        if (canceled) return;
        setData({ summary, intents, unknown });
      })
      .catch((e) => {
        if (canceled) return;
        setError((e as Error).message);
      })
      .finally(() => !canceled && setLoading(false));
    return () => {
      canceled = true;
    };
  }, [period, refreshTick]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />
      <main className="container max-w-5xl py-8 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Métricas</h1>
            <p className="text-sm text-muted-foreground">
              Latência, % cache hit e cobertura de intent — sem custos de LLM porque o agente é
              determinístico.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PeriodSelector value={period} onChange={setPeriod} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRefreshTick((t) => t + 1)}
              disabled={loading}
              aria-label="Atualizar"
              title="Atualizar"
            >
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">✗ {error}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                A API ou o Postgres podem estar fora do ar. Tente <code>make up</code>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            {loading || !data ? (
              <MetricsSummarySkeleton />
            ) : (
              <MetricsSummaryView data={data.summary} />
            )}

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Distribuição por intent
                </h2>
              </CardHeader>
              <CardContent>
                {loading || !data ? (
                  <div className="space-y-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i}>
                        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                        <div className="mt-1 h-2 w-full animate-pulse rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <IntentBars intents={data.intents} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Perguntas não-reconhecidas
                </h2>
                <p className="text-xs text-muted-foreground">
                  Use esta lista pra evoluir o IntentDetector — cada uma é uma cobertura perdida.
                </p>
              </CardHeader>
              <CardContent>
                {loading || !data ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : (
                  <UnknownList items={data.unknown} />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
