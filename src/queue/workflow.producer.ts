import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WORKFLOW_QUEUE } from './queue.constants.js';

// Payload de un job: el id del step_run a ejecutar y el output del paso anterior (asi el worker
// no necesita una consulta extra a la DB para resolverlo al arrancar).
export interface WorkflowStepJob {
  stepRunId: string;
  previousOutput: Record<string, unknown> | null;
}

// Encola cada paso como su propio job de BullMQ (nunca se ejecuta un workflow entero dentro de
// un solo job — ver guia de desarrollo, seccion 7). Retry y backoff exponencial nativos de BullMQ.
@Injectable()
export class WorkflowProducer {
  constructor(@InjectQueue(WORKFLOW_QUEUE) private readonly queue: Queue<WorkflowStepJob>) {}

  async enqueueStep(stepRunId: string, previousOutput: Record<string, unknown> | null): Promise<void> {
    await this.queue.add(
      'run-step',
      { stepRunId, previousOutput },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
  }
}
