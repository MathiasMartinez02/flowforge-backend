import { BadRequestException, Controller, ForbiddenException, Headers, NotFoundException, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { Workflow } from '../database/entities/workflow.entity.js';
import { WorkflowEngineService } from '../engine/workflow-engine.service.js';
import { verifySignature } from '../common/crypto.util.js';

// Endpoint publico del trigger 'webhook' (Fase 4): POST /webhooks/:workflowId con header
// X-Flowforge-Signature = "sha256=<hmac-hex del body crudo con el webhook_secret del workflow>".
// Sin firma o firma invalida -> 403, sin exponer si el workflow existe (no filtra el secreto).
@Controller('webhooks')
export class WebhooksController {
  constructor(
    @InjectRepository(Workflow) private readonly workflows: Repository<Workflow>,
    private readonly engine: WorkflowEngineService,
  ) {}

  @Post(':workflowId')
  async receive(
    @Param('workflowId') workflowId: string,
    @Headers('x-flowforge-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const workflow = await this.workflows.findOne({ where: { id: workflowId } });
    if (!workflow || workflow.triggerType !== 'webhook') {
      throw new NotFoundException(`Workflow ${workflowId} no encontrado o no acepta webhooks`);
    }
    if (!workflow.webhookSecret) {
      throw new BadRequestException('El workflow no tiene un secreto de firma configurado');
    }
    if (!signature || !req.rawBody || !verifySignature(workflow.webhookSecret, req.rawBody, signature)) {
      throw new ForbiddenException('Firma invalida o ausente (header X-Flowforge-Signature)');
    }

    const payload = (req.body ?? {}) as Record<string, unknown>;
    const run = await this.engine.triggerRun(workflowId, 'webhook', payload);
    return { runId: run.id, status: run.status };
  }
}
