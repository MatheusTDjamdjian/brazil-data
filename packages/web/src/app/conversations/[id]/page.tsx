'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AppNav } from '@/components/AppNav';
import { MessageBubble } from '@/components/MessageBubble';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getConversation, NotFoundError } from '@/lib/api';
import type { ConversationDetail } from '@/lib/types';
import { getOrCreateUserId } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ConversationDetailPage({ params }: PageProps): React.ReactElement {
  const { id } = use(params);
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const userId = getOrCreateUserId();
    getConversation(id, userId)
      .then(setConv)
      .catch((e) => {
        if (e instanceof NotFoundError) setNotFound(true);
        else setError((e as Error).message);
      });
  }, [id]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />
      <main className="container max-w-3xl py-8 flex-1">
        <Link
          href="/conversations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao histórico
        </Link>

        {notFound ? (
          <Card className="mt-6">
            <CardContent className="pt-6 text-center">
              <p className="text-sm">Conversa não encontrada (ou pertence a outro usuário).</p>
              <Button asChild className="mt-4">
                <Link href="/conversations">Ver histórico</Link>
              </Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">✗ {error}</p>
            </CardContent>
          </Card>
        ) : conv === null ? (
          <Card className="mt-6">
            <CardContent className="pt-6 text-sm text-muted-foreground">Carregando…</CardContent>
          </Card>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-semibold">{conv.title ?? '(sem título)'}</h1>
            <p className="text-xs text-muted-foreground">
              {conv.messages.length} mensagem(ns){' · '}
              {new Date(conv.createdAt).toLocaleString('pt-BR')}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {conv.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  role={m.role === 'user' ? 'user' : 'assistant'}
                  markdown={m.content}
                />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button asChild variant="outline">
                <Link href={`/chat?conversation=${conv.id}`}>Continuar esta conversa</Link>
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
