import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { logger } from '../../common/logger';
import type { IntentType } from '../agent/intent-detector.service';

export interface RecordMetricInput {
  conversationId?: string;
  intent: IntentType;
  toolName?: string;
  matchedBy?: string;
  isError?: boolean;
  cached: boolean;
  durationMs: number;
  toolDurationMs?: number;
  userMessage: string;
}

export type MetricsPeriod = '24h' | '7d' | '30d';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordMetricInput): Promise<void> {
    try {
      await this.prisma.requestMetric.create({
        data: {
          conversationId: input.conversationId,
          intent: input.intent,
          toolName: input.toolName,
          matchedBy: input.matchedBy,
          isError: input.isError ?? false,
          cached: input.cached,
          durationMs: input.durationMs,
          toolDurationMs: input.toolDurationMs,
          userMessage: input.userMessage,
        },
      });
    } catch (e) {
      // Métricas nunca devem quebrar o caminho feliz; logamos e seguimos.
      logger.warn({ err: (e as Error).message, intent: input.intent }, 'metrics.record.failed');
    }
  }

  // ------------- Consultas para o dashboard -------------

  periodToDate(period: MetricsPeriod): Date {
    const now = Date.now();
    const ms = period === '24h' ? 86_400_000 : period === '7d' ? 7 * 86_400_000 : 30 * 86_400_000;
    return new Date(now - ms);
  }

  async summary(period: MetricsPeriod) {
    const since = this.periodToDate(period);
    const [total, cached, errors, agg] = await Promise.all([
      this.prisma.requestMetric.count({ where: { createdAt: { gte: since } } }),
      this.prisma.requestMetric.count({
        where: { createdAt: { gte: since }, cached: true },
      }),
      this.prisma.requestMetric.count({
        where: { createdAt: { gte: since }, isError: true },
      }),
      this.prisma.requestMetric.aggregate({
        where: { createdAt: { gte: since } },
        _avg: { durationMs: true, toolDurationMs: true },
      }),
    ]);
    return {
      period,
      since: since.toISOString(),
      totalQueries: total,
      cacheHitRate: total > 0 ? cached / total : 0,
      errorRate: total > 0 ? errors / total : 0,
      avgDurationMs: Math.round(agg._avg.durationMs ?? 0),
      avgToolDurationMs: Math.round(agg._avg.toolDurationMs ?? 0),
    };
  }

  async byIntent(period: MetricsPeriod) {
    const since = this.periodToDate(period);
    const grouped = await this.prisma.requestMetric.groupBy({
      by: ['intent'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _avg: { durationMs: true },
    });
    return grouped
      .map((g) => ({
        intent: g.intent,
        count: g._count._all,
        avgDurationMs: Math.round(g._avg.durationMs ?? 0),
      }))
      .sort((a, b) => b.count - a.count);
  }

  async unknownQueries(limit = 20) {
    return this.prisma.requestMetric.findMany({
      where: { intent: 'unknown' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, userMessage: true, createdAt: true },
    });
  }
}
