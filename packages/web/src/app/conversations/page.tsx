'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, MessageSquare } from 'lucide-react';
import { AppNav } from '@/components/AppNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { listConversations } from '@/lib/api';
import type { ConversationSummary } from '@/lib/types';
import { getOrCreateUserId } from '@/lib/utils';

export default function ConversationsListPage(): React.ReactElement {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = getOrCreateUserId();
    listConversations(userId)
      .then(setConversations)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />
      <main className="container max-w-3xl py-8 flex-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Histórico de conversas</h1>
          <Button asChild>
            <Link href="/chat">Nova conversa</Link>
          </Button>
        </div>

        {error ? (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">✗ {error}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Verifique se a API e o Postgres estão rodando.
              </p>
            </CardContent>
          </Card>
        ) : conversations === null ? (
          <Card className="mt-6">
            <CardContent className="pt-6 text-sm text-muted-foreground">Carregando…</CardContent>
          </Card>
        ) : conversations.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Você ainda não tem conversas. Comece uma agora.
              <div className="mt-4">
                <Button asChild>
                  <Link href="/chat">Abrir chat</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/conversations/${c.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary hover:bg-accent"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{c.title ?? '(sem título)'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.updatedAt).toLocaleString('pt-BR')}
                      {' · '}
                      {c.messageCount} mensagem(ns)
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
