import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WORKFLOW_QUEUE } from './queue.constants.js';
import { WorkflowEngineService } from '../engine/workflow-engine.service.js';
import type { WorkflowStepJob } from './workflow.producer.js';

// Worker generico: un solo worker despacha por action_type via el motor (ActionRegistry), sin
// logica de negocio propia aca (ver guia de desarrollo, seccion 4 — colas por tipo de action es
// la evolucion natural cuando el volumen lo justifique, no hace falta para el MVP).
@Processor(WORKFLOW_QUEUE)
export class WorkflowProcessor extends WorkerHost {
  constructor(private readonly engine: WorkflowEngineService) {
    super();
  }

  async process(job: Job<WorkflowStepJob>): Promise<void> {
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    await this.engine.processStep(job.data.stepRunId, job.data.previousOutput, attempt, maxAttempts);
  }
}
