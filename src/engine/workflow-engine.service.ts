import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../database/entities/workflow.entity.js';
import { WorkflowRun } from '../database/entities/workflow-run.entity.js';
import { StepRun } from '../database/entities/step-run.entity.js';
import { WorkflowStep } from '../database/entities/workflow-step.entity.js';
import { ActionRegistry } from '../actions/action-registry.js';
import { ConditionEvaluator } from './condition-evaluator.js';
import { WorkflowProducer } from '../queue/workflow.producer.js';

// Un intento fallido de un paso, guardado en step_run.output para poder mostrar "Intento N/3" en
// el timeline (ver design RunTimeline.dc.html) sin agregar una tabla nueva al modelo de datos.
interface AttemptLogEntry {
  attempt: number;
  status: 'failed';
  message: string;
  durationMs: number;
}

// Orquesta la ejecucion de un workflow paso a paso, encolando cada paso como su propio job de
// BullMQ. Cambio de la Fase 1 a la Fase 2: antes (runWorkflow) recorria todos los pasos en
// memoria dentro de una sola llamada sincrona; ahora (triggerRun + processStep) cada paso es un
// job independiente con su propio retry, y el estado real se consulta con findRun.
@Injectable()
export class WorkflowEngineService {
  constructor(
    @InjectRepository(Workflow) private readonly workflows: Repository<Workflow>,
    @InjectRepository(WorkflowRun) private readonly runs: Repository<WorkflowRun>,
    @InjectRepository(StepRun) private readonly stepRuns: Repository<StepRun>,
    private readonly actionRegistry: ActionRegistry,
    private readonly conditionEvaluator: ConditionEvaluator,
    private readonly producer: WorkflowProducer,
  ) {}

