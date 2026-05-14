import { Injectable } from '@nestjs/common';
import { CacheService, type CachedResponse } from '../../common/cache.service';
import { logger } from '../../common/logger';
import { PrismaService } from '../../common/prisma.service';
import { McpService } from '../mcp/mcp.service';
import { MetricsService } from '../metrics/metrics.service';
import type { AgentEvent } from './agent.types';
import { IntentDetectorService, type DetectedIntent } from './intent-detector.service';
import { ResponseFormatterService } from './response-formatter.service';

export interface RespondToInput {
  message: string;
  conversationId?: string;
  userId: string;
}

/**
 * Agente determinístico (zero-LLM):
 *
 *   1. Detecta a intenção da mensagem por regex/keywords
 *   2. Lookup no cache (chave = intent + args). Hit → resposta direta.
 *   3. Miss → chama tool MCP, formata Markdown, armazena no cache.
 *   4. Registra métrica em RequestMetric.
 *
 * Sem chave de API externa. Custo $0, latência só de BrasilAPI + cache.
 */
@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mcp: McpService,
    private readonly intentDetector: IntentDetectorService,
    private readonly formatter: ResponseFormatterService,
    private readonly cache: CacheService,
    private readonly metrics: MetricsService,
  ) {}

  async respondTo(input: RespondToInput, onEvent: (e: AgentEvent) => void): Promise<void> {
    const started = Date.now();
    const { message, userId } = input;

    // 1. Conversa
    const conversation = input.conversationId
      ? ((await this.prisma.conversation.findUnique({
          where: { id: input.conversationId },
        })) ??
        (await this.prisma.conversation.create({
          data: { userId, title: this.deriveTitle(message) },
        })))
      : await this.prisma.conversation.create({
          data: { userId, title: this.deriveTitle(message) },
        });

    // 2. Persiste mensagem do usuário
    await this.prisma.message.create({
      data: { conversationId: conversation.id, role: 'user', content: message },
    });

    // 3. Detecta intent
    const intent = this.intentDetector.detect(message);
    onEvent({ type: 'intent', intent: intent.type, matchedBy: intent.matchedBy });
    logger.info(
      { intent: intent.type, matchedBy: intent.matchedBy, conversationId: conversation.id },
      'agent.intent',
    );

    // 4. Help / unknown — responde texto direto, sem tool, sem cache
    if (!intent.toolName || !intent.args) {
      await this.respondWithTextOnly(intent, conversation.id, message, onEvent, started);
      return;
    }

    // 5. Lookup no cache
    const cached = await this.cache.lookup(intent.type, intent.args);
    if (cached) {
      await this.respondFromCache(intent, conversation.id, message, cached, onEvent, started);
      return;
    }

    // 6. Cache miss — executa a tool
    await this.respondWithTool(intent, conversation.id, message, onEvent, started);
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------

  private async respondWithTextOnly(
    intent: DetectedIntent,
    conversationId: string,
    userMessage: string,
    onEvent: (e: AgentEvent) => void,
    started: number,
  ): Promise<void> {
    const text = this.formatter.format(intent.type, null);
    onEvent({ type: 'text', text });
    const assistantMsg = await this.prisma.message.create({
      data: { conversationId, role: 'assistant', content: text },
    });
    const durationMs = Date.now() - started;
    onEvent({
      type: 'done',
      conversationId,
      messageId: assistantMsg.id,
      intent: intent.type,
      toolCallsCount: 0,
      durationMs,
      cached: false,
    });
    await this.metrics.record({
      conversationId,
      intent: intent.type,
      matchedBy: intent.matchedBy,
      cached: false,
      durationMs,
      userMessage,
    });
  }

  private async respondFromCache(
    intent: DetectedIntent,
    conversationId: string,
    userMessage: string,
    cached: CachedResponse,
    onEvent: (e: AgentEvent) => void,
    started: number,
  ): Promise<void> {
    logger.debug({ intent: intent.type, toolName: cached.toolName }, 'agent.cache.hit');

    onEvent({
      type: 'tool_call',
      toolName: cached.toolName,
      input: intent.args!,
      cached: true,
    });
    onEvent({
      type: 'tool_result',
      toolName: cached.toolName,
      durationMs: 0,
      isError: false,
      cached: true,
      full: cached.full,
      compact: cached.compact,
    });
    onEvent({ type: 'text', text: cached.text });

    const assistantMsg = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: cached.text,
        toolCalls: [{ name: cached.toolName, input: intent.args, cached: true }] as never,
      },
    });
    const durationMs = Date.now() - started;
    onEvent({
      type: 'done',
      conversationId,
      messageId: assistantMsg.id,
      intent: intent.type,
      toolCallsCount: 1,
      durationMs,
      cached: true,
    });
    await this.metrics.record({
      conversationId,
      intent: intent.type,
      toolName: cached.toolName,
      matchedBy: intent.matchedBy,
      cached: true,
      durationMs,
      toolDurationMs: 0,
      userMessage,
    });
  }

  private async respondWithTool(
    intent: DetectedIntent,
    conversationId: string,
    userMessage: string,
    onEvent: (e: AgentEvent) => void,
    started: number,
  ): Promise<void> {
    const toolName = intent.toolName!;
    const tool = this.mcp.get(toolName);
    if (!tool) {
      const errMsg = `Ferramenta desconhecida: ${toolName}`;
      logger.error({ intent: intent.type, toolName }, 'agent.unknownTool');
      onEvent({ type: 'error', message: errMsg });
      return;
    }

    onEvent({ type: 'tool_call', toolName, input: intent.args!, cached: false });
    const toolStarted = Date.now();

    let full: unknown;
    let isError = false;
    let errMsg: string | undefined;
    try {
      full = await tool.execute(intent.args!);
    } catch (e) {
      isError = true;
      errMsg = (e as Error).message ?? String(e);
      full = { error: errMsg };
    }

    const toolDurationMs = Date.now() - toolStarted;
    const compact = isError ? full : tool.compactarParaLLM(full);

    onEvent({
      type: 'tool_result',
      toolName,
      durationMs: toolDurationMs,
      isError,
      cached: false,
      full,
      compact,
    });

    const text = isError
      ? `Não foi possível consultar: ${errMsg}`
      : this.formatter.format(intent.type, full);
    onEvent({ type: 'text', text });

    const assistantMsg = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: text,
        toolCalls: [{ name: toolName, input: intent.args, isError }] as never,
      },
    });

    // Armazena no cache (apenas sucessos)
    if (!isError) {
      await this.cache.store(intent.type, intent.args!, {
        text,
        full,
        compact,
        toolName,
      });
    }

    const durationMs = Date.now() - started;
    onEvent({
      type: 'done',
      conversationId,
      messageId: assistantMsg.id,
      intent: intent.type,
      toolCallsCount: 1,
      durationMs,
      cached: false,
    });
    await this.metrics.record({
      conversationId,
      intent: intent.type,
      toolName,
      matchedBy: intent.matchedBy,
      isError,
      cached: false,
      durationMs,
      toolDurationMs,
      userMessage,
    });
  }

  private deriveTitle(message: string): string {
    const t = message.trim().slice(0, 60);
    return t.length === message.trim().length ? t : t + '…';
  }
}
