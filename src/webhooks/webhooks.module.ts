import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from '../database/entities/workflow.entity.js';
import { EngineModule } from '../engine/engine.module.js';
import { WebhooksController } from './webhooks.controller.js';

// Expone el endpoint publico del trigger 'webhook' sobre el motor de ejecucion ya existente.
@Module({
  imports: [TypeOrmModule.forFeature([Workflow]), EngineModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
