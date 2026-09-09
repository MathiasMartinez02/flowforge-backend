import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HttpRequestAction } from './http-request.action.js';
import { NotificationAction } from './notification.action.js';
import { ActionRegistry } from './action-registry.js';

// Agrupa los executors de action_type disponibles.
// Modificado en la Fase 2: se suma NotificationAction (ConfigService ya es global via @nestjs/config, no hace falta importarlo).
@Module({
  imports: [HttpModule],
  providers: [HttpRequestAction, NotificationAction, ActionRegistry],
  exports: [ActionRegistry],
})
export class ActionsModule {}
