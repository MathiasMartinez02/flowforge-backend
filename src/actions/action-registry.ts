import { Injectable } from '@nestjs/common';
import { StepExecutor } from '../engine/step-executor.interface.js';
import { HttpRequestAction } from './http-request.action.js';
import { NotificationAction } from './notification.action.js';
import { AiAction } from './ai.action.js';
import { GithubAction } from './github.action.js';

// Mapea action_type -> executor.
// Modificado en la Fase 2: se suma 'notification'.
// Modificado en la Fase 4: se suman 'ai_task' y 'github'.
@Injectable()
export class ActionRegistry {
  constructor(
    private readonly httpRequestAction: HttpRequestAction,
    private readonly notificationAction: NotificationAction,
    private readonly aiAction: AiAction,
    private readonly githubAction: GithubAction,
  ) {}

  get(actionType: string): StepExecutor {
    switch (actionType) {
      case 'http_request':
        return this.httpRequestAction;
      case 'notification':
        return this.notificationAction;
      case 'ai_task':
        return this.aiAction;
      case 'github':
        return this.githubAction;
      default:
        throw new Error(`No hay executor registrado para action_type "${actionType}"`);
    }
  }
}
