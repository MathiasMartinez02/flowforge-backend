import { Injectable } from '@nestjs/common';
import { StepExecutor } from '../engine/step-executor.interface.js';
import { HttpRequestAction } from './http-request.action.js';
import { NotificationAction } from './notification.action.js';

// Mapea action_type -> executor. AI (Fase 4) se agrega aca, no en el motor.
// Modificado en la Fase 2: se suma 'notification'.
@Injectable()
export class ActionRegistry {
  constructor(
    private readonly httpRequestAction: HttpRequestAction,
    private readonly notificationAction: NotificationAction,
  ) {}

  get(actionType: string): StepExecutor {
    switch (actionType) {
      case 'http_request':
        return this.httpRequestAction;
      case 'notification':
        return this.notificationAction;
      default:
        throw new Error(`No hay executor registrado para action_type "${actionType}"`);
    }
  }
}
