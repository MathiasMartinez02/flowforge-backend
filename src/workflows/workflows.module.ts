import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from '../database/entities/workflow.entity.js';
import { WorkflowStep } from '../database/entities/workflow-step.entity.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';

// Modulo de CRUD de workflows.
@Module({
  imports: [TypeOrmModule.forFeature([Workflow, WorkflowStep])],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
