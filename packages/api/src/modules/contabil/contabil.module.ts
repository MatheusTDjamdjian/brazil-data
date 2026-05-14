import { Module } from '@nestjs/common';
import { McpModule } from '../mcp/mcp.module';
import { ContabilController } from './contabil.controller';
import { ContabilService } from './contabil.service';

@Module({
  imports: [McpModule],
  controllers: [ContabilController],
  providers: [ContabilService],
  exports: [ContabilService],
})
export class ContabilModule {}
