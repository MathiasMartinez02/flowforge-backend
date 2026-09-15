import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { WorkflowsService } from './workflows.service.js';
import { CreateWorkflowDto } from './dto/create-workflow.dto.js';
import { UpdateWorkflowStatusDto } from './dto/update-workflow-status.dto.js';

// Endpoints de workflows: crear, listar, ver detalle y activar/pausar.
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Post()
  create(@Body() dto: CreateWorkflowDto) {
    return this.workflows.create(dto);
  }

  @Get()
  findAll() {
    return this.workflows.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workflows.findOne(id);
  }

  // Agregado en la Fase 3: activar/pausar un workflow. Afecta directo el scheduler (ver
  // SchedulerService.sync) — pausar un workflow programado da de baja su cron sin borrarlo.
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateWorkflowStatusDto) {
    return this.workflows.updateStatus(id, dto.status);
  }

  // Agregado en la Fase 4: regenera el secreto de firma de un workflow con trigger 'webhook'
  // (invalida cualquier integracion externa que todavia use el secreto anterior).
  @Post(':id/webhook-secret/regenerate')
  regenerateWebhookSecret(@Param('id') id: string) {
    return this.workflows.regenerateWebhookSecret(id);
  }
}
