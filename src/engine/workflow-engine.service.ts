import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../database/entities/workflow.entity.js';
import { WorkflowRun } from '../database/entities/workflow-run.entity.js';
import { StepRun } from '../database/entities/step-run.entity.js';
import { ActionRegistry } from '../actions/action-registry.js';

// Orquesta la ejecucion de un workflow: recorre sus pasos en orden, en memoria y de forma sincrona (sin cola todavia).
@Injectable()
export class WorkflowEngineService {
  constructor(
    @InjectRepository(Workflow) private readonly workflows: Repository<Workflow>,
    @InjectRepository(WorkflowRun) private readonly runs: Repository<WorkflowRun>,
    @InjectRepository(StepRun) private readonly stepRuns: Repository<StepRun>,
    private readonly actionRegistry: ActionRegistry,
  ) {}

  // Ejecuta todos los pasos del workflow uno por uno; corta al primer error y marca el run como failed.
  async runWorkflow(workflowId: string, triggerSource: string): Promise<WorkflowRun> {
    const workflow = await this.workflows.findOne({ where: { id: workflowId }, relations: { steps: true } });
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} no encontrado`);
    const steps = [...workflow.steps].sort((a, b) => a.orderIndex - b.orderIndex);

    let run = await this.runs.save(
      this.runs.create({ workflow, triggerSource, status: 'running', startedAt: new Date() }),
    );

    let previousOutput: Record<string, unknown> | null = null;
    let failed = false;
    let runErrorMessage: string | null = null;

    for (const step of steps) {
      let stepRun = await this.stepRuns.save(
        this.stepRuns.create({ workflowRun: run, workflowStep: step, status: 'running', startedAt: new Date() }),
      );

      try {
        const executor = this.actionRegistry.get(step.actionType ?? '');
        const output = await executor.execute(step.config, previousOutput);
        stepRun.status = 'completed';
        stepRun.output = output;
        previousOutput = output;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stepRun.status = 'failed';
        stepRun.errorMessage = message;
        // Se propaga al run para poder mostrar por que fallo sin tener que abrir el detalle de pasos.
        runErrorMessage = `Paso ${step.orderIndex + 1} (${step.actionType}): ${message}`;
        failed = true;
      }

      stepRun.finishedAt = new Date();
      await this.stepRuns.save(stepRun);
      if (failed) break;
    }

    run.status = failed ? 'failed' : 'completed';
    run.errorMessage = runErrorMessage;
    run.finishedAt = new Date();
    run = await this.runs.save(run);

    return this.findRun(run.id);
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
