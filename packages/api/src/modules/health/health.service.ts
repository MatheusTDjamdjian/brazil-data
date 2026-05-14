import { Injectable } from '@nestjs/common';
import { CacheService } from '../../common/cache.service';
import { PrismaService } from '../../common/prisma.service';
import { McpService } from '../mcp/mcp.service';

export interface CheckResult {
  ok: boolean;
  detail?: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptime: number;
  checks: {
    db: CheckResult;
    mcp: CheckResult;
    cache: CheckResult;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mcp: McpService,
    private readonly cache: CacheService,
  ) {}

  async report(): Promise<HealthReport> {
    const [db, mcp, cache] = await Promise.all([
      this.checkDb(),
      Promise.resolve(this.checkMcp()),
      this.checkCache(),
    ]);
    const checks = { db, mcp, cache };
    const allOk = Object.values(checks).every((c) => c.ok);
    return {
      status: allOk ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      checks,
    };
  }

  private async checkDb(): Promise<CheckResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (e) {
      return { ok: false, detail: (e as Error).message };
    }
  }

  private checkMcp(): CheckResult {
    const tools = this.mcp.list();
    if (tools.length === 0) {
      return { ok: false, detail: 'nenhuma tool carregada' };
    }
    return { ok: true, detail: `${tools.length} tools` };
  }

  private async checkCache(): Promise<CheckResult> {
    if (!this.cache.isEnabled()) {
      return { ok: true, detail: 'desativado' };
    }
    const ping = await this.cache.ping();
    if (!ping.ok) {
      return { ok: false, detail: `${ping.backend} ping falhou: ${ping.error ?? '?'}` };
    }
    return { ok: true, detail: ping.backend };
  }
}
