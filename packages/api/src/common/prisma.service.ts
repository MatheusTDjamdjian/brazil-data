import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
    logger.info({ db: 'connected' }, 'prisma.connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
