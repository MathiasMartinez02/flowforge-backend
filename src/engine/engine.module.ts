import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Workflow } from '../database/entities/workflow.entity.js';
import { WorkflowRun } from '../database/entities/workflow-run.entity.js';
import { StepRun } from '../database/entities/step-run.entity.js';
import { ActionsModule } from '../actions/actions.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { WORKFLOW_QUEUE } from '../queue/queue.constants.js';
import { WorkflowProducer } from '../queue/workflow.producer.js';
import { WorkflowEngineService } from './workflow-engine.service.js';
import { ConditionEvaluator } from './condition-evaluator.js';

// Motor de ejecucion, reutilizado por RunsModule (dispara runs y expone su estado) y por
// WorkerModule (que instancia el processor de BullMQ apuntando a WorkflowEngineService.processStep).
// Modificado en la Fase 2: encola cada paso via WorkflowProducer en vez de ejecutar todo en memoria.
@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow, WorkflowRun, StepRun]),
    ActionsModule,
    QueueModule,
    BullModule.registerQueue({ name: WORKFLOW_QUEUE }),
  ],
  providers: [WorkflowEngineService, ConditionEvaluator, WorkflowProducer],
  exports: [WorkflowEngineService],
})
export class EngineModule {}
