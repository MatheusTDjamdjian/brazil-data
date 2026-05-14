import { Module } from '@nestjs/common';
import { McpModule } from '../mcp/mcp.module';
import { MetricsModule } from '../metrics/metrics.module';
import { AgentService } from './agent.service';
import { IntentDetectorService } from './intent-detector.service';
import { ResponseFormatterService } from './response-formatter.service';

@Module({
  imports: [McpModule, MetricsModule],
  providers: [AgentService, IntentDetectorService, ResponseFormatterService],
  exports: [AgentService, IntentDetectorService, ResponseFormatterService],
})
export class AgentModule {}
