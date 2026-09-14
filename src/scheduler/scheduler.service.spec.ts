import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJob } from 'cron';
import { SchedulerService } from './scheduler.service.js';
import type { Repository } from 'typeorm';
import type { Workflow } from '../database/entities/workflow.entity.js';
import type { WorkflowEngineService } from '../engine/workflow-engine.service.js';

function buildWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'wf1',
    name: 'Test',
    triggerType: 'scheduled',
    cronExpression: '*/5 * * * *',
    status: 'active',
    ...overrides,
  } as Workflow;
}

describe('SchedulerService', () => {
  let workflowsRepo: Pick<Repository<Workflow>, 'find'>;
  let engine: Pick<WorkflowEngineService, 'triggerRun'>;
  let registry: { addCronJob: ReturnType<typeof vi.fn>; deleteCronJob: ReturnType<typeof vi.fn>; doesExist: ReturnType<typeof vi.fn> };
  let service: SchedulerService;
  let registeredJobs: CronJob[];

  beforeEach(() => {
    registeredJobs = [];
    workflowsRepo = { find: vi.fn().mockResolvedValue([]) };
    engine = { triggerRun: vi.fn().mockResolvedValue(undefined) };
    registry = {
      addCronJob: vi.fn((_name: string, job: CronJob) => registeredJobs.push(job)),
      deleteCronJob: vi.fn(),
      doesExist: vi.fn().mockReturnValue(true),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new SchedulerService(workflowsRepo as Repository<Workflow>, registry as any, engine as WorkflowEngineService);
  });

  // Ningun CronJob debe quedar corriendo de verdad al terminar cada test.
  afterEach(() => {
    for (const job of registeredJobs) job.stop();
  });

  it('onModuleInit registra un cron por cada workflow programado y activo existente', async () => {
    (workflowsRepo.find as ReturnType<typeof vi.fn>).mockResolvedValue([buildWorkflow({ id: 'wf1' }), buildWorkflow({ id: 'wf2' })]);

    await service.onModuleInit();

    expect(workflowsRepo.find).toHaveBeenCalledWith({ where: { triggerType: 'scheduled', status: 'active' } });
    expect(registry.addCronJob).toHaveBeenCalledTimes(2);
    expect(registry.addCronJob).toHaveBeenCalledWith('wf1', expect.anything());
    expect(registry.addCronJob).toHaveBeenCalledWith('wf2', expect.anything());
  });

  it('sync registra el cron de un workflow programado y activo', () => {
    service.sync(buildWorkflow());
    expect(registry.deleteCronJob).toHaveBeenCalledWith('wf1');
    expect(registry.addCronJob).toHaveBeenCalledWith('wf1', expect.anything());
  });

  it('sync no registra nada para un workflow pausado (solo da de baja el cron existente)', () => {
    service.sync(buildWorkflow({ status: 'paused' }));
    expect(registry.deleteCronJob).toHaveBeenCalledWith('wf1');
    expect(registry.addCronJob).not.toHaveBeenCalled();
  });

  it('sync no registra nada para un workflow manual', () => {
    service.sync(buildWorkflow({ triggerType: 'manual', cronExpression: null }));
    expect(registry.addCronJob).not.toHaveBeenCalled();
  });

  it('una expresion cron invalida se loguea y no rompe el sync', () => {
    expect(() => service.sync(buildWorkflow({ cronExpression: 'esto-no-es-un-cron' }))).not.toThrow();
    expect(registry.addCronJob).not.toHaveBeenCalled();
  });
});
