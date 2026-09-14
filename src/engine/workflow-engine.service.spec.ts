import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowEngineService } from './workflow-engine.service.js';
import { ConditionEvaluator } from './condition-evaluator.js';
import type { Repository } from 'typeorm';
import type { Workflow } from '../database/entities/workflow.entity.js';
import type { WorkflowRun } from '../database/entities/workflow-run.entity.js';
import type { StepRun } from '../database/entities/step-run.entity.js';
import type { WorkflowStep } from '../database/entities/workflow-step.entity.js';
import type { ActionRegistry } from '../actions/action-registry.js';
import type { WorkflowProducer } from '../queue/workflow.producer.js';

// El motor se instancia a mano con repos/producer/registry mockeados (BullMQ mockeado, ver guia de
// desarrollo 3.4) — no levanta Nest ni conecta a Postgres/Redis reales.
function buildStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return { id: 's1', orderIndex: 0, stepType: 'action', actionType: 'http_request', config: {}, ...overrides } as WorkflowStep;
}

function buildStepRun(overrides: Partial<StepRun> = {}): StepRun {
  return {
    id: 'sr1',
    status: 'pending',
    attempt: 1,
    output: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  } as StepRun;
}

describe('WorkflowEngineService', () => {
  let workflowsRepo: Pick<Repository<Workflow>, 'findOne'>;
  let runsRepo: Pick<Repository<WorkflowRun>, 'create' | 'save' | 'findOne' | 'find'>;
  let stepRunsRepo: Pick<Repository<StepRun>, 'create' | 'save' | 'findOne'>;
  let actionRegistry: Pick<ActionRegistry, 'get'>;
  let producer: Pick<WorkflowProducer, 'enqueueStep'>;
  let engine: WorkflowEngineService;
  let executeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    executeMock = vi.fn();
    workflowsRepo = { findOne: vi.fn() };
    runsRepo = {
      create: vi.fn((data) => ({ ...data }) as WorkflowRun),
      save: vi.fn(async (run) => run as WorkflowRun),
      findOne: vi.fn(),
      find: vi.fn(),
    };
    stepRunsRepo = {
      create: vi.fn((data) => ({ ...data }) as StepRun),
      save: vi.fn(async (stepRun) => stepRun as StepRun),
      findOne: vi.fn(),
    };
    actionRegistry = { get: vi.fn(() => ({ execute: executeMock })) };
    producer = { enqueueStep: vi.fn(async () => {}) };

    engine = new WorkflowEngineService(
      workflowsRepo as Repository<Workflow>,
      runsRepo as Repository<WorkflowRun>,
      stepRunsRepo as Repository<StepRun>,
      actionRegistry as ActionRegistry,
      new ConditionEvaluator(),
      producer as WorkflowProducer,
    );
  });

  describe('triggerRun', () => {
    it('crea el run, el primer step_run y encola el primer paso', async () => {
      const step1 = buildStep({ id: 'step-1', orderIndex: 0 });
      const step2 = buildStep({ id: 'step-2', orderIndex: 1 });
      (workflowsRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'wf1', steps: [step1, step2] });
      (stepRunsRepo.create as ReturnType<typeof vi.fn>).mockReturnValue(buildStepRun({ id: 'sr-1' }));
      (runsRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'run1',
        stepRuns: [],
        workflow: { steps: [step1, step2] },
      });

      await engine.triggerRun('wf1', 'manual');

      expect(runsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'running', triggerSource: 'manual' }));
      expect(producer.enqueueStep).toHaveBeenCalledWith('sr-1', null);
    });

    it('workflow sin pasos termina el run como completed sin encolar nada', async () => {
      (workflowsRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'wf1', steps: [] });
      (runsRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'run1', status: 'completed', stepRuns: [] });

      await engine.triggerRun('wf1', 'manual');

      expect(producer.enqueueStep).not.toHaveBeenCalled();
      expect(runsRepo.save).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'completed' }));
    });

    it('tira NotFoundException si el workflow no existe', async () => {
      (workflowsRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await expect(engine.triggerRun('no-existe', 'manual')).rejects.toThrow();
    });
  });

  describe('processStep', () => {
    function mockStepRunLookup(step: WorkflowStep, allSteps: WorkflowStep[], run: Partial<WorkflowRun> = {}) {
      const stepRun = buildStepRun({ workflowStep: step, workflowRun: { workflow: { steps: allSteps }, ...run } as WorkflowRun });
      (stepRunsRepo.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(stepRun);
      return stepRun;
    }

    it('accion exitosa con mas pasos: completa el step_run y encola el siguiente', async () => {
      const step1 = buildStep({ id: 'step-1', orderIndex: 0 });
      const step2 = buildStep({ id: 'step-2', orderIndex: 1 });
      mockStepRunLookup(step1, [step1, step2]);
      executeMock.mockResolvedValue({ statusCode: 200 });
      (stepRunsRepo.create as ReturnType<typeof vi.fn>).mockReturnValue(buildStepRun({ id: 'sr-2' }));

      await engine.processStep('sr-1', null, 1, 3);

      expect(producer.enqueueStep).toHaveBeenCalledWith('sr-2', { statusCode: 200 });
      expect(stepRunsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', output: { statusCode: 200 } }));
    });

    it('accion exitosa en el ultimo paso: marca el run como completed', async () => {
      const step1 = buildStep({ id: 'step-1', orderIndex: 0 });
      mockStepRunLookup(step1, [step1]);
      executeMock.mockResolvedValue({ ok: true });

      await engine.processStep('sr-1', null, 1, 3);

      expect(producer.enqueueStep).not.toHaveBeenCalled();
      expect(runsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    });

    it('condicion falsa: marca los pasos restantes como skipped y el run como completed (no failed)', async () => {
      const step1 = buildStep({ id: 'step-1', orderIndex: 0, stepType: 'condition', actionType: null, config: { field: 'x', operator: '==', value: 'a' } });
      const step2 = buildStep({ id: 'step-2', orderIndex: 1 });
      mockStepRunLookup(step1, [step1, step2]);

      await engine.processStep('sr-1', { x: 'b' }, 1, 3);

      expect(stepRunsRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ workflowStep: step2, status: 'skipped' })]),
      );
      expect(runsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
      expect(producer.enqueueStep).not.toHaveBeenCalled();
    });

    it('fallo con reintentos disponibles: guarda el intento y re-lanza para que BullMQ reintente', async () => {
      const step1 = buildStep({ id: 'step-1', orderIndex: 0 });
      mockStepRunLookup(step1, [step1]);
      executeMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(engine.processStep('sr-1', null, 1, 3)).rejects.toThrow('ECONNREFUSED');

      expect(stepRunsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', output: { attempts: [expect.objectContaining({ attempt: 1, status: 'failed' })] } }),
      );
      expect(runsRepo.save).not.toHaveBeenCalled();
    });

    it('fallo en el ultimo intento: step_run y run quedan failed, resto de pasos skipped', async () => {
      const step1 = buildStep({ id: 'step-1', orderIndex: 0 });
      const step2 = buildStep({ id: 'step-2', orderIndex: 1 });
      mockStepRunLookup(step1, [step1, step2]);
      executeMock.mockRejectedValue(new Error('timeout'));

      await expect(engine.processStep('sr-1', null, 3, 3)).rejects.toThrow('timeout');

      expect(stepRunsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', errorMessage: 'timeout' }));
      expect(runsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    });
  });
});
