import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { WorkflowsService } from './workflows.service.js';
import { CreateWorkflowDto } from './dto/create-workflow.dto.js';

// Endpoints de workflows: crear, listar y ver detalle.
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
}
