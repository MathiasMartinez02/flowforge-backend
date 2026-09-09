import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule } from './queue.module.js';
import { WORKFLOW_QUEUE } from './queue.constants.js';
import { EngineModule } from '../engine/engine.module.js';
import { WorkflowProcessor } from './workflow.processor.js';

// Modulo separado de EngineModule a proposito: el processor depende del motor (EngineModule)
// para ejecutar cada paso, y el motor depende de WorkflowProducer (registrado en EngineModule)
// para encolar el paso siguiente — juntar processor y producer en un mismo modulo crearia un
// import circular entre EngineModule y este modulo.
@Module({
  imports: [QueueModule, BullModule.registerQueue({ name: WORKFLOW_QUEUE }), EngineModule],
  providers: [WorkflowProcessor],
})
export class WorkerModule {}
