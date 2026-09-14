import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../database/entities/workflow.entity.js';
import { WorkflowEngineService } from '../engine/workflow-engine.service.js';

// Registra un CronJob dinamico por cada workflow con trigger_type = 'scheduled' y status = 'active',
// que al dispararse llama a WorkflowEngineService.triggerRun(workflowId, 'scheduled') — el mismo
// motor que usa el boton "Ejecutar ahora" manual, sin duplicar logica de ejecucion.
// Sin lock distribuido a proposito (ver guia de desarrollo, seccion 7): para una sola instancia
// del backend (MVP) no hace falta: en produccion con mas de una instancia esto duplicaria runs,
// habria que sumar un lock de Redis o usar los repeatable jobs de BullMQ (que deduplican por jobId).
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Workflow) private readonly workflows: Repository<Workflow>,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly engine: WorkflowEngineService,
  ) {}

  // Al bootear la app, registra el cron de todos los workflows programados y activos que ya existen en la DB.
  async onModuleInit(): Promise<void> {
    const scheduled = await this.workflows.find({ where: { triggerType: 'scheduled', status: 'active' } });
    for (const workflow of scheduled) {
      this.register(workflow);
    }
    this.logger.log(`${scheduled.length} workflow(s) programados registrados al arrancar`);
  }

  // Sincroniza el cron de un workflow con su estado actual (trigger_type/status/cron_expression).
  // Se llama desde WorkflowsService al crear un workflow y al cambiar su status — asi un cambio de
  // scheduling toma efecto en caliente, sin reiniciar el proceso.
  sync(workflow: Workflow): void {
    this.unregister(workflow.id);
    if (workflow.triggerType === 'scheduled' && workflow.status === 'active') {
      this.register(workflow);
    }
  }

  private register(workflow: Workflow): void {
    if (!workflow.cronExpression) return;
    try {
      const job = new CronJob(workflow.cronExpression, () => {
        this.logger.log(`Disparando workflow programado "${workflow.name}" (${workflow.id})`);
        this.engine.triggerRun(workflow.id, 'scheduled').catch((error: unknown) => {
          this.logger.error(
            `Fallo al disparar workflow programado ${workflow.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      });
      this.schedulerRegistry.addCronJob(workflow.id, job);
      job.start();
    } catch (error) {
      // Cron invalido: se loguea y se sigue sin ese workflow, no tira abajo el boot de toda la app.
      this.logger.error(
        `Expresion cron invalida en workflow ${workflow.id} ("${workflow.cronExpression}"): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private unregister(workflowId: string): void {
    if (this.schedulerRegistry.doesExist('cron', workflowId)) {
      this.schedulerRegistry.deleteCronJob(workflowId);
    }
  }
}
