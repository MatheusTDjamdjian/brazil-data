import { Controller, Get, Headers, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

function userIdFrom(header: string | undefined): string {
  return header?.trim() || 'anonymous';
}

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Headers('x-user-id') userIdHeader?: string) {
    const userId = userIdFrom(userIdHeader);
    const conversations = await this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    return conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
    }));
  }

  @Get(':id')
  async detail(@Param('id') id: string, @Headers('x-user-id') userIdHeader?: string) {
    const userId = userIdFrom(userIdHeader);
    const conv = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException(`Conversa ${id} não encontrada.`);
    return conv;
  }
}
