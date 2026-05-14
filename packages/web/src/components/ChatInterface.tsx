'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CacheBadge } from './CacheBadge';
import { IntentBadge } from './IntentBadge';
import { MessageBubble } from './MessageBubble';
import { ToolCallBadge } from './ToolCallBadge';
import { streamChat } from '@/lib/api';
import type { AgentEvent, IntentType } from '@/lib/types';
import { cn, getOrCreateUserId } from '@/lib/utils';

interface ToolEvent {
  toolName: string;
  input: Record<string, unknown>;
  full?: unknown;
  durationMs?: number;
  cached?: boolean;
  isError?: boolean;
}

interface Turn {
  id: string;
  user: string;
  intent?: IntentType;
  toolEvents: ToolEvent[];
  assistant?: string;
  cached?: boolean;
  durationMs?: number;
}

const EXAMPLES = [
  'Qual a situação do CNPJ 11.222.333/0001-81?',
  'O CNPJ 11.222.333/0001-81 é optante do Simples?',
  'Endereço do CEP 01310-100',
  'O CPF 111.444.777-35 é válido?',
  'Liste os feriados nacionais de 2026',
];

export interface ChatInterfaceProps {
  initialMessage?: string;
  initialConversationId?: string;
}

export function ChatInterface({
  initialMessage,
  initialConversationId,
}: ChatInterfaceProps = {}): React.ReactElement {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const userIdRef = useRef<string>('anonymous');
  const sentInitialRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    userIdRef.current = getOrCreateUserId();
  }, []);

  // Auto-scroll para a última mensagem.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      setError(null);
      setLoading(true);

      const turnId = `t_${Date.now()}`;
      setTurns((prev) => [...prev, { id: turnId, user: text, toolEvents: [] }]);

      try {
        for await (const event of streamChat({
          message: text,
          conversationId,
          userId: userIdRef.current,
        })) {
          applyEvent(turnId, event, setTurns, setConversationId);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, loading],
  );

  // Auto-envia a mensagem inicial (vem do ?q= na URL) uma vez só.
  useEffect(() => {
    if (initialMessage && !sentInitialRef.current) {
      sentInitialRef.current = true;
      // Esperar o userId estar pronto
      setTimeout(() => void send(initialMessage), 0);
    }
  }, [initialMessage, send]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input;
    setInput('');
    void send(v);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      const v = input;
      setInput('');
      void send(v);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {turns.length === 0 ? <EmptyState onPick={(t) => void send(t)} /> : null}
          {turns.map((t) => (
            <TurnView key={t.id} turn={t} />
          ))}
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              ✗ {error}
            </div>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo (ex: situação do CNPJ 11.222.333/0001-81)"
            disabled={loading}
            rows={2}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()} className="h-[60px] px-4">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Enviar</span>
              </>
            )}
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground">
          Cmd/Ctrl + Enter envia · Agente determinístico · 100% dados públicos
        </p>
      </form>
    </div>
  );
}

// ---------------- helpers ----------------

function EmptyState({ onPick }: { onPick: (s: string) => void }): React.ReactElement {
  return (
    <div className="space-y-4 pt-6">
      <div className="text-center text-muted-foreground">
        <p className="text-sm">Pergunte em linguagem natural — eu cuido do resto.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {EXAMPLES.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className={cn(
              'rounded-lg border bg-card px-3 py-2 text-left text-sm shadow-sm transition-colors',
              'hover:border-primary hover:bg-accent',
            )}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <MessageBubble role="user">{turn.user}</MessageBubble>

      {turn.intent ? (
        <div className="flex flex-wrap items-center gap-1 px-1">
          <IntentBadge intent={turn.intent} />
          {turn.cached ? <CacheBadge /> : null}
          {turn.durationMs !== undefined ? (
            <span className="text-[10px] text-muted-foreground">{turn.durationMs}ms total</span>
          ) : null}
        </div>
      ) : null}

      {turn.toolEvents.length > 0 ? (
        <div className="flex flex-col items-start gap-1 px-1">
          {turn.toolEvents.map((te, i) => (
            <ToolCallBadge key={i} {...te} />
          ))}
        </div>
      ) : null}

      {turn.assistant ? <MessageBubble role="assistant" markdown={turn.assistant} /> : null}
    </div>
  );
}

function applyEvent(
  turnId: string,
  event: AgentEvent,
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>,
  setConversationId: React.Dispatch<React.SetStateAction<string | undefined>>,
): void {
  setTurns((prev) =>
    prev.map((t) => {
      if (t.id !== turnId) return t;
      switch (event.type) {
        case 'intent':
          return { ...t, intent: event.intent };
        case 'tool_call':
          return {
            ...t,
            toolEvents: [
              ...t.toolEvents,
              {
                toolName: event.toolName,
                input: event.input,
                cached: event.cached,
              },
            ],
          };
        case 'tool_result': {
          const next = [...t.toolEvents];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].toolName === event.toolName) {
            next[lastIdx] = {
              ...next[lastIdx],
              full: event.full,
              durationMs: event.durationMs,
              cached: event.cached,
              isError: event.isError,
            };
          }
          return { ...t, toolEvents: next };
        }
        case 'text':
          return { ...t, assistant: event.text };
        case 'done':
          return { ...t, cached: event.cached, durationMs: event.durationMs };
        case 'error':
          return { ...t, assistant: `✗ ${event.message}` };
        default:
          return t;
      }
    }),
  );
  if (event.type === 'done') {
    setConversationId(event.conversationId);
  }
}
