import type { IntentType } from './intent-detector.service';

/**
 * Eventos emitidos pelo AgentService durante a execução de um turno.
 * O ChatController converte cada evento em um `MessageEvent` SSE.
 *
 * Sem campo de "usage" ou "model" — o agente é zero-LLM e
 * determinístico, custo por requisição = 0. O campo `cached` em `done`
 * indica se a resposta veio do cache (sem chamar a tool).
 */
export type AgentEvent =
  | { type: 'intent'; intent: IntentType; matchedBy?: string }
  | { type: 'tool_call'; toolName: string; input: Record<string, unknown>; cached: boolean }
  | {
      type: 'tool_result';
      toolName: string;
      durationMs: number;
      isError: boolean;
      cached: boolean;
      full: unknown;
      compact: unknown;
    }
  | { type: 'text'; text: string }
  | {
      type: 'done';
      conversationId: string;
      messageId: string;
      intent: IntentType;
      toolCallsCount: number;
      durationMs: number;
      cached: boolean;
    }
  | { type: 'error'; message: string };
