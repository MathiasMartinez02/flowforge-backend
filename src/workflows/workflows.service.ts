import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../database/entities/workflow.entity.js';
import { WorkflowStep } from '../database/entities/workflow-step.entity.js';
import { SchedulerService } from '../scheduler/scheduler.service.js';
import { CreateWorkflowDto } from './dto/create-workflow.dto.js';

// CRUD de workflows: crea con sus pasos en una transaccion, lista y trae el detalle con pasos ordenados.
// Modificado en la Fase 3: inyecta SchedulerService para mantener sincronizado el cron de cada
// workflow con su trigger_type/status (crear un workflow programado y activo lo registra al toque).
@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow) private readonly workflows: Repository<Workflow>,
    @InjectRepository(WorkflowStep) private readonly steps: Repository<WorkflowStep>,
    private readonly scheduler: SchedulerService,
  ) {}

  // Crea un workflow y sus pasos; valida que 'scheduled' venga con cron_expression.
  async create(dto: CreateWorkflowDto): Promise<Workflow> {
    if (dto.triggerType === 'scheduled' && !dto.cronExpression) {
      throw new BadRequestException('cronExpression es requerido cuando triggerType es "scheduled"');
    }

    const workflow = this.workflows.create({
      name: dto.name,
      description: dto.description ?? null,
      triggerType: dto.triggerType,
      cronExpression: dto.cronExpression ?? null,
      // actionType es opcional en el DTO desde la Fase 2 (un paso 'condition' no lo lleva) — se normaliza a null explicito.
      steps: dto.steps.map((step) =>
        this.steps.create({
          orderIndex: step.orderIndex,
          stepType: step.stepType,
          actionType: step.actionType ?? null,
          config: step.config,
        }),
      ),
    });

    const saved = await this.workflows.save(workflow);
    this.scheduler.sync(saved);
    return saved;
  }

  // Activa/pausa un workflow y resincroniza su cron (un workflow pausado no dispara mas hasta reactivarse).
  async updateStatus(id: string, status: string): Promise<Workflow> {
    const workflow = await this.workflows.findOne({ where: { id }, relations: { steps: true } });
    if (!workflow) throw new NotFoundException(`Workflow ${id} no encontrado`);

    workflow.status = status;
    const saved = await this.workflows.save(workflow);
    this.scheduler.sync(saved);
    return this.withOrderedSteps(saved);
  }

  // Lista todos los workflows con sus pasos (para mostrar stepsCount en el dashboard).
  async findAll(): Promise<Workflow[]> {
    const all = await this.workflows.find({ relations: { steps: true }, order: { createdAt: 'DESC' } });
    return all.map((workflow) => this.withOrderedSteps(workflow));
  }

  // Detalle de un workflow con sus pasos ordenados por orderIndex.
  async findOne(id: string): Promise<Workflow> {
    const workflow = await this.workflows.findOne({ where: { id }, relations: { steps: true } });
    if (!workflow) throw new NotFoundException(`Workflow ${id} no encontrado`);
    return this.withOrderedSteps(workflow);
  }

  private withOrderedSteps(workflow: Workflow): Workflow {
    workflow.steps = [...workflow.steps].sort((a, b) => a.orderIndex - b.orderIndex);
    return workflow;
  }
}
