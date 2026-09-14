import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from '../database/entities/workflow.entity.js';
import { EngineModule } from '../engine/engine.module.js';
import { SchedulerService } from './scheduler.service.js';

// Modulo del scheduler de triggers 'scheduled'. Reutiliza EngineModule (mismo triggerRun que el
// boton manual) — no ejecuta nada por su cuenta, solo decide cuando llamar al motor.
@Module({
  imports: [TypeOrmModule.forFeature([Workflow]), EngineModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
