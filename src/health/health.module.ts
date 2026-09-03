import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';

// Agrupa el health check para que app.module no dependa directo de Terminus.
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
