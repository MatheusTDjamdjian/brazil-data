import { Injectable } from '@nestjs/common';

/**
 * Fake mínimo do PrismaService — implementa só o que os testes da api usam,
 * com armazenamento em memória. Sem dependência de Docker/Postgres.
 */
@Injectable()
export class FakePrismaService {
  private nextId = 1;
  public conversations: Array<{
    id: string;
    userId: string;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  public messagesStore: Array<{
    id: string;
    conversationId: string;
    role: string;
    content: string;
    toolCalls: unknown;
    createdAt: Date;
  }> = [];
  public requestMetrics: Array<{
    id: string;
    conversationId?: string;
    intent: string;
    toolName?: string;
    matchedBy?: string;
    isError: boolean;
    cached: boolean;
    durationMs: number;
    toolDurationMs?: number;
    userMessage: string;
    createdAt: Date;
  }> = [];

  private mkId(prefix: string): string {
    return `${prefix}_${this.nextId++}`;
  }

  conversation = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.conversations.find((c) => c.id === where.id) ?? null,

    findFirst: async ({
      where,
      include,
    }: {
      where: { id: string; userId?: string };
      include?: { messages?: unknown };
    }) => {
      const c = this.conversations.find(
        (c) => c.id === where.id && (where.userId === undefined || c.userId === where.userId),
      );
      if (!c) return null;
      if (include?.messages) {
        const msgs = this.messagesStore
          .filter((m) => m.conversationId === c.id)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return { ...c, messages: msgs };
      }
      return c;
    },

    findMany: async ({
      where,
      orderBy: _orderBy,
      take,
      select,
    }: {
      where: { userId: string };
      orderBy?: unknown;
      take?: number;
      select?: { _count?: unknown };
    }) => {
      const rows = this.conversations
        .filter((c) => c.userId === where.userId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const limited = take ? rows.slice(0, take) : rows;
      if (select?._count) {
        return limited.map((c) => ({
          ...c,
          _count: {
            messages: this.messagesStore.filter((m) => m.conversationId === c.id).length,
          },
        }));
      }
      return limited;
    },

    create: async ({ data }: { data: { userId: string; title?: string | null } }) => {
      const now = new Date();
      const c = {
        id: this.mkId('conv'),
        userId: data.userId,
        title: data.title ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.conversations.push(c);
      return c;
    },
  };

  message = {
    create: async ({
      data,
    }: {
      data: { conversationId: string; role: string; content: string; toolCalls?: unknown };
    }) => {
      const m = {
        id: this.mkId('msg'),
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        toolCalls: data.toolCalls ?? null,
        createdAt: new Date(),
      };
      this.messagesStore.push(m);
      return m;
    },

    findMany: async ({
      where,
      take,
    }: {
      where: { conversationId: string };
      orderBy?: unknown;
      take?: number;
    }) => {
      const r = this.messagesStore
        .filter((m) => m.conversationId === where.conversationId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return take ? r.slice(0, take) : r;
    },
  };

  requestMetric = {
    create: async ({
      data,
    }: {
      data: {
        conversationId?: string;
        intent: string;
        toolName?: string;
        matchedBy?: string;
        isError?: boolean;
        cached: boolean;
        durationMs: number;
        toolDurationMs?: number;
        userMessage: string;
      };
    }) => {
      const m = {
        id: this.mkId('met'),
        conversationId: data.conversationId,
        intent: data.intent,
        toolName: data.toolName,
        matchedBy: data.matchedBy,
        isError: data.isError ?? false,
        cached: data.cached,
        durationMs: data.durationMs,
        toolDurationMs: data.toolDurationMs,
        userMessage: data.userMessage,
        createdAt: new Date(),
      };
      this.requestMetrics.push(m);
      return m;
    },

    count: async ({
      where,
    }: { where?: { cached?: boolean; isError?: boolean; createdAt?: { gte: Date } } } = {}) => {
      return this.filterMetrics(where).length;
    },

    aggregate: async ({
      where,
      _avg,
    }: {
      where?: { createdAt?: { gte: Date } };
      _avg: { durationMs?: boolean; toolDurationMs?: boolean };
    }) => {
      const rows = this.filterMetrics(where);
      const avg = (key: 'durationMs' | 'toolDurationMs') => {
        const vals = rows.map((r) => r[key]).filter((v): v is number => v != null);
        if (vals.length === 0) return null;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      };
      return {
        _avg: {
          ...(_avg.durationMs ? { durationMs: avg('durationMs') } : {}),
          ...(_avg.toolDurationMs ? { toolDurationMs: avg('toolDurationMs') } : {}),
        },
      };
    },

    groupBy: async ({
      by,
      where,
    }: {
      by: ['intent'];
      where?: { createdAt?: { gte: Date } };
      _count?: unknown;
      _avg?: unknown;
    }) => {
      const rows = this.filterMetrics(where);
      const groups = new Map<string, typeof rows>();
      for (const r of rows) {
        const k = r[by[0]];
        const arr = groups.get(k) ?? [];
        arr.push(r);
        groups.set(k, arr);
      }
      return Array.from(groups.entries()).map(([key, items]) => ({
        intent: key,
        _count: { _all: items.length },
        _avg: {
          durationMs: items.reduce((a, b) => a + b.durationMs, 0) / Math.max(items.length, 1),
        },
      }));
    },

    findMany: async ({
      where,
      take,
      select: _select,
    }: {
      where?: { intent?: string };
      orderBy?: unknown;
      take?: number;
      select?: unknown;
    }) => {
      const rows = this.requestMetrics
        .filter((m) => !where?.intent || m.intent === where.intent)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const limited = take ? rows.slice(0, take) : rows;
      return limited.map((m) => ({
        id: m.id,
        userMessage: m.userMessage,
        createdAt: m.createdAt,
      }));
    },
  };

  private filterMetrics(where?: {
    cached?: boolean;
    isError?: boolean;
    createdAt?: { gte: Date };
  }) {
    return this.requestMetrics.filter((m) => {
      if (where?.cached !== undefined && m.cached !== where.cached) return false;
      if (where?.isError !== undefined && m.isError !== where.isError) return false;
      if (where?.createdAt?.gte && m.createdAt < where.createdAt.gte) return false;
      return true;
    });
  }

  async $queryRaw(): Promise<unknown> {
    return [{ ok: 1 }];
  }
  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}
  async onModuleInit(): Promise<void> {}
  async onModuleDestroy(): Promise<void> {}
}
