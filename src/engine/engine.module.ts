import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from '../database/entities/workflow.entity.js';
import { WorkflowRun } from '../database/entities/workflow-run.entity.js';
import { StepRun } from '../database/entities/step-run.entity.js';
import { ActionsModule } from '../actions/actions.module.js';
import { WorkflowEngineService } from './workflow-engine.service.js';

// Motor de ejecucion, reutilizado por RunsModule (Fase 1: sincrono) y por el worker de BullMQ (Fase 2).
@Module({
  imports: [TypeOrmModule.forFeature([Workflow, WorkflowRun, StepRun]), ActionsModule],
  providers: [WorkflowEngineService],
  exports: [WorkflowEngineService],
})
export class EngineModule {}