  // Crea el workflow_run y el primer step_run (pending), y encola el primer paso.
  // No espera a que termine: el frontend consulta el estado real con GET /runs/:id (polling).
  // Cambio en la Fase 4: suma "initialOutput" (opcional) — el payload de un trigger 'webhook' se pasa
  // como previousOutput del primer paso, igual que el output de un paso previo en la cadena normal.
  async triggerRun(
    workflowId: string,
    triggerSource: string,
    initialOutput: Record<string, unknown> | null = null,
  ): Promise<WorkflowRun> {
    const workflow = await this.workflows.findOne({ where: { id: workflowId }, relations: { steps: true } });
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} no encontrado`);
    const steps = [...workflow.steps].sort((a, b) => a.orderIndex - b.orderIndex);

    const run = await this.runs.save(
      this.runs.create({ workflow, triggerSource, status: 'running', startedAt: new Date() }),
    );

    if (steps.length === 0) {
      await this.finishRun(run, 'completed', null);
      return this.findRun(run.id);
    }

    const firstStepRun = await this.stepRuns.save(
      this.stepRuns.create({ workflowRun: run, workflowStep: steps[0], status: 'pending' }),
    );
    await this.producer.enqueueStep(firstStepRun.id, initialOutput);

    return this.findRun(run.id);
  }

  // Ejecuta un paso puntual. Lo llama el worker de BullMQ una vez por cada intento
  // (attempt = job.attemptsMade + 1, ver workflow.processor.ts).
  async processStep(
    stepRunId: string,
    previousOutput: Record<string, unknown> | null,
    attempt: number,
    maxAttempts: number,
  ): Promise<void> {
    const stepRun = await this.stepRuns.findOne({
      where: { id: stepRunId },
      relations: { workflowStep: true, workflowRun: { workflow: { steps: true } } },
    });
    if (!stepRun) throw new Error(`step_run ${stepRunId} no encontrado`);

    const step = stepRun.workflowStep;
    const run = stepRun.workflowRun;
    const attemptStartedAt = new Date();

    stepRun.status = 'running';
    stepRun.attempt = attempt;
    if (attempt === 1) stepRun.startedAt = attemptStartedAt;
    await this.stepRuns.save(stepRun);

    try {
      const output =
        step.stepType === 'condition'
          ? { result: this.conditionEvaluator.evaluate(step.config, previousOutput) }
          : await this.actionRegistry.get(step.actionType ?? '').execute(step.config, previousOutput);

      await this.completeStep(stepRun, output);

      if (step.stepType === 'condition' && output.result === false) {
        // Condicion falsa: se corta la cadena sin marcar el run como fallido, es un branch normal.
        await this.skipRemainingSteps(run, step);
        await this.finishRun(run, 'completed', null);
        return;
      }

      await this.advanceToNextStep(run, step, output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - attemptStartedAt.getTime();
      const attemptsLog = this.appendAttemptLog(stepRun, attempt, message, durationMs);

      if (attempt < maxAttempts) {
        // Quedan reintentos: se guarda el intento fallido y se re-lanza para que BullMQ
        // reprograme el job con el backoff exponencial ya configurado en el producer.
        stepRun.status = 'pending';
        stepRun.output = { attempts: attemptsLog };
        await this.stepRuns.save(stepRun);
        throw error;
      }

      // Ultimo intento agotado: el paso y el resto del workflow quedan en 'failed'.
      stepRun.status = 'failed';
      stepRun.errorMessage = message;
      stepRun.output = { attempts: attemptsLog };
      stepRun.finishedAt = new Date();
      await this.stepRuns.save(stepRun);

      await this.skipRemainingSteps(run, step);
      await this.finishRun(run, 'failed', `Paso ${step.orderIndex + 1} (${step.actionType ?? step.stepType}): ${message}`);
      throw error;
    }
  }

  private async completeStep(stepRun: StepRun, output: Record<string, unknown>): Promise<void> {
    stepRun.status = 'completed';
    stepRun.output = output;
    stepRun.finishedAt = new Date();
    await this.stepRuns.save(stepRun);
  }

  // Busca el siguiente paso por order_index y lo encola; si no hay mas pasos, el run termina 'completed'.
  private async advanceToNextStep(run: WorkflowRun, currentStep: WorkflowStep, output: Record<string, unknown>): Promise<void> {
    const steps = [...run.workflow.steps].sort((a, b) => a.orderIndex - b.orderIndex);
    const next = steps.find((s) => s.orderIndex === currentStep.orderIndex + 1);

    if (!next) {
      await this.finishRun(run, 'completed', null);
      return;
    }

    const nextStepRun = await this.stepRuns.save(
      this.stepRuns.create({ workflowRun: run, workflowStep: next, status: 'pending' }),
    );
    await this.producer.enqueueStep(nextStepRun.id, output);
  }

  // Marca como 'skipped' los pasos posteriores al actual que nunca llegan a ejecutarse
  // (condicion falsa o fallo del paso actual).
  private async skipRemainingSteps(run: WorkflowRun, currentStep: WorkflowStep): Promise<void> {
    const steps = [...run.workflow.steps].sort((a, b) => a.orderIndex - b.orderIndex);
    const remaining = steps.filter((s) => s.orderIndex > currentStep.orderIndex);
    if (remaining.length === 0) return;
    await this.stepRuns.save(
      remaining.map((step) => this.stepRuns.create({ workflowRun: run, workflowStep: step, status: 'skipped' })),
    );
  }

  private async finishRun(run: WorkflowRun, status: 'completed' | 'failed', errorMessage: string | null): Promise<void> {
    run.status = status;
    run.errorMessage = errorMessage;
    run.finishedAt = new Date();
    await this.runs.save(run);
  }

  private appendAttemptLog(stepRun: StepRun, attempt: number, message: string, durationMs: number): AttemptLogEntry[] {
    const existing = (stepRun.output?.attempts as AttemptLogEntry[] | undefined) ?? [];
    return [...existing, { attempt, status: 'failed', message, durationMs }];
  }

  // Trae un run con sus step_runs (y el paso al que corresponde cada uno) para mostrar el timeline completo.
  async findRun(runId: string): Promise<WorkflowRun> {
    const run = await this.runs.findOne({
      where: { id: runId },
      relations: { stepRuns: { workflowStep: true }, workflow: true },
    });
    if (!run) throw new NotFoundException(`Run ${runId} no encontrado`);
    run.stepRuns = [...run.stepRuns].sort((a, b) => a.workflowStep.orderIndex - b.workflowStep.orderIndex);
    return run;
  }

  // Historial de runs de un workflow, mas recientes primero.
  async findRunsForWorkflow(workflowId: string): Promise<WorkflowRun[]> {
    return this.runs.find({ where: { workflow: { id: workflowId } }, order: { createdAt: 'DESC' } });
  }
}
