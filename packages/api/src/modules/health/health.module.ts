import { Module } from '@nestjs/common';
import { McpModule } from '../mcp/mcp.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [McpModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
