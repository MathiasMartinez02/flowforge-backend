import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HttpRequestAction } from './http-request.action.js';
import { ActionRegistry } from './action-registry.js';

// Agrupa los executors de action_type disponibles.
@Module({
  imports: [HttpModule],
  providers: [HttpRequestAction, ActionRegistry],
  exports: [ActionRegistry],
})
export class ActionsModule {}
