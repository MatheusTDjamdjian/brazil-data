import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { z } from 'zod';
import { MetricsService, type MetricsPeriod } from './metrics.service';

const PeriodSchema = z.enum(['24h', '7d', '30d']).default('24h');

function parsePeriod(raw: string | undefined): MetricsPeriod {
  return PeriodSchema.parse(raw);
}

@Controller('admin/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('summary')
  async summary(@Query('period') period?: string) {
    return this.metrics.summary(parsePeriod(period));
  }

  @Get('intents')
  async intents(@Query('period') period?: string) {
    return this.metrics.byIntent(parsePeriod(period));
  }

  @Get('unknown')
  async unknown(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.metrics.unknownQueries(Math.min(Math.max(limit, 1), 100));
  }
}
