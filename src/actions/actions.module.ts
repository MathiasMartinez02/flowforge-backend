import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HttpRequestAction } from './http-request.action.js';
import { NotificationAction } from './notification.action.js';
import { AiAction } from './ai.action.js';
import { GithubAction } from './github.action.js';
import { ActionRegistry } from './action-registry.js';
import { GithubModule } from '../integrations/github/github.module.js';

// Agrupa los executors de action_type disponibles.
// Modificado en la Fase 2: se suma NotificationAction (ConfigService ya es global via @nestjs/config, no hace falta importarlo).
// Modificado en la Fase 4: se suman AiAction y GithubAction (esta ultima importa GithubModule para
// reusar la credencial de OAuth ya conectada, sin duplicar el manejo del token encriptado).
@Module({
  imports: [HttpModule, GithubModule],
  providers: [HttpRequestAction, NotificationAction, AiAction, GithubAction, ActionRegistry],
  exports: [ActionRegistry],
})
export class ActionsModule {}
