import { Module } from '@nestjs/common';
import { CacheAdminController } from './cache-admin.controller';

@Module({
  controllers: [CacheAdminController],
})
export class AdminModule {}
