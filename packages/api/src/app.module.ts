import { Module } from '@nestjs/common';
import { CacheModule } from './common/cache.module';
import { PrismaModule } from './common/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AgentModule } from './modules/agent/agent.module';
import { ChatModule } from './modules/chat/chat.module';
import { ContabilModule } from './modules/contabil/contabil.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { HealthModule } from './modules/health/health.module';
import { McpModule } from './modules/mcp/mcp.module';
import { MetricsModule } from './modules/metrics/metrics.module';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    McpModule,
    MetricsModule,
    AgentModule,
    ChatModule,
    ConversationsModule,
    ContabilModule,
    HealthModule,
    AdminModule,
  ],
})
export class AppModule {}
