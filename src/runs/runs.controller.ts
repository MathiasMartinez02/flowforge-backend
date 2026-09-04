import { Controller, Get, Param, Post } from '@nestjs/common';
import { WorkflowEngineService } from '../engine/workflow-engine.service.js';

// Dispara ejecuciones de un workflow y expone su historial / detalle.
@Controller()
export class RunsController {
  constructor(private readonly engine: WorkflowEngineService) {}

  @Post('workflows/:id/runs')
  run(@Param('id') id: string) {
    return this.engine.runWorkflow(id, 'manual');
  }

  @Get('workflows/:id/runs')
  history(@Param('id') id: string) {
    return this.engine.findRunsForWorkflow(id);
  }

  @Get('runs/:id')
  findOne(@Param('id') id: string) {
    return this.engine.findRun(id);
  }
}
