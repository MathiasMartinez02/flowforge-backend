import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from '../database/entities/workflow.entity.js';
import { WorkflowStep } from '../database/entities/workflow-step.entity.js';
import { SchedulerModule } from '../scheduler/scheduler.module.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';

// Modulo de CRUD de workflows.
// Modificado en la Fase 3: importa SchedulerModule para que WorkflowsService pueda registrar/dar de
// baja el cron de un workflow al crearlo o al cambiar su status (activar/pausar).
@Module({
  imports: [TypeOrmModule.forFeature([Workflow, WorkflowStep]), SchedulerModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
