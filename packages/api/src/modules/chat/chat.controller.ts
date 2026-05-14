import {
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  Post,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { z } from 'zod';
import { AgentService } from '../agent/agent.service';
import type { AgentEvent } from '../agent/agent.types';

const ChatRequestSchema = z.object({
  message: z.string().min(1, 'message é obrigatória').max(8000),
  conversationId: z.string().optional(),
});

@Controller('chat')
export class ChatController {
  constructor(private readonly agent: AgentService) {}

  /**
   * POST /chat
   * Body: { message: string, conversationId?: string }
   * Header: X-User-Id (opcional, default 'anonymous')
   *
   * Responde com SSE — cada evento do agente vira um `MessageEvent` SSE.
   */
  @Post()
  @Sse()
  chat(
    @Body() body: unknown,
    @Headers('x-user-id') userIdHeader?: string,
  ): Observable<MessageEvent> {
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: 'Validação falhou',
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const { message, conversationId } = parsed.data;
    const userId = userIdHeader?.trim() || 'anonymous';

    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      const safeNext = (event: AgentEvent) => {
        if (closed) return;
        subscriber.next({ type: event.type, data: event });
        if (event.type === 'done' || event.type === 'error') {
          closed = true;
          subscriber.complete();
        }
      };

      this.agent.respondTo({ message, conversationId, userId }, safeNext).catch((err: unknown) => {
        if (closed) return;
        subscriber.next({
          type: 'error',
          data: { type: 'error', message: (err as Error).message ?? String(err) },
        });
        closed = true;
        subscriber.complete();
      });

      return () => {
        closed = true;
      };
    });
  }
}
